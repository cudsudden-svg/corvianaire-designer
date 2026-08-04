import { Undo2, Redo2, Save, Download } from "lucide-react";

export default function TopToolbar() {
  return (
    <header className="
      h-16
      flex
      items-center
      justify-between
      px-6
      bg-corv-surface
      border-b
      border-corv-border
    ">

      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-corv-text">
          Corvianaire Studio
        </h1>

        <span className="
          px-3 py-1
          text-xs
          rounded-full
          bg-corv-accent/15
          text-corv-accent
        ">
          Designer
        </span>
      </div>


      <div className="flex items-center gap-2">

        <button className="
          p-2
          rounded-lg
          hover:bg-corv-surfaceHover
          text-corv-textMuted
        ">
          <Undo2 size={18}/>
        </button>


        <button className="
          p-2
          rounded-lg
          hover:bg-corv-surfaceHover
          text-corv-textMuted
        ">
          <Redo2 size={18}/>
        </button>


        <button className="btn-secondary flex items-center gap-2">
          <Save size={18}/>
          Save
        </button>


        <button className="btn-primary flex items-center gap-2">
          <Download size={18}/>
          Export
        </button>

      </div>

    </header>
  );
}