export type DesignElementType =
  | "text"
  | "image"
  | "shape";

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DesignElement {
  id: string;
  type: DesignElementType;
  position: Position;
  size: Size;
  rotation: number;
  opacity: number;
  locked?: boolean;

  content?: string;
  src?: string;

  style?: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    borderRadius?: number;
  };
}

export interface DesignCanvas {
  width: number;
  height: number;
  background: string;
}

export interface DesignState {
  elements: DesignElement[];
  canvas: DesignCanvas;
  selectedId: string | null;

  addElement: (element: DesignElement) => void;
  updateElement: (
    id: string,
    updates: Partial<DesignElement>
  ) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null) => void;
}