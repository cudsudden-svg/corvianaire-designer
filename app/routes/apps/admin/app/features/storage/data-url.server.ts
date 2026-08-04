// Decodes a `data:<mime>;base64,<...>` URL into raw bytes. Used by the
// Stage 7 design/production-file routes, which receive client-rendered
// canvas exports (fabric's toDataURL()) as data URLs rather than
// multipart file uploads — there's no <input type="file"> involved, so
// the existing multipart upload path (proxy.uploads.tsx) doesn't apply.
//
// Deliberately narrow: only image/png and image/jpeg are accepted, since
// those are the only formats fabric's canvas export can produce. Anything
// else is rejected rather than guessed at.
const ALLOWED_DATA_URL_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

export interface DecodedDataUrl {
  buffer: Buffer;
  mimeType: string;
}

export function decodeDataUrl(dataUrl: string): DecodedDataUrl | null {
  const match = /^data:([\w./+-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;

  const [, mimeType, base64] = match;
  if (!mimeType || !ALLOWED_DATA_URL_MIME_TYPES.has(mimeType)) return null;

  try {
    return { buffer: Buffer.from(base64!, "base64"), mimeType };
  } catch {
    return null;
  }
}

export function extensionForMimeType(mimeType: string): string {
  return mimeType === "image/jpeg" ? "jpg" : "png";
}
