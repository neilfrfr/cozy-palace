import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";
import "./hotel.css";
export const metadata: Metadata = {
  title: {
    default: "Cozy Palace Hotel and Restaurant",
    template: "%s | Cozy Palace",
  },
  description: "Book your stay and keep every reservation in one place.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="hidden-label focus:not-sr-only">
          Skip to content
        </a>
        <SiteNav />
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <Link className="brand" href="/">
                Cozy Palace<span>Hotel and Restaurant</span>
              </Link>
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
            </nav>
            <nav className="footer-links" aria-label="Your stay">
              <h2>Your stay</h2>
              <Link href="/reservations">My Reservations</Link>
              <Link href="/login">Sign in</Link>
              <Link href="/register">Create an Account</Link>
              <Link href="/staff/register">Staff Registration</Link>
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
