// getImageDimensions — reads pixel width/height straight from file bytes.
//
// Deliberately dependency-free (no `sharp`/`image-size`) — this is a Stage 4
// requirement, not a shortcut: the only formats the upload endpoint accepts
// (PNG, JPEG, WEBP, SVG) each have a tiny, stable header format, so a few
// dozen lines of buffer parsing avoids pulling in a native-binding image
// library just to read two integers. If a future format needs real decode
// (e.g. HEIC), swap the implementation here — callers only see
// `getImageDimensions(buffer, mimeType)`.

export interface ImageDimensions {
  widthPx: number;
  heightPx: number;
}

export function getImageDimensions(buffer: Buffer, mimeType: string): ImageDimensions {
  switch (mimeType) {
    case "image/png":
      return readPng(buffer);
    case "image/jpeg":
      return readJpeg(buffer);
    case "image/webp":
      return readWebp(buffer);
    case "image/svg+xml":
      return readSvg(buffer);
    default:
      throw new Error(`Cannot read dimensions for unsupported mime type "${mimeType}"`);
  }
}

function readPng(buffer: Buffer): ImageDimensions {
  // Signature (8 bytes) + IHDR chunk: length(4) type(4) width(4) height(4).
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error("Not a valid PNG file");
  }
  return {
    widthPx: buffer.readUInt32BE(16),
    heightPx: buffer.readUInt32BE(20),
  };
}

function readJpeg(buffer: Buffer): ImageDimensions {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) {
    throw new Error("Not a valid JPEG file");
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1]!;
    // SOF0-SOF15 markers carry the frame dimensions, except DHT(C4)/JPG(C8)/DAC(CC).
    const isSofMarker =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (isSofMarker) {
      return {
        heightPx: buffer.readUInt16BE(offset + 5),
        widthPx: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  throw new Error("Could not locate SOF marker in JPEG");
}

function readWebp(buffer: Buffer): ImageDimensions {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error("Not a valid WEBP file");
  }

  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8X") {
    // Extended format: 24-bit width-1 / height-1, little-endian, at offset 24/27.
    const widthMinusOne = buffer.readUIntLE(24, 3);
    const heightMinusOne = buffer.readUIntLE(27, 3);
    return { widthPx: widthMinusOne + 1, heightPx: heightMinusOne + 1 };
  }

  if (chunkType === "VP8 ") {
    // Lossy: 3-byte frame tag then a 0x9d 0x01 0x2a sync code, then two
    // 14-bit little-endian dimensions (top 2 bits of each are scaling flags).
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { widthPx: width, heightPx: height };
  }

  if (chunkType === "VP8L") {
    // Lossless: 1 signature byte (0x2f) then a packed 32-bit LE value —
    // 14 bits width-1, 14 bits height-1.
    const bits = buffer.readUInt32LE(21);
    const widthMinusOne = bits & 0x3fff;
    const heightMinusOne = (bits >> 14) & 0x3fff;
    return { widthPx: widthMinusOne + 1, heightPx: heightMinusOne + 1 };
  }

  throw new Error(`Unrecognized WEBP chunk type "${chunkType}"`);
}

function readSvg(buffer: Buffer): ImageDimensions {
  const text = buffer.toString("utf-8");
  const widthMatch = text.match(/width\s*=\s*["']?([\d.]+)/i);
  const heightMatch = text.match(/height\s*=\s*["']?([\d.]+)/i);

  if (widthMatch && heightMatch) {
    return { widthPx: Math.round(Number(widthMatch[1])), heightPx: Math.round(Number(heightMatch[1])) };
  }

  // Fall back to viewBox "minX minY width height" when explicit width/height
  // attributes are absent (common for hand-authored clipart SVGs).
  const viewBoxMatch = text.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/i);
  if (viewBoxMatch) {
    return { widthPx: Math.round(Number(viewBoxMatch[1])), heightPx: Math.round(Number(viewBoxMatch[2])) };
  }

  throw new Error("Could not determine SVG dimensions from width/height or viewBox");
}
