import { Type, Image, Palette } from "lucide-react";
import { Textbox } from "fabric";
import { useCanvasStore } from "@/store/canvasStore";

export default function LeftSidebar() {
  const canvas = useCanvasStore((state) => state.canvas);

  const addText = () => {
    if (!canvas) return;

    const text = new Textbox("New Text", {
      left: 150,
      top: 150,
      fontSize: 48,
      fill: "#111827",
      fontFamily: "Inter",
      fontWeight: "600",
      charSpacing: 20,
      lineHeight: 1.2,
      strokeWidth: 0,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  return (
    <aside className="w-72 bg-corv-surface border-r border-corv-border p-5">

      <h2 className="text-lg font-semibold text-corv-text mb-6">
        Design Tools
      </h2>

      <div className="space-y-3">

        <button
          onClick={addText}
          className="
          w-full flex items-center gap-3
          px-4 py-3
          bg-corv-bg
          hover:bg-corv-surfaceHover
          text-corv-text
          rounded-xl
          border border-corv-border
          transition-all
          "
        >
          <Type size={20} />
          Add Text
        </button>


        <button
          className="
          w-full flex items-center gap-3
          px-4 py-3
          bg-corv-bg
          hover:bg-corv-surfaceHover
          text-corv-text
          rounded-xl
          border border-corv-border
          "
        >
          <Image size={20} />
          Upload Image
        </button>


        <button
          className="
          w-full flex items-center gap-3
          px-4 py-3
          bg-corv-bg
          hover:bg-corv-surfaceHover
          text-corv-text
          rounded-xl
          border border-corv-border
          "
        >
          <Palette size={20} />
          Colors
        </button>

      </div>

    </aside>
  );
}