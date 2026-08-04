# Storage feature

`AssetStorageProvider` (types.ts) is the single contract every backend
implements. Callers always go through `getStorageProvider()` in
`storage-provider.server.ts` — never import a provider class directly.

- `providers/local-storage.provider.server.ts` — fully working, writes to
  `LOCAL_UPLOAD_DIR`, served back out via `app/routes/uploads.$.tsx`.
- `providers/s3-storage.provider.server.ts` — stubbed. Interface complete,
  upload()/delete() throw with TODO comments describing the exact AWS SDK
  calls needed. Swapping to it is `STORAGE_PROVIDER=s3` in `.env` plus
  filling in those two methods — no other file in the app changes.
