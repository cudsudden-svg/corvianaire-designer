// Prisma seed script — run via `npx prisma db seed` (or automatically
// after `prisma migrate dev`). Populates the 9 clipart categories from the
// original spec and one curated SVG per category from ./seed-assets, so a
// fresh dev environment has a working clipart library out of the box.
//
// Uses relative imports rather than the `~/` tsconfig alias — this script
// runs directly under tsx/ts-node (see package.json's `prisma.seed`
// field), outside the Vite/Remix build where that alias is resolved.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "../app/lib/db/db.server";
import { findOrCreateCategory, addClipartAsset } from "../app/features/clipart/clipart.server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedAssetsDir = path.join(__dirname, "../app/features/clipart/seed-assets");

// Category name/slug list is intentionally the exact 9 categories decided
// in the Stage 4 planning Q&A (Animals, Nature, Sports, Gaming, Music,
// Abstract, Minimal, Streetwear, Icons) — keep in sync with any future
// category picker UI in the admin dashboard (Stage 8).
const CATEGORIES: { name: string; slug: string; seedFile: string; assetName: string; tags: string[] }[] = [
  { name: "Animals", slug: "animals", seedFile: "animals-paw.svg", assetName: "Paw Print", tags: ["paw", "pet", "animal"] },
  { name: "Nature", slug: "nature", seedFile: "nature-leaf.svg", assetName: "Leaf", tags: ["leaf", "plant", "nature"] },
  { name: "Sports", slug: "sports", seedFile: "sports-ball.svg", assetName: "Soccer Ball", tags: ["ball", "soccer", "sports"] },
  { name: "Gaming", slug: "gaming", seedFile: "gaming-controller.svg", assetName: "Controller", tags: ["controller", "gamepad", "gaming"] },
  { name: "Music", slug: "music", seedFile: "music-note.svg", assetName: "Music Notes", tags: ["music", "note", "song"] },
  { name: "Abstract", slug: "abstract", seedFile: "abstract-burst.svg", assetName: "Starburst", tags: ["abstract", "burst", "shape"] },
  { name: "Minimal", slug: "minimal", seedFile: "minimal-dot.svg", assetName: "Dot", tags: ["minimal", "dot", "simple"] },
  { name: "Streetwear", slug: "streetwear", seedFile: "streetwear-cap.svg", assetName: "Cap", tags: ["cap", "hat", "streetwear"] },
  { name: "Icons", slug: "icons", seedFile: "icons-star.svg", assetName: "Star", tags: ["star", "icon", "favorite"] },
];

async function main() {
  for (const entry of CATEGORIES) {
    await findOrCreateCategory(entry.name, entry.slug);

    const alreadySeeded = await prisma.clipartAsset.findFirst({
      where: { name: entry.assetName, category: { slug: entry.slug } },
    });
    if (alreadySeeded) {
      console.log(`  skip  ${entry.slug}/${entry.assetName} (already seeded)`);
      continue;
    }

    const buffer = await readFile(path.join(seedAssetsDir, entry.seedFile));
    await addClipartAsset({
      name: entry.assetName,
      tags: entry.tags,
      categorySlug: entry.slug,
      buffer,
      fileName: entry.seedFile,
      mimeType: "image/svg+xml",
    });
    console.log(`  seed  ${entry.slug}/${entry.assetName}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
