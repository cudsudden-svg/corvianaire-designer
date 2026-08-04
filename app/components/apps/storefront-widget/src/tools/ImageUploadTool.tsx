import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ProxyApiError } from "@corvianaire/shared/api";
import { uploadClient } from "../api/client";
import { loadFabric } from "../canvas/load-fabric";
import type { UseFabricCanvasResult } from "../canvas/use-fabric-canvas";
import { computeTrimBounds } from "./image-trim";

interface ImageUploadToolProps {
  fabricCanvas: UseFabricCanvasResult;
}

type UploadState = { status: "idle" } | { status: "uploading" } | { status: "error"; message: string };

export function ImageUploadTool({ fabricCanvas }: ImageUploadToolProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cropOverlayRef = useRef<import("fabric").fabric.Rect | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [activeImage, setActiveImage] = useState<import("fabric").fabric.Image | null>(null);
  const [cropping, setCropping] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setUploadState({ status: "uploading" });
    try {
      const asset = await uploadClient.uploadAsset(file);
      const { fabric } = await loadFabric();

      await new Promise<void>((resolve) => {
        fabric.Image.fromURL(
          asset.fileUrl,
          (img) => {
            // Scale large uploads down to a sane starting size on canvas —
            // the stored asset keeps its full resolution for production files.
            const maxDim = 300;
            const scale = Math.min(1, maxDim / Math.max(img.width ?? maxDim, img.height ?? maxDim));
            img.set({ left: 100, top: 100, scaleX: scale, scaleY: scale });
            fabricCanvas.addObject(img);
            setActiveImage(img);
            resolve();
          },
          { crossOrigin: "anonymous" },
        );
      });

      setUploadState({ status: "idle" });
    } catch (error) {
      const message = error instanceof ProxyApiError ? error.message : "Upload failed. Please try again.";
      setUploadState({ status: "error", message });
    }
  }

  async function handleAutoTrim() {
    if (!activeImage) return;
    const element = activeImage.getElement() as HTMLImageElement;

    const bounds = computeTrimBounds(element);
    const canvas = fabricCanvas.getCanvas();
    if (!canvas) return;

    activeImage.set({
      cropX: (activeImage.cropX ?? 0) + bounds.x,
      cropY: (activeImage.cropY ?? 0) + bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
    activeImage.setCoords();
    canvas.renderAll();
    canvas.fire("object:modified", { target: activeImage });
  }

  function startCrop() {
    const canvas = fabricCanvas.getCanvas();
    if (!activeImage || !canvas) return;

    loadFabric().then(({ fabric }) => {
      const overlay = new fabric.Rect({
        left: activeImage.left,
        top: activeImage.top,
        width: activeImage.getScaledWidth(),
        height: activeImage.getScaledHeight(),
        fill: "rgba(0,0,0,0.15)",
        stroke: "#111",
        strokeDashArray: [4, 4],
        cornerColor: "#111",
        transparentCorners: false,
        lockRotation: true,
      });
      overlay.setControlsVisibility({ mtr: false }); // no rotate handle — axis-aligned crop only
      cropOverlayRef.current = overlay;
      canvas.add(overlay);
      canvas.setActiveObject(overlay);
      canvas.renderAll();
      setCropping(true);
    });
  }

  function applyCrop() {
    const canvas = fabricCanvas.getCanvas();
    const overlay = cropOverlayRef.current;
    if (!canvas || !overlay || !activeImage) return;

    // Axis-aligned only (documented limitation — see startCrop). Converts
    // the overlay's on-canvas box into the image's original-pixel crop
    // coordinates, which is the unit Fabric's cropX/cropY/width/height use.
    const scaleX = activeImage.scaleX ?? 1;
    const scaleY = activeImage.scaleY ?? 1;

    const cropX = (activeImage.cropX ?? 0) + (overlay.left! - activeImage.left!) / scaleX;
    const cropY = (activeImage.cropY ?? 0) + (overlay.top! - activeImage.top!) / scaleY;
    const cropWidth = overlay.getScaledWidth() / scaleX;
    const cropHeight = overlay.getScaledHeight() / scaleY;

    activeImage.set({
      cropX,
      cropY,
      width: cropWidth,
      height: cropHeight,
      left: overlay.left,
      top: overlay.top,
    });
    activeImage.setCoords();

    canvas.remove(overlay);
    cropOverlayRef.current = null;
    canvas.setActiveObject(activeImage);
    canvas.renderAll();
    canvas.fire("object:modified", { target: activeImage });
    setCropping(false);
  }

  function cancelCrop() {
    const canvas = fabricCanvas.getCanvas();
    const overlay = cropOverlayRef.current;
    if (canvas && overlay) canvas.remove(overlay);
    cropOverlayRef.current = null;
    setCropping(false);
  }

  return (
    <div className="corvianaire-tool-panel corvianaire-image-tool">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={handleFileChange}
        disabled={!fabricCanvas.ready || uploadState.status === "uploading"}
      />

      {uploadState.status === "uploading" && <p>Uploading…</p>}
      {uploadState.status === "error" && <p className="corvianaire-error">{uploadState.message}</p>}

      {activeImage && !cropping && (
        <div className="corvianaire-text-style-row">
          <button type="button" onClick={handleAutoTrim}>
            Auto-trim
          </button>
          <button type="button" onClick={startCrop}>
            Crop
          </button>
        </div>
      )}

      {cropping && (
        <div className="corvianaire-text-style-row">
          <button type="button" onClick={applyCrop}>
            Apply crop
          </button>
          <button type="button" onClick={cancelCrop}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
