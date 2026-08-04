import { create } from "zustand";
import type { Canvas } from "fabric";

type CanvasStore = {
  canvas: Canvas | null;
  history: string[];
  historyIndex: number;

  setCanvas: (canvas: Canvas) => void;

  saveState: () => void;
  undo: () => void;
  redo: () => void;

  clearCanvas: () => void;
};


export const useCanvasStore = create<CanvasStore>((set, get) => ({

  canvas: null,

  history: [],

  historyIndex: -1,


  setCanvas: (canvas) => {
    set({
      canvas,
    });

    get().saveState();
  },


  saveState: () => {
    const canvas = get().canvas;

    if (!canvas) return;


    const json = JSON.stringify(
      canvas.toJSON()
    );


    const history = get().history.slice(
      0,
      get().historyIndex + 1
    );


    history.push(json);


    set({
      history,
      historyIndex: history.length - 1,
    });
  },


  undo: () => {
    const {
      canvas,
      history,
      historyIndex,
    } = get();


    if (!canvas || historyIndex <= 0) return;


    const newIndex = historyIndex - 1;


    canvas.loadFromJSON(
      history[newIndex]
    ).then(() => {

      canvas.renderAll();

      set({
        historyIndex: newIndex,
      });

    });
  },


  redo: () => {
    const {
      canvas,
      history,
      historyIndex,
    } = get();


    if (
      !canvas ||
      historyIndex >= history.length - 1
    ) return;


    const newIndex = historyIndex + 1;


    canvas.loadFromJSON(
      history[newIndex]
    ).then(() => {

      canvas.renderAll();

      set({
        historyIndex: newIndex,
      });

    });
  },


  clearCanvas: () => {
    const canvas = get().canvas;

    if (!canvas) return;


    canvas.clear();

    canvas.backgroundColor = "#ffffff";

    canvas.renderAll();

    get().saveState();
  },


}));