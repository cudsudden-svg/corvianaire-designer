// computeTrimBounds — scans an image's edges for transparent or near-white
// background and returns the tight bounding box of actual content. Runs
// entirely client-side against an offscreen canvas (no server round trip)
// so "Auto-trim" is instant after upload.
export interface TrimBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrimOptions {
  /** Alpha below this (0-255) counts as background. */
  alphaThreshold?: number;
  /** R/G/B all above this (0-255) counts as near-white background. */
  whiteThreshold?: number;
}

export function computeTrimBounds(
  image: HTMLImageElement,
  options: TrimOptions = {},
): TrimBounds {
  const alphaThreshold = options.alphaThreshold ?? 10;
  const whiteThreshold = options.whiteThreshold ?? 250;

  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { x: 0, y: 0, width, height };

  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  function isBackground(pixelIndex: number): boolean {
    const r = data[pixelIndex]!;
    const g = data[pixelIndex + 1]!;
    const b = data[pixelIndex + 2]!;
    const a = data[pixelIndex + 3]!;
    if (a < alphaThreshold) return true;
    return r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
  }

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  rowScan: for (; top < height; top++) {
    for (let x = 0; x < width; x++) {
      if (!isBackground((top * width + x) * 4)) break rowScan;
    }
  }

  rowScanBottom: for (; bottom >= top; bottom--) {
    for (let x = 0; x < width; x++) {
      if (!isBackground((bottom * width + x) * 4)) break rowScanBottom;
    }
  }

  colScan: for (; left < width; left++) {
    for (let y = top; y <= bottom; y++) {
      if (!isBackground((y * width + left) * 4)) break colScan;
    }
  }

  colScanRight: for (; right >= left; right--) {
    for (let y = top; y <= bottom; y++) {
      if (!isBackground((y * width + right) * 4)) break colScanRight;
    }
  }

  // Entirely background (or nothing detected) — don't trim to nothing.
  if (top > bottom || left > right) {
    return { x: 0, y: 0, width, height };
  }

  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
