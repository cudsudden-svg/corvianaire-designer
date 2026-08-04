import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas, Textbox } from "fabric";
import { useCanvasStore } from "@/store/canvasStore";

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setCanvas = useCanvasStore(
    (state) => state.setCanvas
  );


  useEffect(() => {
    if (!canvasRef.current) return;


    const canvas = new FabricCanvas(canvasRef.current, {
      width: 700,
      height: 700,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
    });


    canvas.controlsAboveOverlay = true;


    setCanvas(canvas);


    const text = new Textbox("Your Design", {
      left: 150,
      top: 150,
      fontSize: 48,
      fill: "#111827",
      fontFamily: "Inter",
      fontWeight: "600",
      editable: true,
    });


    canvas.add(text);

    canvas.setActiveObject(text);

    canvas.renderAll();


    // Save canvas changes for undo/redo
    canvas.on("object:added", () => {
      useCanvasStore
        .getState()
        .saveState();
    });


    canvas.on("object:modified", () => {
      useCanvasStore
        .getState()
        .saveState();
    });


    canvas.on("object:removed", () => {
      useCanvasStore
        .getState()
        .saveState();
    });


    return () => {
      canvas.dispose();
    };


  }, [setCanvas]);


  return (
    <div
      className="
      flex-1
      flex
      items-center
      justify-center
      bg-[#0F1115]
      overflow-hidden
      p-8
      "
    >

      <div
        className="
        rounded-2xl
        shadow-glass
        overflow-hidden
        border
        border-corv-border
        "
      >

        <canvas
          ref={canvasRef}
        />

      </div>

    </div>
  );
}