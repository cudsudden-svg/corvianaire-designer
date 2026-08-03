import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import styles from "../styles/app._index.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return data({ shop: "Maison Corvian" });
};

export default function AppIndex() {
  return (
    <div className={styles.appContainer}>

      {/* SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <h2>Corvianaire</h2>
          <span>STUDIO</span>
        </div>

        <nav className={styles.navMenu}>
          <a className={styles.active}>
            Dashboard
          </a>

          <a>
            Designer Studio
          </a>

          <a>
            Products
          </a>

          <a>
            Templates
          </a>

          <a>
            Orders
          </a>

          <a>
            Analytics
          </a>

          <a>
            Settings
          </a>
        </nav>
      </aside>


      {/* MAIN CONTENT */}
      <main className={styles.mainWrapper}>

        <header className={styles.topHeader}>
          <div>
            <h1>
              Corvianaire Designer
            </h1>

            <p>
              Welcome back, Creative Director 👋
            </p>
          </div>
        </header>


        {/* STATS */}
        <section className={styles.statsGrid}>

          <div className={styles.statCard}>
            <h3>Total Designs</h3>
            <strong>48</strong>
            <p>+12% this month</p>
          </div>


          <div className={styles.statCard}>
            <h3>Products</h3>
            <strong>18</strong>
            <p>Connected items</p>
          </div>


          <div className={styles.statCard}>
            <h3>Orders</h3>
            <strong>314</strong>
            <p>Custom orders</p>
          </div>


          <div className={styles.statCard}>
            <h3>Revenue</h3>
            <strong>$28,450</strong>
            <p>Growth</p>
          </div>

        </section>


        {/* QUICK ACTIONS */}
        <section>
          <h2>
            Quick Actions
          </h2>

          <div className={styles.actionsGrid}>

            <button className={styles.actionCard}>
              🎨 Create New Design
            </button>


            <button className={styles.actionCard}>
              👕 Manage Products
            </button>


            <button className={styles.actionCard}>
              🖼 View Designs
            </button>


            <button className={styles.actionCard}>
              ⚙ Settings
            </button>

          </div>

        </section>


        {/* RECENT DESIGNS */}
        <section>

          <h2>
            Recent Designs
          </h2>


          <div className={styles.designCard}>

            <h3>
              Luna Satin Dress
            </h3>

            <p>
              Edited 2 hours ago
            </p>

            <span>
              Published
            </span>

          </div>


        </section>


      </main>

    </div>
  );
}