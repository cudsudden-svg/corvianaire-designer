import TopToolbar from "./TopToolbar";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import BottomPanel from "./BottomPanel";
import Canvas from "./canvas/Canvas";

export default function Workspace() {
  return (
    <div className="flex h-screen w-screen bg-corv-bg text-corv-text overflow-hidden">

      <LeftSidebar />

      <div className="flex-1 flex flex-col min-w-0">

        <TopToolbar />

        <div className="flex-1 flex min-h-0">

          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            <div className="flex-1 overflow-hidden">
              <Canvas />
            </div>

            <BottomPanel />

          </main>

          <RightSidebar />

        </div>

      </div>

    </div>
  );
}