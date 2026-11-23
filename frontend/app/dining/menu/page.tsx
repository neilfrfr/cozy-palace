import Link from "next/link";
import "../dining.css";
import { MenuSections } from "./menu-sections";
import { getMenu, getMenuSections } from "@/lib/orders";
import { getSiteContent } from "@/lib/site-content";
import { isConfigured } from "@/lib/supabase/config";
import { publicDiningMenu } from "@/lib/public-dining-menu";
import { diningMenu } from "../menu-data";

export const dynamic = "force-dynamic";

export default async function DiningMenuPage() {
  let categories = diningMenu;
  let failed = false;
  if (isConfigured()) {
    const loaded = await Promise.all([
      getMenu(),
      getMenuSections(),
      getSiteContent(),
    ]).catch(() => null);
    categories = loaded ? publicDiningMenu(...loaded) : [];
    failed = !loaded;
  }
  return (
    <div className="public-page dining-page dining-full-menu-page">
      <div className="dining-full-menu-content">
        <Link className="dining-back-link" href="/dining">
          <span aria-hidden="true">←</span> Back to Dining
        </Link>
        <header className="dining-full-menu-heading">
          <p className="eyebrow">Cozy Palace Dining</p>
          <h1>Our Menu</h1>
          <p>Explore the flavors prepared for your table.</p>
        </header>
        <nav className="dining-menu-nav" aria-label="Menu categories">
          {categories.map((category) => (
            <a key={category.id} href={`#${category.id}`}>
              {category.title}
            </a>
          ))}
        </nav>
        {failed ? (
          <div className="notice error" role="alert">
            We could not load the menu. Please refresh and try again.
          </div>
        ) : categories.length ? (
          <MenuSections categories={categories} />
        ) : (
          <p className="empty">No menu items are currently available.</p>
        )}
      </div>
    </div>
  );
}
