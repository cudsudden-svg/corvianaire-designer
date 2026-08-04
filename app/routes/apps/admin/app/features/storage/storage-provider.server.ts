// Storage provider factory — the ONE place STORAGE_PROVIDER is read.
//
// Every upload/delete call site in the app does:
//   import { getStorageProvider } from "~/features/storage/storage-provider.server";
//   const storage = getStorageProvider();
//   await storage.upload({ ... });
//
// Switching environments from local disk to S3 is a one-line env change
// (STORAGE_PROVIDER=local -> s3) — no call site anywhere else needs to
// know or care which provider is active.
import type { AssetStorageProvider } from "./types";
import { LocalStorageProvider } from "./providers/local-storage.provider.server";
import { S3StorageProvider } from "./providers/s3-storage.provider.server";

let cachedProvider: AssetStorageProvider | null = null;

export function getStorageProvider(): AssetStorageProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.STORAGE_PROVIDER ?? "local";

  switch (providerName) {
    case "local":
      cachedProvider = new LocalStorageProvider();
      break;
    case "s3":
      cachedProvider = new S3StorageProvider();
      break;
    default:
      throw new Error(
        `Unknown STORAGE_PROVIDER "${providerName}". Expected "local" or "s3".`,
      );
  }

  return cachedProvider;
}

/**
 * Deletes a file given only its previously-issued URL (e.g.
 * DesignView.previewImageUrl) rather than its provider-internal key.
 * A no-op — not an error — if the URL doesn't resolve to a key under
 * the currently active provider; see AssetStorageProvider.keyFromUrl.
 */
export async function deleteByUrl(url: string): Promise<void> {
  const storage = getStorageProvider();
  const key = storage.keyFromUrl(url);
  if (key) await storage.delete(key);
}
