export default function RightSidebar() {
  return (
    <aside className="
      w-80
      bg-corv-surface
      border-l
      border-corv-border
      p-5
      text-corv-text
    ">

      <h2 className="
        text-sm
        font-semibold
        uppercase
        tracking-wide
        mb-5
      ">
        Properties
      </h2>


      <div className="space-y-4">


        <div>
          <label className="text-xs text-corv-textMuted">
            Position X
          </label>

          <input
            className="input-field mt-1"
            placeholder="0"
          />
        </div>


        <div>
          <label className="text-xs text-corv-textMuted">
            Position Y
          </label>

          <input
            className="input-field mt-1"
            placeholder="0"
          />
        </div>


        <div>
          <label className="text-xs text-corv-textMuted">
            Width
          </label>

          <input
            className="input-field mt-1"
            placeholder="Auto"
          />
        </div>


        <div>
          <label className="text-xs text-corv-textMuted">
            Height
          </label>

          <input
            className="input-field mt-1"
            placeholder="Auto"
          />
        </div>


        <div>
          <label className="text-xs text-corv-textMuted">
            Opacity
          </label>

          <input
            type="range"
            className="w-full mt-2"
          />
        </div>


        <div className="
          mt-6
          p-4
          rounded-xl
          bg-corv-bg
          border
          border-corv-border
        ">

          <h3 className="text-sm font-medium mb-2">
            Object
          </h3>

          <p className="text-xs text-corv-textMuted">
            Select an element on the canvas to edit it.
          </p>

        </div>


      </div>

    </aside>
  );
}