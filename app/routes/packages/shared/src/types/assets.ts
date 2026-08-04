// Shared clipart + uploaded-asset types (Stage 4), mirroring the Prisma
// models ClipartCategory / ClipartAsset / UploadedAsset. Kept as plain
// interfaces so client-side code (which can't import @prisma/client) can
// share the same shapes as the admin app.

export interface ClipartAsset {
  id: string;
  name: string;
  tags: string[];
  fileUrl: string;
  thumbUrl: string;
  categoryId: string;
}

export interface ClipartCategory {
  id: string;
  name: string;
  slug: string;
  assets: ClipartAsset[];
}

export interface UploadedAssetMeta {
  id: string;
  fileUrl: string;
  thumbUrl: string;
  originalName: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  fileSizeKb: number;
}
