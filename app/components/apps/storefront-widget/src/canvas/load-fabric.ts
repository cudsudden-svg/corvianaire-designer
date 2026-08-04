// Fabric.js is the heaviest dependency in this bundle. Dynamic import()
// here becomes a separate chunk (see vite.config.ts chunkFileNames) that
// only downloads once a customer actually opens the canvas editor —
// visitors who never open the customizer never pay for it.
let fabricPromise: Promise<typeof import("fabric")> | null = null;

export function loadFabric(): Promise<typeof import("fabric")> {
  if (!fabricPromise) {
    fabricPromise = import("fabric");
  }
  return fabricPromise;
}
