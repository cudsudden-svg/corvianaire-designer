import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, Link } from "react-router";
import styles from "./styles.module.css";

// Optional: Keep your Shopify loader logic if needed
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
      {/* LEFT PANEL - Branding & Hero */}
      <section className={styles.leftPanel}>

        {/* Diagonal Watermark Background */}
        <div className={styles.watermark}>CORVIANAIRE</div>

        <div className={styles.leftContent}>
          {/* Logo Area */}
          <div className={styles.brand}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" />
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

          {/* Subtext */}
          <p className={styles.subtitle}>
            Create. Customize. Connect.<br />
            Bring your ideas to life with the<br />
            Corvianaire Designer.
          </p>
        </div>

        {/* Graphic Container (Updated strictly to /images/login-hero) */}
        <div className={styles.graphicContainer}>
          <img
            src="/images/login-hero.png"
            alt="Corvianaire Studio Designer Mockup"
            className={styles.heroImage}
          />
        </div>
      </section>

      {/* RIGHT PANEL - Authentication Form */}
      <section className={styles.rightPanel}>
        <div className={styles.topBar}>
          <button className={styles.langSelector}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            English <span>⌄</span>
          </button>
        </div>

        <div className={styles.formContainer}>
          <div className={styles.formHeader}>
            <h2>Welcome back</h2>
            <p>Log in to continue to Corvianaire Designer</p>
          </div>

          <Form className={styles.form} method="post">
            {/* Email Field */}
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email address</label>
              <div className={styles.inputWrapper}>
                <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                <input type="email" id="email" name="email" placeholder="you@example.com" required />
              </div>
            </div>

            {/* Password Field */}
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <div className={styles.inputWrapper}>
                <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <input type="password" id="password" name="password" placeholder="Enter your password" required />
                <button type="button" className={styles.eyeIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                </button>
              </div>
            </div>

            <div className={styles.forgotPassword}>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button type="submit" className={styles.primaryBtn}>
              Log in
            </button>
          </Form>

          <div className={styles.separator}>
            <span>or</span>
          </div>

          {/* Shopify Login Button */}
          <button type="button" className={styles.shopifyBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="black" xmlns="http://www.w3.org/2000/svg"><path d="M17 8V6a5 5 0 0 0-10 0v2H5v14h14V8h-2zm-7-2a3 3 0 0 1 6 0v2h-6V6zm7 14H7v-10h10v10z" /></svg>
            Log in with Shopify
          </button>

          <p className={styles.signupPrompt}>
            Don't have an account? <Link to="/signup">Get started</Link>
          </p>
        </div>
      </section>
    </main>
  );
}