/**
 * Resolves IFD byte offsets for remote TIFF files.
 *
 * Strategy:
 *  1. Try fetching a sibling `offsets.json` file
 *  2. Fall back to a greedy range-based IFD scanner
 */

/** Options for the IFD scanner. */
export interface ScannerOptions {
  /** Initial byte window to fetch (default 64 KB). */
  initialWindowSize?: number;
  /** Maximum byte window to fetch (default 1 MB). */
  maxWindowSize?: number;
  /** 'fixed' uses initialWindowSize for every request; 'adaptive' grows only when a buffer is too small to parse the current IFD (default 'adaptive'). */
  mode?: 'fixed' | 'adaptive';
}

export const SCANNER_DEFAULTS: Required<ScannerOptions> = {
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
 * Compute the exact byte size needed to read a complete IFD at `localOffset`.
 *
 * Returns the required size from localOffset to the end of the IFD
 * (including the next-IFD pointer), or `null` if the buffer is too small
 * to even read the entry count.
 */
function computeRequiredIfdSize(
  buf: ArrayBuffer,
  localOffset: number,
  format: TiffFormat
): number | null {
  const view = new DataView(buf);
  const { littleEndian, bigTiff } = format;

  if (bigTiff) {
    // Need 8 bytes for the entry count.
    if (localOffset + 8 > buf.byteLength) return null;
    const entryCount = readUint64(view, localOffset, littleEndian);
    return 8 + entryCount * 20 + 8;
  }

  // Classic: need 2 bytes for entry count.
  if (localOffset + 2 > buf.byteLength) return null;
  const entryCount = view.getUint16(localOffset, littleEndian);
  return 2 + entryCount * 12 + 4;
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

/** Result of a range fetch. */
interface RangeResult {
  buffer: ArrayBuffer;
  /**
   * True if the server returned the full file (200 OK) instead of
   * a partial response (206). When true, this buffer contains the
   * entire file and no further fetches are needed.
   */
  fullFile: boolean;
}

/**
 * Fetch a byte range from a URL.
 *
 * Range-request policy:
 * - 206 Partial Content: expected, returns the requested range.
 * - 200 OK: the server ignored the Range header and returned the
 *   entire file. We accept it (the bytes are still valid) but flag
 *   `fullFile: true` so the caller can avoid further fetches.
 * - Any other status: throws.
 */
async function fetchRange(
  url: string,
  start: number,
  end: number,
  headers?: HeadersInit
): Promise<RangeResult> {
  const resp = await fetch(url, {
    headers: {
      ...normalizeHeaders(headers),
      Range: `bytes=${start}-${end - 1}`
    }
  });
  if (resp.status === 206) {
    return { buffer: await resp.arrayBuffer(), fullFile: false };
  }
  if (resp.ok) {
    // Server ignored Range and returned the whole file.
    return { buffer: await resp.arrayBuffer(), fullFile: true };
  }
  throw new Error(
    `HTTP ${resp.status} fetching range bytes=${start}-${end - 1}`
  );
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
    // Every element must be a non-negative safe integer (byte offset).
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
 * when a buffer is too small to parse the current IFD, using the exact
 * required IFD size to determine the next fetch.
 *
 * If the server does not support Range requests (returns 200 OK), the
 * full-file response is used as the buffer and no further fetches are made.
 */
async function scanIfdOffsets(
  url: string,
  headers?: HeadersInit,
  options?: ScannerOptions
): Promise<number[]> {
  const opts = { ...SCANNER_DEFAULTS, ...options };
  const windowSize = opts.initialWindowSize;

  // 1. Fetch the header (16 bytes covers both classic and BigTIFF).
  const headerResult = await fetchRange(url, 0, 16, headers);
  const format = parseTiffHeader(headerResult.buffer);

  const offsets: number[] = [];
  let currentOffset = format.firstIfdOffset;
  if (currentOffset === 0) return offsets;

  // If the server returned the full file for the header request,
  // use it as the buffer for all IFD parsing — no further fetches needed.
  let bufStart: number;
  let buf: ArrayBuffer;
  let haveFullFile: boolean;

  if (headerResult.fullFile) {
    buf = headerResult.buffer;
    bufStart = 0;
    haveFullFile = true;
  } else {
    buf = new ArrayBuffer(0);
    bufStart = -1;
    haveFullFile = false;
  }

  // 2. Walk the IFD chain.
  while (currentOffset !== 0) {
    offsets.push(currentOffset);

    // Ensure currentOffset is within our buffer.
    const localOffset = currentOffset - bufStart;
    if (!haveFullFile && (bufStart < 0 || localOffset < 0 || localOffset >= buf.byteLength)) {
      const result = await fetchRange(
        url,
        currentOffset,
        currentOffset + windowSize,
        headers
      );
      buf = result.buffer;
      bufStart = currentOffset;
      if (result.fullFile) {
        bufStart = 0;
        haveFullFile = true;
      }
    }

    const parsed = parseIfd(buf, currentOffset - bufStart, format);
    if (parsed !== null) {
      currentOffset = parsed.nextIfdOffset;
      continue;
    }

    // Buffer too small to parse this IFD. Compute exact required size.
    const requiredSize = computeRequiredIfdSize(
      buf,
      currentOffset - bufStart,
      format
    );

    // If we have the full file and still can't parse, the file is truncated.
    if (haveFullFile) {
      throw new Error(
        `IFD at offset ${currentOffset} extends beyond end of file`
      );
    }

    // In fixed mode, the window size is the hard limit.
    if (opts.mode === 'fixed') {
      throw new Error(
        `IFD at offset ${currentOffset} requires ${requiredSize ?? '> entry-count header'} bytes, ` +
        `exceeds fixed window of ${windowSize} bytes`
      );
    }

    // Adaptive: fetch exactly the required size (or at least double the
    // current window, whichever is larger), clamped to maxWindowSize.
    const neededBytes = requiredSize ?? windowSize * 2;
    const retrySize = Math.min(
      Math.max(neededBytes, windowSize * 2),
      opts.maxWindowSize
    );

    if (requiredSize !== null && retrySize < requiredSize) {
      throw new Error(
        `IFD at offset ${currentOffset} requires ${requiredSize} bytes, ` +
        `exceeds maxWindowSize of ${opts.maxWindowSize} bytes`
      );
    }

    const retryResult = await fetchRange(
      url,
      currentOffset,
      currentOffset + retrySize,
      headers
    );
    buf = retryResult.buffer;
    bufStart = currentOffset;
    if (retryResult.fullFile) {
      bufStart = 0;
      haveFullFile = true;
    }

    const retry = parseIfd(buf, currentOffset - bufStart, format);
    if (retry === null) {
      throw new Error(
        `IFD at offset ${currentOffset} could not be parsed after retry ` +
        `(fetched ${retrySize} bytes, max=${opts.maxWindowSize})`
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
