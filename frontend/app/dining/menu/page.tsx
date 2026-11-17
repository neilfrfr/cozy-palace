import Link from "next/link";
import "../dining.css";
import { MenuSections } from "./menu-sections";

export default function DiningMenuPage() {
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
          <a href="#appetizer">Appetizer</a>
          <a href="#main-course">Main Course</a>
          <a href="#dessert">Dessert</a>
          <a href="#beverages">Beverages</a>
        </nav>
        <MenuSections />
      </div>
    </div>
  );
}
