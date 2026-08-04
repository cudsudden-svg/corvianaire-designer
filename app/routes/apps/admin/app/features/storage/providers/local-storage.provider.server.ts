// LocalStorageProvider — writes uploads to disk under LOCAL_UPLOAD_DIR.
//
// Used when STORAGE_PROVIDER=local (the dev default). Files are served
// back out through the /uploads/* Remix resource route (see
// app/routes/uploads.$.tsx) rather than Remix's static public/ folder,
// since uploads are written at runtime and public/ is only for
// build-time static assets.
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetStorageProvider, UploadInput, UploadResult } from "../types";

export class LocalStorageProvider implements AssetStorageProvider {
  readonly name = "local";

  private readonly rootDir: string;
  private readonly publicBaseUrl: string;

  constructor(options?: { rootDir?: string; publicBaseUrl?: string }) {
    this.rootDir = options?.rootDir ?? process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
    // In dev this is just the app's own origin; the resource route below
    // streams the file back regardless of where SHOPIFY_APP_URL points.
    this.publicBaseUrl = options?.publicBaseUrl ?? "/uploads";
  }

  async upload({ buffer, fileName, folder }: UploadInput): Promise<UploadResult> {
    const safeExt = path.extname(fileName).toLowerCase();
    const key = `${folder}/${randomUUID()}${safeExt}`;
    const fullPath = path.join(this.rootDir, key);

    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    return {
      url: this.getUrl(key),
      key,
      sizeBytes: buffer.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.rootDir, key);
    try {
      await unlink(fullPath);
    } catch (error) {
      // Deleting something already gone shouldn't crash the caller — log
      // and move on, same as the S3 provider's not-found handling will.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  getUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  keyFromUrl(url: string): string | null {
    const prefix = `${this.publicBaseUrl}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}
