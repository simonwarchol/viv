/**
 * Resolves IFD byte offsets for remote TIFF files.
 *
 * Strategy:
 *  1. Try fetching a sibling `offsets.json` file
 *  2. Fall back to a greedy range-based IFD scanner
 */

/** Options for the IFD scanner. */
interface ScannerOptions {
  /** Initial byte window to fetch (default 64 KB). */
  initialWindowSize?: number;
  /** Maximum byte window to fetch (default 1 MB). */
  maxWindowSize?: number;
  /** 'fixed' uses initialWindowSize for every request; 'adaptive' doubles only when current buffer is too small (default 'adaptive'). */
  mode?: 'fixed' | 'adaptive';
}

const SCANNER_DEFAULTS: Required<ScannerOptions> = {
  initialWindowSize: 64 * 1024,
  maxWindowSize: 1024 * 1024,
  mode: 'adaptive'
};

// -- TIFF format helpers --

const LITTLE_ENDIAN = 0x4949; // 'II'
const BIG_ENDIAN = 0x4d4d; // 'MM'
const CLASSIC_MAGIC = 42;
const BIGTIFF_MAGIC = 43;

interface TiffFormat {
  littleEndian: boolean;
  bigTiff: boolean;
  /** Byte offset of the first IFD. */
  firstIfdOffset: number;
}

/** Parse the TIFF/BigTIFF header from a buffer (needs at least 16 bytes). */
function parseTiffHeader(buf: ArrayBuffer): TiffFormat {
  const view = new DataView(buf);
  const bom = view.getUint16(0, false);
  let littleEndian: boolean;
  if (bom === LITTLE_ENDIAN) {
    littleEndian = true;
  } else if (bom === BIG_ENDIAN) {
    littleEndian = false;
  } else {
    throw new Error(`Invalid TIFF byte-order mark: 0x${bom.toString(16)}`);
  }

  const magic = view.getUint16(2, littleEndian);
  if (magic === CLASSIC_MAGIC) {
    const firstIfdOffset = view.getUint32(4, littleEndian);
    return { littleEndian, bigTiff: false, firstIfdOffset };
  }
  if (magic === BIGTIFF_MAGIC) {
    // BigTIFF: bytes 4-5 = offset size (always 8), bytes 6-7 = padding (always 0)
    // bytes 8-15 = 8-byte first IFD offset
    const firstIfdOffset = readUint64(view, 8, littleEndian);
    return { littleEndian, bigTiff: true, firstIfdOffset };
  }
  throw new Error(`Invalid TIFF magic number: ${magic}`);
}

/**
 * Read a uint64 from a DataView. Since IFD offsets must fit in a safe
 * integer range for practical files, we read as two 32-bit halves and
 * combine with Number arithmetic.
 */
function readUint64(
  view: DataView,
  offset: number,
  littleEndian: boolean
): number {
  const lo = view.getUint32(offset, littleEndian);
  const hi = view.getUint32(offset + 4, littleEndian);
  const value = littleEndian ? hi * 0x100000000 + lo : lo * 0x100000000 + hi;
  if (!Number.isSafeInteger(value)) {
    throw new Error(`IFD offset exceeds safe integer range: ${value}`);
  }
  return value;
}

/**
 * Parse one IFD from a buffer at a given local offset.
 *
 * Returns the byte position of the *next* IFD (0 = end of chain) and
 * the number of bytes consumed, or `null` if the buffer is too small.
 */
function parseIfd(
  buf: ArrayBuffer,
  localOffset: number,
  format: TiffFormat
): { nextIfdOffset: number; bytesConsumed: number } | null {
  const view = new DataView(buf);
  const { littleEndian, bigTiff } = format;

  if (bigTiff) {
    // BigTIFF IFD: 8-byte entry count + N * 20-byte entries + 8-byte next offset
    if (localOffset + 8 > buf.byteLength) return null;
    const entryCount = readUint64(view, localOffset, littleEndian);
    const ifdSize = 8 + entryCount * 20 + 8;
    if (localOffset + ifdSize > buf.byteLength) return null;
    const nextIfdOffset = readUint64(
      view,
      localOffset + 8 + entryCount * 20,
      littleEndian
    );
    return { nextIfdOffset, bytesConsumed: ifdSize };
  }

  // Classic TIFF IFD: 2-byte entry count + N * 12-byte entries + 4-byte next offset
  if (localOffset + 2 > buf.byteLength) return null;
  const entryCount = view.getUint16(localOffset, littleEndian);
  const ifdSize = 2 + entryCount * 12 + 4;
  if (localOffset + ifdSize > buf.byteLength) return null;
  const nextIfdOffset = view.getUint32(
    localOffset + 2 + entryCount * 12,
    littleEndian
  );
  return { nextIfdOffset, bytesConsumed: ifdSize };
}

// -- Fetching helpers --

async function fetchRange(
  url: string,
  start: number,
  end: number,
  headers?: HeadersInit
): Promise<ArrayBuffer> {
  const resp = await fetch(url, {
    headers: {
      ...normalizeHeaders(headers),
      Range: `bytes=${start}-${end - 1}`
    }
  });
  // 206 Partial Content is the expected response for Range requests.
  // Reject 200 OK — it means the server ignored the Range header and
  // returned the entire file, which defeats the purpose for large TIFFs.
  if (resp.status !== 206) {
    throw new Error(
      `Expected HTTP 206 for range request, got ${resp.status} (bytes=${start}-${end - 1})`
    );
  }
  return resp.arrayBuffer();
}

function normalizeHeaders(
  headers?: HeadersInit
): Record<string, string> | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }
  return headers as Record<string, string>;
}

// -- Public API --

/**
 * Try to fetch a sibling `offsets.json` next to the TIFF URL.
 * Returns the parsed number[] or `null` on any failure or invalid data.
 */
async function fetchOffsetsJson(
  url: string,
  headers?: HeadersInit
): Promise<number[] | null> {
  try {
    const offsetsUrl = `${url}.offsets.json`;
    const resp = await fetch(offsetsUrl, {
      headers: normalizeHeaders(headers)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    // Every element must be a positive safe integer (byte offset).
    for (const n of data) {
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
        return null;
      }
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Scan IFD offsets directly from a remote TIFF using HTTP Range requests.
 *
 * Reads the TIFF header, then fetches byte windows and parses consecutive
 * IFDs from each buffer. Only issues a new request when the next IFD falls
 * outside the current buffer. In adaptive mode, the window size grows only
 * when a buffer is too small to parse the current IFD.
 */
async function scanIfdOffsets(
  url: string,
  headers?: HeadersInit,
  options?: ScannerOptions
): Promise<number[]> {
  const opts = { ...SCANNER_DEFAULTS, ...options };
  let windowSize = opts.initialWindowSize;

  // 1. Fetch the header (16 bytes covers both classic and BigTIFF).
  const headerBuf = await fetchRange(url, 0, 16, headers);
  const format = parseTiffHeader(headerBuf);

  const offsets: number[] = [];
  let currentOffset = format.firstIfdOffset;
  if (currentOffset === 0) return offsets;

  // 2. Walk the IFD chain.
  let bufStart = -1;
  let buf: ArrayBuffer = new ArrayBuffer(0);

  while (currentOffset !== 0) {
    offsets.push(currentOffset);

    // Ensure currentOffset is within our buffer.
    const localOffset = currentOffset - bufStart;
    if (bufStart < 0 || localOffset < 0 || localOffset >= buf.byteLength) {
      // Need to fetch a new window (IFD is outside current buffer).
      buf = await fetchRange(
        url,
        currentOffset,
        currentOffset + windowSize,
        headers
      );
      bufStart = currentOffset;
    }

    const result = parseIfd(buf, currentOffset - bufStart, format);
    if (result !== null) {
      currentOffset = result.nextIfdOffset;
      continue;
    }

    // Buffer too small to parse this IFD.
    if (opts.mode === 'fixed' || windowSize >= opts.maxWindowSize) {
      throw new Error(
        `IFD at offset ${currentOffset} does not fit in ${windowSize}-byte window (mode=${opts.mode}, max=${opts.maxWindowSize})`
      );
    }

    // Adaptive: grow and retry.
    windowSize = Math.min(windowSize * 2, opts.maxWindowSize);
    buf = await fetchRange(
      url,
      currentOffset,
      currentOffset + windowSize,
      headers
    );
    bufStart = currentOffset;
    const retry = parseIfd(buf, 0, format);
    if (retry === null) {
      throw new Error(
        `IFD at offset ${currentOffset} does not fit in ${windowSize}-byte window`
      );
    }
    currentOffset = retry.nextIfdOffset;
  }

  return offsets;
}

/**
 * Resolve IFD offsets for a remote TIFF file.
 *
 * 1. Tries to fetch `<url>.offsets.json`
 * 2. Falls back to scanning IFD offsets from the TIFF file directly
 *
 * @param url - The TIFF file URL.
 * @param headers - Optional HTTP headers for fetch requests.
 * @param scannerOptions - Options for the fallback IFD scanner.
 * @returns Array of absolute byte offsets, one per IFD.
 */
export async function resolveRemoteOffsets(
  url: string,
  headers?: HeadersInit,
  scannerOptions?: ScannerOptions
): Promise<number[]> {
  // Try offsets.json sidecar first.
  const jsonOffsets = await fetchOffsetsJson(url, headers);
  if (jsonOffsets) return jsonOffsets;

  // Fall back to scanning.
  return scanIfdOffsets(url, headers, scannerOptions);
}
