// Shared validation rules for the customer upload endpoint (Stage 4 /
// Stage 9 security requirement — never trust client-declared file type
// alone). One place both the route and any future admin-side clipart
// upload can import from.

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export function isAllowedMimeType(mimeType: string): mimeType is AllowedUploadMimeType {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType);
}

export const MAX_UPLOAD_SIZE_BYTES =
  Number(process.env.MAX_UPLOAD_SIZE_MB ?? "10") * 1024 * 1024;

/**
 * Sniff the real file type from its magic bytes rather than trusting the
 * browser-supplied Content-Type, which is trivially spoofable. Returns
 * null if the bytes don't match any allowed format.
 */
export function sniffMimeType(buffer: Buffer): AllowedUploadMimeType | null {
  if (buffer.length >= 8 && buffer.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (buffer.length >= 3 && buffer.readUInt16BE(0) === 0xffd8) return "image/jpeg";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  // SVG is plain text — no magic bytes, so check for an <svg tag near the
  // start of the file instead (allowing for an XML prolog/BOM/whitespace).
  const head = buffer.subarray(0, 512).toString("utf-8").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return "image/svg+xml";
  return null;
}
