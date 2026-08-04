// Serves files written by LocalStorageProvider. Only used in dev
// (STORAGE_PROVIDER=local) — in production with S3, getUrl() already
// points straight at the bucket/CDN and this route is never hit.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const key = params["*"];
  if (!key) {
    throw new Response("Not found", { status: 404 });
  }

  // Guard against path traversal — never allow ".." segments to escape
  // the upload root (Stage 9 security requirement, applied here at the
  // read path too, not just on upload).
  if (key.includes("..")) {
    throw new Response("Invalid path", { status: 400 });
  }

  const rootDir = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  const fullPath = path.join(rootDir, key);

  try {
    const stats = await stat(fullPath);
    const stream = createReadableStreamFromReadable(createReadStream(fullPath));

    return new Response(stream, {
      headers: {
        "Content-Length": String(stats.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    throw new Response("Not found", { status: 404 });
  }
};
