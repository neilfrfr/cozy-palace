import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
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
        <SiteNav />
        <main id="main">{children}</main>
        <footer className="footer">
          <span>Cozy Palace Hotel and Restaurant</span>
          <Link href="/contact">Contact</Link>
          <span>Prototype · PHP · Asia/Manila</span>
        </footer>
      </body>
    </html>
  );
}
