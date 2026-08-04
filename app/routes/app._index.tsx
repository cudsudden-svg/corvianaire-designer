import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import {
  Home,
  Palette,
  Package,
  LayoutTemplate,
  ShoppingBag,
  BarChart3,
  Settings,
  Search,
  Bell,
  Plus,
  Upload,
  FolderOpen,
  Users,
  ArrowUpRight,
} from "lucide-react";
import styles from "../styles/app._index.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return data({
    shop: "Corvianaire Studio",
  });
};

export default function AppIndex() {
  return (
    <div className={styles.dashboard}>
      {/* ================= SIDEBAR ================= */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <h2>Corvianaire</h2>
          <span>STUDIO</span>
        </div>
        <nav className={styles.navigation}>
          <a className={styles.active}>
            <Home size={20} />
            Dashboard
          </a>
          <a>
            <Palette size={20} />
            Designer
          </a>
          <a>
            <Package size={20} />
            Products
          </a>
          <a>
            <LayoutTemplate size={20} />
            Templates
          </a>
          <a>
            <ShoppingBag size={20} />
            Orders
          </a>
          <a>
            <BarChart3 size={20} />
            Analytics
          </a>
          <a>
            <Settings size={20} />
            Settings
          </a>
        </nav>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className={styles.content}>
        <header className={styles.header}>
          <div>
            <h1>Corvianaire Studio</h1>
            <p>Welcome back. Here's what's happening today.</p>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.searchBox}>
              <Search size={18} />
              <input placeholder="Search..." />
            </div>
            <button className={styles.iconButton}>
              <Bell size={20} />
            </button>
            <div className={styles.profile}>
              <div className={styles.avatar}>CS</div>
              <div>
                <strong>Creative Director</strong>
                <p>Admin</p>
              </div>
            </div>
          </div>
        </header>

        {/* ================= STATISTICS ================= */}
        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statIcon}>
                <Palette size={22} />
              </div>
              <ArrowUpRight size={18} />
            </div>
            <h3>Total Designs</h3>
            <h2>248</h2>
            <p>+18% from last month</p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statIcon}>
                <Package size={22} />
              </div>
              <ArrowUpRight size={18} />
            </div>
            <h3>Products</h3>
            <h2>74</h2>
            <p>12 new this week</p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statIcon}>
                <ShoppingBag size={22} />
              </div>
              <ArrowUpRight size={18} />
            </div>
            <h3>Orders</h3>
            <h2>1,284</h2>
            <p>+26% growth</p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <div className={styles.statIcon}>
                <BarChart3 size={22} />
              </div>
              <ArrowUpRight size={18} />
            </div>
            <h3>Revenue</h3>
            <h2>$48,920</h2>
            <p>$5,200 this week</p>
          </div>
        </section>

        {/* ================= ANALYTICS ================= */}
        <section className={styles.analyticsGrid}>
          <div className={styles.chartCard}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Studio Performance</h2>
                <p>Last 30 Days</p>
              </div>
              <button className={styles.viewButton}>View Report</button>
            </div>
            <div className={styles.fakeChart}>
              <div className={styles.chartBars}>
                <div className={styles.bar1}></div>
                <div className={styles.bar2}></div>
                <div className={styles.bar3}></div>
                <div className={styles.bar4}></div>
                <div className={styles.bar5}></div>
                <div className={styles.bar6}></div>
                <div className={styles.bar7}></div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className={styles.activityCard}>
            <div className={styles.cardHeader}>
              <h2>Recent Activity</h2>
            </div>
            <div className={styles.activityItem}>
              <div className={styles.activityDot}></div>
              <div>
                <strong>Luxury Hoodie Updated</strong>
                <p>2 minutes ago</p>
              </div>
            </div>
            <div className={styles.activityItem}>
              <div className={styles.activityDot}></div>
              <div>
                <strong>New Custom Order</strong>
                <p>15 minutes ago</p>
              </div>
            </div>
            <div className={styles.activityItem}>
              <div className={styles.activityDot}></div>
              <div>
                <strong>Template Published</strong>
                <p>1 hour ago</p>
              </div>
            </div>
            <div className={styles.activityItem}>
              <div className={styles.activityDot}></div>
              <div>
                <strong>Client Approved Design</strong>
                <p>Yesterday</p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= QUICK ACTIONS ================= */}
        <section className={styles.quickActions}>
          <div className={styles.sectionHeader}>
            <h2>Quick Actions</h2>
            <p>Jump straight into your workflow.</p>
          </div>
          <div className={styles.actionsGrid}>
            <button className={styles.actionCard}>
              <div className={styles.actionIcon}>
                <Plus size={26} />
              </div>
              <h3>Create Design</h3>
              <p>Start designing a brand new product.</p>
            </button>
            <button className={styles.actionCard}>
              <div className={styles.actionIcon}>
                <Upload size={26} />
              </div>
              <h3>Upload Assets</h3>
              <p>Add logos, images and graphics.</p>
            </button>
            <button className={styles.actionCard}>
              <div className={styles.actionIcon}>
                <FolderOpen size={26} />
              </div>
              <h3>Templates</h3>
              <p>Browse and edit saved templates.</p>
            </button>
            <button className={styles.actionCard}>
              <div className={styles.actionIcon}>
                <Users size={26} />
              </div>
              <h3>Team Members</h3>
              <p>Invite collaborators to your studio.</p>
            </button>
          </div>
        </section>

        {/* ================= RECENT PROJECTS ================= */}
        <section className={styles.projectsSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Recent Projects</h2>
              <p>Your latest design work.</p>
            </div>
            <button className={styles.viewButton}>View All</button>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.projectTable}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Designer</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Luna Satin Collection</td>
                  <td>
                    <span className={styles.statusPublished}>Published</span>
                  </td>
                  <td>Bradley</td>
                  <td>2 hours ago</td>
                </tr>
                <tr>
                  <td>Vintage Hoodie</td>
                  <td>
                    <span className={styles.statusDraft}>Draft</span>
                  </td>
                  <td>Grace</td>
                  <td>Yesterday</td>
                </tr>
                <tr>
                  <td>Streetwear Collection</td>
                  <td>
                    <span className={styles.statusReview}>Review</span>
                  </td>
                  <td>Laisha</td>
                  <td>2 days ago</td>
                </tr>
                <tr>
                  <td>Premium Sneakers</td>
                  <td>
                    <span className={styles.statusPublished}>Published</span>
                  </td>
                  <td>Bradley</td>
                  <td>4 days ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ================= STUDIO INFO ================= */}
        <section className={styles.bottomGrid}>
          <div className={styles.infoCard}>
            <h3>Workspace Storage</h3>
            <h2>78%</h2>
            <div className={styles.progressBar}>
              <div className={styles.progress}></div>
            </div>
            <p>7.8 GB of 10 GB used</p>
          </div>
          <div className={styles.infoCard}>
            <h3>Team Members</h3>
            <h2>12</h2>
            <p>8 currently online</p>
          </div>
          <div className={styles.infoCard}>
            <h3>System Status</h3>
            <h2>Operational</h2>
            <p>All services running normally</p>
          </div>
        </section>

        {/* ================= FOOTER ================= */}
        <footer className={styles.footer}>
          <div>2026 Corvianaire Studio</div>
          <div>Version 2.0.0</div>
        </footer>
      </main>
    </div>
  );
}