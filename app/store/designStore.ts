import { create } from "zustand";

type Element = {
  id: string;
  type: "text" | "image" | "shape";
  x: number;
  y: number;
};

type Store = {
  elements: Element[];
  selectedId: string | null;

  addElement: (element: Element) => void;
  selectElement: (id: string | null) => void;
};

export const useDesignStore = create<Store>((set) => ({
  elements: [],

  selectedId: null,

  addElement: (element) =>
    set((state) => ({
      elements: [
        ...state.elements,
        element,
      ],
    })),

  selectElement: (id) =>
    set({
      selectedId: id,
    }),
}));