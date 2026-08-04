// AssetStorageProvider — the one contract every storage backend implements.
//
// Nothing outside this feature folder should ever import a specific
// provider directly (LocalStorageProvider, S3StorageProvider, etc). All
// upload/delete/read call sites go through `getStorageProvider()` in
// storage-provider.server.ts, which returns whichever implementation
// matches STORAGE_PROVIDER. That's what makes switching providers a
// config change instead of a rewrite (Phase 19).

export interface UploadInput {
  /** Raw file bytes. */
  buffer: Buffer;
  /** Original filename as uploaded by the user, used for extension/naming. */
  fileName: string;
  /** MIME type, already validated by the caller (see Stage 9 security work). */
  mimeType: string;
  /**
   * Logical folder/namespace, e.g. "uploads", "clipart", "previews",
   * "production-files". Providers use this to organize storage without
   * callers needing to know the underlying path/bucket-key scheme.
   */
  folder: string;
}

export interface UploadResult {
  /** Publicly resolvable URL the browser/canvas can load the asset from. */
  url: string;
  /** Provider-internal key/path — needed later for delete(). */
  key: string;
  /** Size of the stored file in bytes. */
  sizeBytes: number;
}

export interface AssetStorageProvider {
  /** Provider name, useful for logging/debugging which backend is active. */
  readonly name: string;

  /** Store a file, returning its public URL and internal key. */
  upload(input: UploadInput): Promise<UploadResult>;

  /** Permanently remove a stored file by its key. */
  delete(key: string): Promise<void>;

  /**
   * Resolve a key to a public URL. Most providers can derive this without
   * a network call (local: path join, S3: bucket URL pattern) — kept
   * synchronous on purpose so callers don't need to await it everywhere
   * they just need to display an already-known key.
   */
  getUrl(key: string): string;

  /**
   * The inverse of getUrl — recovers a provider-internal key from a
   * previously-issued URL. Needed anywhere only the URL was persisted
   * (e.g. DesignView.previewImageUrl) but a later action needs to
   * delete the underlying file. Returns null if the URL doesn't belong
   * to this provider at all (e.g. stale data from a provider that was
   * later swapped out) — callers should treat that as "nothing to
   * delete" rather than an error.
   */
  keyFromUrl(url: string): string | null;
}
