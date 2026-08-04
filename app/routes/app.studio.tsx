
import { useEffect, useRef } from "react";
import { Canvas, Textbox, Image as FabricImage } from "fabric";
import ProductSelector from "../components/ProductSelector";
import styles from "../styles/app.studio.module.css";

export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: 600,
      height: 700,
      backgroundColor: "#ffffff",
    });

    fabricCanvasRef.current = canvas;

    const text = new Textbox("Your Design", {
      left: 150,
      top: 100,
      fontSize: 40,
      fill: "#222",
    });

    canvas.add(text);

    return () => {
      canvas.dispose();
    };
  }, []);


  const addProduct = async (imageUrl: string) => {
  const canvas = fabricCanvasRef.current;

  if (!canvas) {
    console.log("Canvas not ready");
    return;
  }

  console.log("Loading image:", imageUrl);

  const img = await FabricImage.fromURL(imageUrl);

  img.scaleToWidth(250);

  canvas.add(img);

  canvas.centerObject(img);

  img.set({
    selectable: true,
  });

  canvas.setActiveObject(img);

  canvas.renderAll();

  console.log("Image added");
};


  return (
    <div className={styles.container}>

      {/* LEFT TOOLBAR */}
      <aside className={styles.toolbar}>

        <h2>
          Designer Studio
        </h2>


        <button>
          Add Text
        </button>


        <button>
          Upload Image
        </button>


        <button>
          Change Color
        </button>


        <ProductSelector 
          onSelectProduct={addProduct}
        />

      </aside>



      {/* CANVAS AREA */}
      <main className={styles.workspace}>

        <canvas ref={canvasRef} />

      </main>



      {/* RIGHT PANEL */}
      <aside className={styles.properties}>

        <h3>
          Properties
        </h3>


        <p>
          Select an object to edit
        </p>

      </aside>


    </div>
  );
}