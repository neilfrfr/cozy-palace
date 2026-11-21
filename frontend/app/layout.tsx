import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { readNavState } from "@/lib/auth/nav-state";
import { getSiteContent, text } from "@/lib/site-content";
import "./globals.css";
import "./hotel.css";
export const metadata: Metadata = {
  title: {
    default: "Cozy Palace Hotel and Restaurant",
    template: "%s | Cozy Palace",
  },
  description: "Book your stay and keep every reservation in one place.",
};
/** My Reservations, or the work dashboard, once someone is signed in. */
async function FooterStayLink() {
  const { signedIn, home, employee } = await readNavState();
  if (!signedIn) return null;
  return (
    <Link href={home}>{employee ? "Work dashboard" : "My Reservations"}</Link>
  );
}
export default async function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const content = await getSiteContent();
  return (
    <html lang="en">
      <body>
        <a href="#main" className="hidden-label focus:not-sr-only">
          Skip to content
        </a>
        <SiteNav />
        <main id="main">{children}</main>
        {modal}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <Link className="brand" href="/">
                Cozy Palace<span>Hotel and Restaurant</span>
              </Link>
              <p>
                <span className="pre-line">{text(content, "contact.address")}</span>
                <br />
                {text(content, "contact.phone")}
                <br />
                {text(content, "contact.email")}
              </p>
              <p>
                A prototype booking site. Rates are fictional, prices are in
                Philippine pesos, and times are in Asia/Manila.
              </p>
            </div>
            <nav className="footer-links" aria-label="Explore">
              <h2>Explore</h2>
              <Link href="/rooms">Rooms</Link>
              <Link href="/dining">Dining</Link>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/privacy">Privacy Notice</Link>
            </nav>
            <nav className="footer-links" aria-label="Your stay">
              <h2>Your stay</h2>
              <FooterStayLink />
              <Link href="/login">Log in</Link>
              <Link href="/register">Create an Account</Link>
            </nav>
          </div>
          <p className="footer-legal">
            © {new Date().getFullYear()} Cozy Palace Hotel and Restaurant
          </p>
        </footer>
      </body>
    </html>
  );
}
