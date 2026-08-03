import styles from "../styles/app.studio.module.css";

export default function Studio() {
  return (
    <div className={styles.container}>

      <aside className={styles.toolbar}>
        <h2>Designer Studio</h2>

        <button>
          ➕ Add Text
        </button>

        <button>
          🖼 Upload Image
        </button>

        <button>
          🎨 Change Color
        </button>

        <button>
          👕 Products
        </button>

        <button>
          ↶ Undo
        </button>

        <button>
          ↷ Redo
        </button>
      </aside>


      <main className={styles.workspace}>

        <div className={styles.canvas}>
          <div className={styles.shirt}>
            👕
          </div>

          <p>
            Canvas Preview
          </p>
        </div>

      </main>


      <aside className={styles.properties}>
        <h3>
          Properties
        </h3>

        <div>
          Selected Layer
        </div>

        <div>
          Size: 100%
        </div>

        <div>
          Position: Center
        </div>

      </aside>

    </div>
  );
}