import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
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
        <header className="site-header">
          <nav className="nav" aria-label="Main navigation">
            <Link className="brand" href="/">
              Cozy Palace<span>Hotel and Restaurant</span>
            </Link>
            <div className="nav-links">
              <Link href="/rooms">Rooms</Link>
              <Link href="/reservations">My reservations</Link>
              <Link href="/login">Sign in</Link>
            </div>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer className="footer">
          <span>Cozy Palace Hotel and Restaurant</span>
          <span>Prototype · PHP · Asia/Manila</span>
        </footer>
      </body>
    </html>
  );
}
