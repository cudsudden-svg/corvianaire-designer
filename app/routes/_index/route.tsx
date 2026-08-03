import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form } from "react-router";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return null;
};

export default function Login() {
  return (
    <main className={styles.page}>
      {/* LEFT PANEL - Branding & Floating Canvas */}
      <section className={styles.leftPanel}>
        
        {/* Background Watermark */}
        <div className={styles.watermark}>CORVIANAIRE</div>

        <div className={styles.leftContent}>
          {/* Brand Logo */}
          <div className={styles.brand}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className={styles.brandText}>
              <span className={styles.brandName}>CORVIANAIRE</span>
              <span className={styles.brandSub}>S T U D I O</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className={styles.title}>
            Design Without <br />
            <span className={styles.titleHighlight}>Limits.</span>
          </h1>
          <hr className={styles.divider} />

          {/* Description */}
          <p className={styles.subtitle}>
            Create. Customize. Connect.<br />
            Bring your ideas to life with the<br />
            Corvianaire Designer.
          </p>
        </div>

        {/* Floating Sketch Card */}
        <div className={styles.graphicContainer}>
          <img 
            src="/images/login-hero.png" 
            alt="Corvianaire Studio Designer Mockup" 
            className={styles.heroImage} 
          />
        </div>
      </section>

      {/* RIGHT PANEL - Shopify SSO Authentication */}
      <section className={styles.rightPanel}>
        <div className={styles.topBar}>
          <button className={styles.langSelector}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z"/></svg>
            English <span>⌄</span>
          </button>
        </div>

        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <span className={styles.authTag}>Corvianaire Studio</span>
            <h2>Build premium apparel experiences for your Shopify store.</h2>
          </div>

          {/* Direct Shopify Authentication Trigger */}
          <Form method="post" className={styles.ssoForm}>
            <button type="submit" className={styles.shopifyPrimaryBtn}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 8V6a5 5 0 0 0-10 0v2H5v14h14V8h-2zm-7-2a3 3 0 0 1 6 0v2h-6V6zm7 14H7v-10h10v10z"/>
              </svg>
              Continue with Shopify
            </button>
          </Form>

          {/* Feature Checklist */}
          <ul className={styles.featureList}>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A3B18A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Secure Shopify authentication
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A3B18A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              No separate account required
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A3B18A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Manage custom apparel designs
            </li>
          </ul>

          {/* Footer Help Links */}
          <div className={styles.supportFooter}>
            <p>Need help?</p>
            <div className={styles.supportLinks}>
              <a href="/docs">Documentation</a>
              <span>•</span>
              <a href="/support">Contact Support</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}