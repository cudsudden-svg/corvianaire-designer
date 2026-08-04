// S3StorageProvider — STUBBED per Stage 2 scope decision.
//
// The class structure and method signatures below match
// AssetStorageProvider exactly, so wiring this up later is purely filling
// in the TODOs — no changes needed anywhere else in the app, including
// storage-provider.server.ts's factory (it already routes to this class
// when STORAGE_PROVIDER=s3).
//
// When ready to implement:
//   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
// and fill in the TODOs using AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY /
// AWS_REGION / AWS_S3_BUCKET from .env (already scaffolded in .env.example).
import type { AssetStorageProvider, UploadInput, UploadResult } from "../types";

export class S3StorageProvider implements AssetStorageProvider {
  readonly name = "s3";

  private readonly bucket: string;
  private readonly region: string;

  constructor(options?: { bucket?: string; region?: string }) {
    this.bucket = options?.bucket ?? process.env.AWS_S3_BUCKET ?? "";
    this.region = options?.region ?? process.env.AWS_REGION ?? "";

    if (!this.bucket || !this.region) {
      throw new Error(
        "S3StorageProvider is selected (STORAGE_PROVIDER=s3) but AWS_S3_BUCKET " +
          "and/or AWS_REGION are not set. Also note: the S3 upload/delete " +
          "logic itself is still a TODO — see s3-storage.provider.server.ts.",
      );
    }
  }

  async upload(_input: UploadInput): Promise<UploadResult> {
    // TODO(stage: production polish):
    //   1. Instantiate an S3Client({ region: this.region }).
    //   2. Build a key: `${folder}/${randomUUID()}${extname(fileName)}`
    //      (same scheme as LocalStorageProvider, for parity).
    //   3. PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer,
    //      ContentType: mimeType }).
    //   4. Return { url: this.getUrl(key), key, sizeBytes: buffer.byteLength }.
    throw new Error("S3StorageProvider.upload() is not yet implemented — see TODO comments.");
  }

  async delete(_key: string): Promise<void> {
    // TODO: DeleteObjectCommand({ Bucket: this.bucket, Key: key }).
    // Mirror LocalStorageProvider's behavior of swallowing "already gone"
    // errors (S3 equivalent: a 404/NoSuchKey should not throw).
    throw new Error("S3StorageProvider.delete() is not yet implemented — see TODO comments.");
  }

  getUrl(key: string): string {
    // Standard virtual-hosted-style S3 URL. If a CDN (CloudFront) sits in
    // front of the bucket in production, swap this for the CDN's domain
    // instead — no other code needs to change since callers only ever see
    // whatever getUrl() returns.
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  keyFromUrl(url: string): string | null {
    const prefix = `https://${this.bucket}.s3.${this.region}.amazonaws.com/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}
