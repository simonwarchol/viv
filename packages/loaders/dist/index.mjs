import { BaseDecoder, fromBlob, fromFile, fromUrl, GeoTIFFImage, addDecoder } from 'geotiff';
import { decompress } from 'lzw-tiff-decoder';
import quickselect from 'quickselect';
import * as z from 'zod';
import { KeyError, openGroup, HTTPStore } from 'zarr';

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => {
  __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class LZWDecoder extends BaseDecoder {
  constructor(fileDirectory) {
    super();
    __publicField$3(this, "maxUncompressedSize");
    const width = fileDirectory.TileWidth || fileDirectory.ImageWidth;
    const height = fileDirectory.TileLength || fileDirectory.ImageLength;
    const nbytes = fileDirectory.BitsPerSample[0] / 8;
    this.maxUncompressedSize = width * height * nbytes;
  }
  async decodeBlock(buffer) {
    const bytes = new Uint8Array(buffer);
    const decoded = await decompress(bytes, this.maxUncompressedSize);
    return decoded.buffer;
  }
}

const DTYPE_LOOKUP$1 = {
  uint8: "Uint8",
  uint16: "Uint16",
  uint32: "Uint32",
  float: "Float32",
  double: "Float64",
  int8: "Int8",
  int16: "Int16",
  int32: "Int32"
};
function getChannelStats(arr) {
  let len = arr.length;
  let min = Infinity;
  let max = -Infinity;
  let total = 0;
  while (len--) {
    if (arr[len] < min) {
      min = arr[len];
    }
    if (arr[len] > max) {
      max = arr[len];
    }
    total += arr[len];
  }
  const mean = total / arr.length;
  len = arr.length;
  let sumSquared = 0;
  while (len--) {
    sumSquared += (arr[len] - mean) ** 2;
  }
  const sd = (sumSquared / arr.length) ** 0.5;
  const mid = Math.floor(arr.length / 2);
  const firstQuartileLocation = Math.floor(arr.length / 4);
  const thirdQuartileLocation = 3 * Math.floor(arr.length / 4);
  quickselect(arr, mid);
  const median = arr[mid];
  quickselect(arr, firstQuartileLocation, 0, mid);
  const q1 = arr[firstQuartileLocation];
  quickselect(arr, thirdQuartileLocation, mid, arr.length - 1);
  const q3 = arr[thirdQuartileLocation];
  const cutoffArr = arr.filter((i) => i > 0);
  const cutoffPercentile = 5e-4;
  const topCutoffLocation = Math.floor(
    cutoffArr.length * (1 - cutoffPercentile)
  );
  const bottomCutoffLocation = Math.floor(cutoffArr.length * cutoffPercentile);
  quickselect(cutoffArr, topCutoffLocation);
  quickselect(cutoffArr, bottomCutoffLocation, 0, topCutoffLocation);
  const contrastLimits = [
    cutoffArr[bottomCutoffLocation] || 0,
    cutoffArr[topCutoffLocation] || 0
  ];
  return {
    mean,
    sd,
    q1,
    q3,
    median,
    domain: [min, max],
    contrastLimits
  };
}
function intToRgba(int) {
  if (!Number.isInteger(int)) {
    throw Error("Not an integer.");
  }
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setInt32(0, int, false);
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes);
}
function isInterleaved(shape) {
  const lastDimSize = shape[shape.length - 1];
  return lastDimSize === 3 || lastDimSize === 4;
}
function getLabels(dimOrder) {
  return dimOrder.toLowerCase().split("").reverse();
}
function getImageSize(source) {
  const interleaved = isInterleaved(source.shape);
  const [height, width] = source.shape.slice(interleaved ? -3 : -2);
  return { height, width };
}
function prevPowerOf2(x) {
  return 2 ** Math.floor(Math.log2(x));
}
const SIGNAL_ABORTED = "__vivSignalAborted";
function guessTiffTileSize(image) {
  const tileWidth = image.getTileWidth();
  const tileHeight = image.getTileHeight();
  const size = Math.min(tileWidth, tileHeight);
  return prevPowerOf2(size);
}
function isElement(node) {
  return node.nodeType === 1;
}
function isText(node) {
  return node.nodeType === 3;
}
function xmlToJson(xmlNode, options) {
  if (isText(xmlNode)) {
    return xmlNode.nodeValue?.trim() ?? "";
  }
  if (xmlNode.childNodes.length === 0 && (!xmlNode.attributes || xmlNode.attributes.length === 0)) {
    return "";
  }
  const xmlObj = {};
  if (xmlNode.attributes && xmlNode.attributes.length > 0) {
    const attrsObj = {};
    for (let i = 0; i < xmlNode.attributes.length; i++) {
      const attr = xmlNode.attributes[i];
      attrsObj[attr.name] = attr.value;
    }
    xmlObj[options.attrtibutesKey] = attrsObj;
  }
  for (let i = 0; i < xmlNode.childNodes.length; i++) {
    const childNode = xmlNode.childNodes[i];
    if (!isElement(childNode)) {
      continue;
    }
    const childXmlObj = xmlToJson(childNode, options);
    if (childXmlObj !== void 0 && childXmlObj !== "") {
      if (childNode.nodeName === "#text" && xmlNode.childNodes.length === 1) {
        return childXmlObj;
      }
      if (xmlObj[childNode.nodeName]) {
        if (!Array.isArray(xmlObj[childNode.nodeName])) {
          xmlObj[childNode.nodeName] = [xmlObj[childNode.nodeName]];
        }
        xmlObj[childNode.nodeName].push(childXmlObj);
      } else {
        xmlObj[childNode.nodeName] = childXmlObj;
      }
    }
  }
  return xmlObj;
}
function parseXML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    xmlString.replace(/\u0000$/, ""),
    // eslint-disable-line no-control-regex
    "application/xml"
  );
  return xmlToJson(doc.documentElement, { attrtibutesKey: "attr" });
}
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assert failed${message ? `: ${message}` : ""}`);
  }
}

const VIV_PROXY_KEY = "__viv";
const OFFSETS_PROXY_KEY = `${VIV_PROXY_KEY}-offsets`;
function createOffsetsProxy(tiff, offsets) {
  const get = (target, key) => {
    if (key === "getImage") {
      return (index) => {
        if (!(index in target.ifdRequests) && index in offsets) {
          const offset = offsets[index];
          target.ifdRequests[index] = target.parseFileDirectoryAt(offset);
        }
        return target.getImage(index);
      };
    }
    if (key === OFFSETS_PROXY_KEY) {
      return true;
    }
    return Reflect.get(target, key);
  };
  return new Proxy(tiff, { get });
}

function extractPhysicalSizesfromOmeXml(d) {
  if (!d["PhysicalSizeX"] || !d["PhysicalSizeY"] || !d["PhysicalSizeXUnit"] || !d["PhysicalSizeYUnit"]) {
    return void 0;
  }
  const physicalSizes = {
    x: { size: d["PhysicalSizeX"], unit: d["PhysicalSizeXUnit"] },
    y: { size: d["PhysicalSizeY"], unit: d["PhysicalSizeYUnit"] }
  };
  if (d["PhysicalSizeZ"] && d["PhysicalSizeZUnit"]) {
    physicalSizes.z = {
      size: d["PhysicalSizeZ"],
      unit: d["PhysicalSizeZUnit"]
    };
  }
  return physicalSizes;
}
function getOmePixelSourceMeta({ Pixels }) {
  const labels = getLabels(Pixels.DimensionOrder);
  const shape = Array(labels.length).fill(0);
  shape[labels.indexOf("t")] = Pixels.SizeT;
  shape[labels.indexOf("c")] = Pixels.SizeC;
  shape[labels.indexOf("z")] = Pixels.SizeZ;
  if (Pixels.Interleaved) {
    labels.push("_c");
    shape.push(3);
  }
  const getShape = (level = 0) => {
    const s = [...shape];
    s[labels.indexOf("x")] = Pixels.SizeX >> level;
    s[labels.indexOf("y")] = Pixels.SizeY >> level;
    return s;
  };
  if (!(Pixels.Type in DTYPE_LOOKUP$1)) {
    throw Error(`Pixel type ${Pixels.Type} not supported.`);
  }
  const dtype = DTYPE_LOOKUP$1[Pixels.Type];
  const maybePhysicalSizes = extractPhysicalSizesfromOmeXml(Pixels);
  if (maybePhysicalSizes) {
    return { labels, getShape, dtype, physicalSizes: maybePhysicalSizes };
  }
  return { labels, getShape, dtype };
}
function guessImageDataType(image) {
  const sampleIndex = 0;
  const format = image.fileDirectory.SampleFormat ? image.fileDirectory.SampleFormat[sampleIndex] : 1;
  const bitsPerSample = image.fileDirectory.BitsPerSample[sampleIndex];
  switch (format) {
    case 1:
      if (bitsPerSample <= 8) {
        return DTYPE_LOOKUP$1.uint8;
      }
      if (bitsPerSample <= 16) {
        return DTYPE_LOOKUP$1.uint16;
      }
      if (bitsPerSample <= 32) {
        return DTYPE_LOOKUP$1.uint32;
      }
      break;
    case 2:
      if (bitsPerSample <= 8) {
        return DTYPE_LOOKUP$1.int8;
      }
      if (bitsPerSample <= 16) {
        return DTYPE_LOOKUP$1.int16;
      }
      if (bitsPerSample <= 32) {
        return DTYPE_LOOKUP$1.int32;
      }
      break;
    case 3:
      switch (bitsPerSample) {
        case 16:
          return DTYPE_LOOKUP$1.float;
        case 32:
          return DTYPE_LOOKUP$1.float;
        case 64:
          return DTYPE_LOOKUP$1.double;
      }
      break;
  }
  throw Error("Unsupported data format/bitsPerSample");
}
function getMultiTiffShapeMap(tiffs) {
  let [c, z, t] = [0, 0, 0];
  for (const tiff of tiffs) {
    c = Math.max(c, tiff.selection.c);
    z = Math.max(z, tiff.selection.z);
    t = Math.max(t, tiff.selection.t);
  }
  const firstTiff = tiffs[0].tiff;
  return {
    x: firstTiff.getWidth(),
    y: firstTiff.getHeight(),
    z: z + 1,
    c: c + 1,
    t: t + 1
  };
}
function getChannelSamplesPerPixel(tiffs, numChannels) {
  const channelSamplesPerPixel = Array(numChannels).fill(0);
  for (const tiff of tiffs) {
    const curChannel = tiff.selection.c;
    const curSamplesPerPixel = tiff.tiff.getSamplesPerPixel();
    const existingSamplesPerPixel = channelSamplesPerPixel[curChannel];
    if (existingSamplesPerPixel && existingSamplesPerPixel != curSamplesPerPixel) {
      throw Error("Channel samples per pixel mismatch");
    }
    channelSamplesPerPixel[curChannel] = curSamplesPerPixel;
  }
  return channelSamplesPerPixel;
}
function getMultiTiffMeta(dimensionOrder, tiffs) {
  const firstTiff = tiffs[0].tiff;
  const shapeMap = getMultiTiffShapeMap(tiffs);
  const shape = [];
  for (const dim of dimensionOrder.toLowerCase()) {
    shape.unshift(shapeMap[dim]);
  }
  const labels = getLabels(dimensionOrder);
  const dtype = guessImageDataType(firstTiff);
  return { shape, labels, dtype };
}
function getMultiTiffPixelMedatata(imageNumber, dimensionOrder, shapeMap, dType, tiffs, channelNames, channelSamplesPerPixel) {
  const channelMetadata = [];
  for (let i = 0; i < shapeMap.c; i += 1) {
    channelMetadata.push({
      ID: `Channel:${imageNumber}:${i}`,
      Name: channelNames[i],
      SamplesPerPixel: channelSamplesPerPixel[i]
    });
  }
  return {
    BigEndian: !tiffs[0].tiff.littleEndian,
    DimensionOrder: dimensionOrder,
    ID: `Pixels:${imageNumber}`,
    SizeC: shapeMap.c,
    SizeT: shapeMap.t,
    SizeX: shapeMap.x,
    SizeY: shapeMap.y,
    SizeZ: shapeMap.z,
    Type: dType,
    Channels: channelMetadata
  };
}
function getMultiTiffMetadata(imageName, tiffImages, channelNames, dimensionOrder, dType) {
  const imageNumber = 0;
  const id = `Image:${imageNumber}`;
  const date = "";
  const description = "";
  const shapeMap = getMultiTiffShapeMap(tiffImages);
  const channelSamplesPerPixel = getChannelSamplesPerPixel(
    tiffImages,
    shapeMap.c
  );
  if (channelNames.length !== shapeMap.c)
    throw Error(
      "Wrong number of channel names for number of channels provided"
    );
  const pixels = getMultiTiffPixelMedatata(
    imageNumber,
    dimensionOrder,
    shapeMap,
    dType,
    tiffImages,
    channelNames,
    channelSamplesPerPixel
  );
  const format = () => {
    return {
      "Acquisition Date": date,
      "Dimensions (XY)": `${shapeMap.x} x ${shapeMap.y}`,
      PixelsType: dType,
      "Z-sections/Timepoints": `${shapeMap.z} x ${shapeMap.t}`,
      Channels: shapeMap.c
    };
  };
  return {
    ID: id,
    Name: imageName,
    AcquisitionDate: date,
    Description: description,
    Pixels: pixels,
    format
  };
}
function parseFilename(path) {
  const parsedFilename = {};
  const filename = path.split("/").pop();
  const splitFilename = filename?.split(".");
  if (splitFilename) {
    parsedFilename.name = splitFilename.slice(0, -1).join(".");
    [, parsedFilename.extension] = splitFilename;
  }
  return parsedFilename;
}
function createGeoTiffObject(source, { headers }) {
  if (source instanceof Blob) {
    return fromBlob(source);
  }
  const url = typeof source === "string" ? new URL(source) : source;
  if (url.protocol === "file:") {
    return fromFile(url.pathname);
  }
  return fromUrl(url.href, { headers, cacheSize: Infinity });
}
async function createGeoTiff(source, options = {}) {
  const tiff = await createGeoTiffObject(source, options);
  return options.offsets ? createOffsetsProxy(tiff, options.offsets) : tiff;
}

function flattenAttributes({
  attr,
  ...rest
}) {
  return { ...attr, ...rest };
}
function ensureArray(x) {
  return Array.isArray(x) ? x : [x];
}
const DimensionOrderSchema = z.enum([
  "XYZCT",
  "XYZTC",
  "XYCTZ",
  "XYCZT",
  "XYTCZ",
  "XYTZC"
]);
const PixelTypeSchema = z.enum([
  "int8",
  "int16",
  "int32",
  "uint8",
  "uint16",
  "uint32",
  "float",
  "bit",
  "double",
  "complex",
  "double-complex"
]);
const PhysicalUnitSchema = z.enum([
  "Ym",
  "Zm",
  "Em",
  "Pm",
  "Tm",
  "Gm",
  "Mm",
  "km",
  "hm",
  "dam",
  "m",
  "dm",
  "cm",
  "mm",
  "\xB5m",
  "nm",
  "pm",
  "fm",
  "am",
  "zm",
  "ym",
  "\xC5",
  "thou",
  "li",
  "in",
  "ft",
  "yd",
  "mi",
  "ua",
  "ly",
  "pc",
  "pt",
  "pixel",
  "reference frame"
]);
const ChannelSchema = z.object({}).extend({
  attr: z.object({
    ID: z.string(),
    SamplesPerPixel: z.coerce.number().optional(),
    Name: z.string().optional(),
    Color: z.coerce.number().transform(intToRgba).optional()
  })
}).transform(flattenAttributes);
const UuidSchema = z.object({}).extend({
  attr: z.object({
    FileName: z.string()
  })
}).transform(flattenAttributes);
const TiffDataSchema = z.object({ UUID: UuidSchema.optional() }).extend({
  attr: z.object({
    IFD: z.coerce.number(),
    PlaneCount: z.coerce.number(),
    FirstT: z.coerce.number().optional(),
    FirstC: z.coerce.number().optional(),
    FirstZ: z.coerce.number().optional()
  })
}).transform(flattenAttributes);
const PixelsSchema = z.object({
  Channel: z.preprocess(ensureArray, ChannelSchema.array()),
  TiffData: z.preprocess(ensureArray, TiffDataSchema.array()).optional()
}).extend({
  attr: z.object({
    ID: z.string(),
    DimensionOrder: DimensionOrderSchema,
    Type: PixelTypeSchema,
    SizeT: z.coerce.number(),
    SizeC: z.coerce.number(),
    SizeZ: z.coerce.number(),
    SizeY: z.coerce.number(),
    SizeX: z.coerce.number(),
    PhysicalSizeX: z.coerce.number().optional(),
    PhysicalSizeY: z.coerce.number().optional(),
    PhysicalSizeZ: z.coerce.number().optional(),
    SignificantBits: z.coerce.number().optional(),
    PhysicalSizeXUnit: PhysicalUnitSchema.optional().default("\xB5m"),
    PhysicalSizeYUnit: PhysicalUnitSchema.optional().default("\xB5m"),
    PhysicalSizeZUnit: PhysicalUnitSchema.optional().default("\xB5m"),
    BigEndian: z.string().transform((v) => v.toLowerCase() === "true").optional(),
    Interleaved: z.string().transform((v) => v.toLowerCase() === "true").optional()
  })
}).transform(flattenAttributes).transform(({ Channel, ...rest }) => ({ Channels: Channel, ...rest }));
const ImageSchema = z.object({
  AquisitionDate: z.string().optional().default(""),
  Description: z.unknown().optional().default(""),
  Pixels: PixelsSchema
}).extend({
  attr: z.object({
    ID: z.string(),
    Name: z.string().optional()
  })
}).transform(flattenAttributes);
const OmeSchema = z.object({
  Image: z.preprocess(ensureArray, ImageSchema.array())
}).extend({
  attr: z.object({
    xmlns: z.string(),
    "xmlns:xsi": z.string(),
    "xsi:schemaLocation": z.string()
  })
}).transform(flattenAttributes);
function fromString(str) {
  const raw = parseXML(str);
  const omeXml = OmeSchema.parse(raw);
  return omeXml["Image"].map((img) => {
    return {
      ...img,
      format() {
        const sizes = ["X", "Y", "Z"].map((name) => {
          const size = img.Pixels[`PhysicalSize${name}`];
          const unit = img.Pixels[`PhysicalSize${name}Unit`];
          return size ? `${size} ${unit}` : "-";
        }).join(" x ");
        return {
          "Acquisition Date": img.AquisitionDate,
          "Dimensions (XY)": `${img.Pixels["SizeX"]} x ${img.Pixels["SizeY"]}`,
          "Pixels Type": img.Pixels["Type"],
          "Pixels Size (XYZ)": sizes,
          "Z-sections/Timepoints": `${img.Pixels["SizeZ"]} x ${img.Pixels["SizeT"]}`,
          Channels: img.Pixels["SizeC"]
        };
      }
    };
  });
}

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => {
  __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class TiffPixelSource {
  constructor(indexer, dtype, tileSize, shape, labels, meta, pool) {
    this.dtype = dtype;
    this.tileSize = tileSize;
    this.shape = shape;
    this.labels = labels;
    this.meta = meta;
    this.pool = pool;
    __publicField$2(this, "_indexer");
    this._indexer = indexer;
  }
  async getRaster({ selection, signal }) {
    const image = await this._indexer(selection);
    return this._readRasters(image, { signal });
  }
  async getTile({ x, y, selection, signal }) {
    const { height, width } = this._getTileExtent(x, y);
    const x0 = x * this.tileSize;
    const y0 = y * this.tileSize;
    const window = [x0, y0, x0 + width, y0 + height];
    const image = await this._indexer(selection);
    return this._readRasters(image, { window, width, height, signal });
  }
  async _readRasters(image, props) {
    const interleave = isInterleaved(this.shape);
    const raster = await image.readRasters({
      interleave,
      ...props,
      pool: this.pool
    });
    if (props?.signal?.aborted) {
      throw SIGNAL_ABORTED;
    }
    const data = interleave ? raster : raster[0];
    return {
      data,
      width: raster.width,
      height: raster.height
    };
  }
  /*
   * Computes tile size given x, y coord.
   */
  _getTileExtent(x, y) {
    const { height: zoomLevelHeight, width: zoomLevelWidth } = getImageSize(this);
    let height = this.tileSize;
    let width = this.tileSize;
    const maxXTileCoord = Math.floor(zoomLevelWidth / this.tileSize);
    const maxYTileCoord = Math.floor(zoomLevelHeight / this.tileSize);
    if (x === maxXTileCoord) {
      width = zoomLevelWidth % this.tileSize;
    }
    if (y === maxYTileCoord) {
      height = zoomLevelHeight % this.tileSize;
    }
    return { height, width };
  }
  onTileError(err) {
    console.error(err);
  }
}

function getOmeLegacyIndexer(tiff, rootMeta) {
  const { SizeT, SizeC, SizeZ } = rootMeta[0].Pixels;
  const ifdIndexer = getOmeIFDIndexer(rootMeta, 0);
  return (sel, pyramidLevel) => {
    const index = ifdIndexer(sel);
    const pyramidIndex = pyramidLevel * SizeZ * SizeT * SizeC;
    return tiff.getImage(index + pyramidIndex);
  };
}
function getOmeSubIFDIndexer(tiff, rootMeta, image = 0) {
  const ifdIndexer = getOmeIFDIndexer(rootMeta, image);
  const ifdCache = /* @__PURE__ */ new Map();
  return async (sel, pyramidLevel) => {
    const index = ifdIndexer(sel);
    const baseImage = await tiff.getImage(index);
    if (pyramidLevel === 0) {
      return baseImage;
    }
    const { SubIFDs } = baseImage.fileDirectory;
    if (!SubIFDs) {
      throw Error("Indexing Error: OME-TIFF is missing SubIFDs.");
    }
    const key = `${sel.t}-${sel.c}-${sel.z}-${pyramidLevel}`;
    if (!ifdCache.has(key)) {
      const subIfdOffset = SubIFDs[pyramidLevel - 1];
      ifdCache.set(key, tiff.parseFileDirectoryAt(subIfdOffset));
    }
    const ifd = await ifdCache.get(key);
    return new GeoTIFFImage(
      ifd.fileDirectory,
      ifd.geoKeyDirectory,
      baseImage.dataView,
      tiff.littleEndian,
      tiff.cache,
      tiff.source
    );
  };
}
function getOmeIFDIndexer(rootMeta, image = 0) {
  const { SizeC, SizeZ, SizeT, DimensionOrder } = rootMeta[image].Pixels;
  let imageOffset = 0;
  if (image > 0) {
    for (let i = 0; i < image; i += 1) {
      const {
        SizeC: prevSizeC,
        SizeZ: prevSizeZ,
        SizeT: prevSizeT
      } = rootMeta[i].Pixels;
      imageOffset += prevSizeC * prevSizeZ * prevSizeT;
    }
  }
  switch (DimensionOrder) {
    case "XYZCT": {
      return ({ t, c, z }) => imageOffset + t * SizeZ * SizeC + c * SizeZ + z;
    }
    case "XYZTC": {
      return ({ t, c, z }) => imageOffset + c * SizeZ * SizeT + t * SizeZ + z;
    }
    case "XYCTZ": {
      return ({ t, c, z }) => imageOffset + z * SizeC * SizeT + t * SizeC + c;
    }
    case "XYCZT": {
      return ({ t, c, z }) => imageOffset + t * SizeC * SizeZ + z * SizeC + c;
    }
    case "XYTCZ": {
      return ({ t, c, z }) => imageOffset + z * SizeT * SizeC + c * SizeT + t;
    }
    case "XYTZC": {
      return ({ t, c, z }) => imageOffset + c * SizeT * SizeZ + z * SizeT + t;
    }
    default: {
      throw new Error(`Invalid OME-XML DimensionOrder, got ${DimensionOrder}.`);
    }
  }
}
function getMultiTiffIndexer(tiffs) {
  function selectionToKey({ c = 0, t = 0, z = 0 }) {
    return `${c}-${t}-${z}`;
  }
  const lookup = new Map(
    tiffs.map(({ selection, tiff }) => [selectionToKey(selection), tiff])
  );
  return async (sel) => {
    const key = selectionToKey(sel);
    const img = lookup.get(key);
    if (!img)
      throw new Error(`No image available for selection ${key}`);
    return img;
  };
}

function getIndexer$1(tiff, omexml, SubIFDs, image) {
  if (SubIFDs) {
    return getOmeSubIFDIndexer(tiff, omexml, image);
  }
  return getOmeLegacyIndexer(tiff, omexml);
}
async function loadSingleFileOmeTiff(source, options = {}) {
  const tiff = await createGeoTiff(source, {
    headers: options.headers,
    offsets: options.offsets
  });
  const firstImage = await tiff.getImage();
  const {
    ImageDescription,
    SubIFDs,
    PhotometricInterpretation: photometricInterpretation
  } = firstImage.fileDirectory;
  const omexml = fromString(ImageDescription);
  let rootMeta = omexml;
  let levels;
  if (SubIFDs) {
    levels = SubIFDs.length + 1;
  } else {
    levels = omexml.length;
    rootMeta = [omexml[0]];
  }
  const getSource = (resolution, pyramidIndexer, imgMeta) => {
    const { labels, getShape, physicalSizes, dtype } = getOmePixelSourceMeta(imgMeta);
    const tileSize = guessTiffTileSize(firstImage);
    const meta = { photometricInterpretation, physicalSizes };
    const shape = getShape(resolution);
    const indexer = (sel) => pyramidIndexer(sel, resolution);
    const source2 = new TiffPixelSource(
      indexer,
      dtype,
      tileSize,
      shape,
      labels,
      meta,
      options.pool
    );
    return source2;
  };
  return rootMeta.map((imgMeta, image) => {
    const pyramidIndexer = getIndexer$1(tiff, omexml, SubIFDs, image);
    const data = Array.from({ length: levels }).map(
      (_, resolution) => getSource(resolution, pyramidIndexer, imgMeta)
    );
    return {
      data,
      metadata: imgMeta
    };
  });
}

function isCompleteTiffDataItem(item) {
  return "FirstC" in item && "FirstT" in item && "FirstZ" in item && "IFD" in item && "UUID" in item;
}
function createMultifileImageDataLookup(omexml) {
  const lookup = /* @__PURE__ */ new Map();
  function keyFor({ t, c, z }) {
    return `t${t}.c${c}.z${z}`;
  }
  assert(omexml["Pixels"]["TiffData"], "No TiffData in OME-XML");
  for (const imageData of omexml["Pixels"]["TiffData"]) {
    assert(isCompleteTiffDataItem(imageData), "Incomplete TiffData item");
    const key = keyFor({
      t: imageData["FirstT"],
      c: imageData["FirstC"],
      z: imageData["FirstZ"]
    });
    const imageDataPointer = {
      ifd: imageData["IFD"],
      filename: imageData["UUID"]["FileName"]
    };
    lookup.set(key, imageDataPointer);
  }
  return {
    getImageDataPointer(selection) {
      const entry = lookup.get(keyFor(selection));
      assert(entry, `No image for selection: ${JSON.stringify(selection)}`);
      return entry;
    }
  };
}
function createMultifileOmeTiffIndexer(imgMeta, tiffResolver) {
  const lookup = createMultifileImageDataLookup(imgMeta);
  return async (selection) => {
    const entry = lookup.getImageDataPointer(selection);
    const tiff = await tiffResolver.resolve(entry.filename);
    const image = await tiff.getImage(entry.ifd);
    return image;
  };
}
function multifileTiffResolver(options) {
  const tiffs = /* @__PURE__ */ new Map();
  return {
    async resolve(identifier) {
      if (!tiffs.has(identifier)) {
        const url = new URL(identifier, options.baseUrl);
        const tiff = await createGeoTiff(url, options);
        tiffs.set(identifier, tiff);
      }
      return tiffs.get(identifier);
    }
  };
}
async function loadMultifileOmeTiff(source, options) {
  assert(
    !(source instanceof File),
    "File or Blob not supported for multifile OME-TIFF"
  );
  const url = new URL(source);
  const text = await fetch(url).then((res) => res.text());
  const rootMeta = fromString(text);
  const resolver = multifileTiffResolver({ baseUrl: url });
  const promises = rootMeta.map(async (imgMeta) => {
    const indexer = createMultifileOmeTiffIndexer(imgMeta, resolver);
    const { labels, getShape, physicalSizes, dtype } = getOmePixelSourceMeta(imgMeta);
    const firstImage = await indexer({ c: 0, t: 0, z: 0 });
    const source2 = new TiffPixelSource(
      indexer,
      dtype,
      guessTiffTileSize(firstImage),
      getShape(0),
      labels,
      { physicalSizes },
      options.pool
    );
    return {
      data: [source2],
      metadata: imgMeta
    };
  });
  return Promise.all(promises);
}

function assertSameResolution(images) {
  const width = images[0].tiff.getWidth();
  const height = images[0].tiff.getHeight();
  for (const image of images) {
    if (image.tiff.getWidth() !== width || image.tiff.getHeight() !== height) {
      throw new Error(`All images must have the same width and height`);
    }
  }
}
async function assertCompleteStack(images, indexer) {
  for (let t = 0; t <= Math.max(...images.map((i) => i.selection.t)); t += 1) {
    for (let c = 0; c <= Math.max(...images.map((i) => i.selection.c)); c += 1) {
      for (let z = 0; z <= Math.max(...images.map((i) => i.selection.z)); z += 1) {
        await indexer({ t, c, z });
      }
    }
  }
}
async function load$2(imageName, images, channelNames, pool) {
  assertSameResolution(images);
  const firstImage = images[0].tiff;
  const { PhotometricInterpretation: photometricInterpretation } = firstImage.fileDirectory;
  const dimensionOrder = "XYZCT";
  const tileSize = guessTiffTileSize(firstImage);
  const meta = { photometricInterpretation };
  const indexer = getMultiTiffIndexer(images);
  const { shape, labels, dtype } = getMultiTiffMeta(dimensionOrder, images);
  const metadata = getMultiTiffMetadata(
    imageName,
    images,
    channelNames,
    dimensionOrder,
    dtype
  );
  await assertCompleteStack(images, indexer);
  const source = new TiffPixelSource(
    indexer,
    dtype,
    tileSize,
    shape,
    labels,
    meta,
    pool
  );
  return {
    data: [source],
    metadata
  };
}

addDecoder(5, () => LZWDecoder);
function isSupportedCompanionOmeTiffFile(source) {
  return typeof source === "string" && source.endsWith(".companion.ome");
}
async function loadOmeTiff(source, opts = {}) {
  const load = isSupportedCompanionOmeTiffFile(source) ? loadMultifileOmeTiff : loadSingleFileOmeTiff;
  const loaders = await load(source, opts);
  return opts.images === "all" ? loaders : loaders[0];
}
function getImageSelectionName(imageName, imageNumber, imageSelections) {
  return imageSelections.length === 1 ? imageName : imageName + `_${imageNumber.toString()}`;
}
async function loadMultiTiff(sources, opts = {}) {
  const { pool, headers = {}, name = "MultiTiff" } = opts;
  const tiffImage = [];
  const channelNames = [];
  for (const source of sources) {
    const [s, file] = source;
    const imageSelections = Array.isArray(s) ? s : [s];
    if (typeof file === "string") {
      const parsedFilename = parseFilename(file);
      const extension = parsedFilename.extension?.toLowerCase();
      if (extension === "tif" || extension === "tiff") {
        const tiffImageName = parsedFilename.name;
        if (tiffImageName) {
          const curImage = await createGeoTiff(file, {
            headers
          });
          for (let i = 0; i < imageSelections.length; i++) {
            const curSelection = imageSelections[i];
            if (curSelection) {
              const tiff = await curImage.getImage(i);
              tiffImage.push({ selection: curSelection, tiff });
              channelNames[curSelection.c] = getImageSelectionName(
                tiffImageName,
                i,
                imageSelections
              );
            }
          }
        }
      }
    } else {
      const { name: name2 } = parseFilename(file.path);
      if (name2) {
        const curImage = await fromBlob(file);
        for (let i = 0; i < imageSelections.length; i++) {
          const curSelection = imageSelections[i];
          if (curSelection) {
            const tiff = await curImage.getImage(i);
            tiffImage.push({ selection: curSelection, tiff });
            channelNames[curSelection.c] = getImageSelectionName(
              name2,
              i,
              imageSelections
            );
          }
        }
      }
    }
  }
  if (tiffImage.length > 0) {
    return load$2(name, tiffImage, opts.channelNames || channelNames, pool);
  }
  throw new Error("Unable to load image from provided TiffFolder source.");
}

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
function joinUrlParts(...args) {
  return args.map((part, i) => {
    if (i === 0)
      return part.trim().replace(/[/]*$/g, "");
    return part.trim().replace(/(^[/]*|[/]*$)/g, "");
  }).filter((x) => x.length).join("/");
}
class ReadOnlyStore {
  async keys() {
    return [];
  }
  async deleteItem() {
    return false;
  }
  async setItem() {
    console.warn("Cannot write to read-only store.");
    return false;
  }
}
class FileStore extends ReadOnlyStore {
  constructor(fileMap, rootPrefix = "") {
    super();
    __publicField$1(this, "_map");
    __publicField$1(this, "_rootPrefix");
    this._map = fileMap;
    this._rootPrefix = rootPrefix;
  }
  _key(key) {
    return joinUrlParts(this._rootPrefix, key);
  }
  async getItem(key) {
    const file = this._map.get(this._key(key));
    if (!file) {
      throw new KeyError(key);
    }
    const buffer = await file.arrayBuffer();
    return buffer;
  }
  async containsItem(key) {
    const path = this._key(key);
    return this._map.has(path);
  }
}

function isOmeZarr(dataShape, Pixels) {
  const { SizeT, SizeC, SizeZ, SizeY, SizeX } = Pixels;
  const omeZarrShape = [SizeT, SizeC, SizeZ, SizeY, SizeX];
  return dataShape.every((size, i) => omeZarrShape[i] === size);
}
function guessBioformatsLabels({ shape }, { Pixels }) {
  if (isOmeZarr(shape, Pixels)) {
    return getLabels("XYZCT");
  }
  const labels = getLabels(Pixels.DimensionOrder);
  labels.forEach((lower, i) => {
    const label = lower.toUpperCase();
    const xmlSize = Pixels[`Size${label}`];
    if (!xmlSize) {
      throw Error(`Dimension ${label} is invalid for OME-XML.`);
    }
    if (shape[i] !== xmlSize) {
      throw Error("Dimension mismatch between zarr source and OME-XML.");
    }
  });
  return labels;
}
function getRootPrefix(files, rootName) {
  const first = files.find((f) => f.path.indexOf(rootName) > 0);
  if (!first) {
    throw Error("Could not find root in store.");
  }
  const prefixLength = first.path.indexOf(rootName) + rootName.length;
  return first.path.slice(0, prefixLength);
}
function isAxis(axisOrLabel) {
  return typeof axisOrLabel[0] !== "string";
}
function castLabels(dimnames) {
  return dimnames;
}
async function loadMultiscales(store, path = "") {
  const grp = await openGroup(store, path);
  const rootAttrs = await grp.attrs.asObject();
  let paths = ["0"];
  let labels = castLabels(["t", "c", "z", "y", "x"]);
  if ("multiscales" in rootAttrs) {
    const { datasets, axes } = rootAttrs.multiscales[0];
    paths = datasets.map((d) => d.path);
    if (axes) {
      if (isAxis(axes)) {
        labels = castLabels(axes.map((axis) => axis.name));
      } else {
        labels = castLabels(axes);
      }
    }
  }
  const data = paths.map((path2) => grp.getItem(path2));
  return {
    data: await Promise.all(data),
    rootAttrs,
    labels
  };
}
function guessTileSize(arr) {
  const interleaved = isInterleaved(arr.shape);
  const [yChunk, xChunk] = arr.chunks.slice(interleaved ? -3 : -2);
  const size = Math.min(yChunk, xChunk);
  return prevPowerOf2(size);
}

function getIndexer(labels) {
  const labelSet = new Set(labels);
  if (labelSet.size !== labels.length) {
    throw new Error("Labels must be unique");
  }
  return (sel) => {
    if (Array.isArray(sel)) {
      return [...sel];
    }
    const selection = Array(labels.length).fill(0);
    for (const [key, value] of Object.entries(sel)) {
      const index = labels.indexOf(key);
      if (index === -1) {
        throw new Error(`Invalid indexer key: ${key}`);
      }
      selection[index] = value;
    }
    return selection;
  };
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const DTYPE_LOOKUP = {
  u1: "Uint8",
  u2: "Uint16",
  u4: "Uint32",
  f4: "Float32",
  f8: "Float64",
  i1: "Int8",
  i2: "Int16",
  i4: "Int32"
};
function slice(start, stop) {
  return { start, stop, step: 1, _slice: true };
}
class BoundsCheckError extends Error {
}
class ZarrPixelSource {
  constructor(data, labels, tileSize) {
    this.labels = labels;
    this.tileSize = tileSize;
    __publicField(this, "_data");
    __publicField(this, "_indexer");
    this._indexer = getIndexer(labels);
    this._data = data;
  }
  get shape() {
    return this._data.shape;
  }
  get dtype() {
    const suffix = this._data.dtype.slice(1);
    if (!(suffix in DTYPE_LOOKUP)) {
      throw Error(`Zarr dtype not supported, got ${suffix}.`);
    }
    return DTYPE_LOOKUP[suffix];
  }
  get _xIndex() {
    const interleave = isInterleaved(this._data.shape);
    return this._data.shape.length - (interleave ? 2 : 1);
  }
  _chunkIndex(selection, { x, y }) {
    const sel = this._indexer(selection);
    sel[this._xIndex] = x;
    sel[this._xIndex - 1] = y;
    return sel;
  }
  /**
   * Converts x, y tile indices to zarr dimension Slices within image bounds.
   */
  _getSlices(x, y) {
    const { height, width } = getImageSize(this);
    const [xStart, xStop] = [
      x * this.tileSize,
      Math.min((x + 1) * this.tileSize, width)
    ];
    const [yStart, yStop] = [
      y * this.tileSize,
      Math.min((y + 1) * this.tileSize, height)
    ];
    if (xStart === xStop || yStart === yStop) {
      throw new BoundsCheckError("Tile slice is zero-sized.");
    } else if (xStart < 0 || yStart < 0 || xStop > width || yStop > height) {
      throw new BoundsCheckError("Tile slice is out of bounds.");
    }
    return [slice(xStart, xStop), slice(yStart, yStop)];
  }
  async _getRaw(selection, getOptions) {
    const result = await this._data.getRaw(selection, getOptions);
    if (typeof result !== "object") {
      throw new Error("Expected object from getRaw");
    }
    return result;
  }
  async getRaster({
    selection,
    signal
  }) {
    const sel = this._chunkIndex(selection, { x: null, y: null });
    const result = await this._getRaw(sel, { storeOptions: { signal } });
    const {
      data,
      shape: [height, width]
    } = result;
    return { data, width, height };
  }
  async getTile(props) {
    const { x, y, selection, signal } = props;
    const [xSlice, ySlice] = this._getSlices(x, y);
    const sel = this._chunkIndex(selection, { x: xSlice, y: ySlice });
    const tile = await this._getRaw(sel, { storeOptions: { signal } });
    const {
      data,
      shape: [height, width]
    } = tile;
    return { data, height, width };
  }
  onTileError(err) {
    if (!(err instanceof BoundsCheckError)) {
      throw err;
    }
  }
}

async function load$1(root, xmlSource) {
  if (typeof xmlSource !== "string") {
    xmlSource = await xmlSource.text();
  }
  const imgMeta = fromString(xmlSource)[0];
  const { data } = await loadMultiscales(root, "0");
  const labels = guessBioformatsLabels(data[0], imgMeta);
  const tileSize = guessTileSize(data[0]);
  const pyramid = data.map((arr) => new ZarrPixelSource(arr, labels, tileSize));
  return {
    data: pyramid,
    metadata: imgMeta
  };
}

async function load(store) {
  const { data, rootAttrs, labels } = await loadMultiscales(store);
  const tileSize = guessTileSize(data[0]);
  const pyramid = data.map((arr) => new ZarrPixelSource(arr, labels, tileSize));
  return {
    data: pyramid,
    metadata: rootAttrs
  };
}

async function loadBioformatsZarr(source, options = {}) {
  const METADATA = "METADATA.ome.xml";
  const ZARR_DIR = "data.zarr";
  if (typeof source === "string") {
    const url = source.endsWith("/") ? source.slice(0, -1) : source;
    const store2 = new HTTPStore(url + "/" + ZARR_DIR, options);
    const xmlSource = await fetch(url + "/" + METADATA, options.fetchOptions);
    if (!xmlSource.ok) {
      throw Error("No OME-XML metadata found for store.");
    }
    return load$1(store2, xmlSource);
  }
  const fMap = /* @__PURE__ */ new Map();
  let xmlFile;
  for (const file of source) {
    if (file.name === METADATA) {
      xmlFile = file;
    } else {
      fMap.set(file.path, file);
    }
  }
  if (!xmlFile) {
    throw Error("No OME-XML metadata found for store.");
  }
  const store = new FileStore(fMap, getRootPrefix(source, ZARR_DIR));
  return load$1(store, xmlFile);
}
async function loadOmeZarr(source, options = {}) {
  const store = new HTTPStore(source, options);
  if (options?.type !== "multiscales") {
    throw Error("Only multiscale OME-Zarr is supported.");
  }
  return load(store);
}

export { SIGNAL_ABORTED, TiffPixelSource, ZarrPixelSource, getChannelStats, getImageSize, isInterleaved, loadBioformatsZarr, loadMultiTiff, loadOmeTiff, loadOmeZarr };
