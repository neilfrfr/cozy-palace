import Link from "next/link";
import "../dining.css";
import { getMenu } from "@/lib/orders";
import { isConfigured } from "@/lib/supabase/config";
import { getSiteContent, itemPhoto } from "@/lib/site-content";
import { menuImage } from "@/lib/menu";
import { diningMenu } from "../menu-data";
import { MenuSections } from "./menu-sections";
export const dynamic = "force-dynamic";
export default async function DiningMenuPage() {
  const [loadedItems, content] = await Promise.all([getMenu(), getSiteContent()]);
  const items = isConfigured() ? loadedItems : diningMenu.flatMap((category) => {
    const section = category.id === "appetizer" ? "Appetizers" : category.id === "main-course" ? "Main Course" : category.id === "dessert" ? "Dessert" : "Drinks";
    return category.dishes.map((dish) => ({ id: dish.name, name: dish.name, section, price: dish.price, available: true, description: dish.description }));
  });
  const sections = [
    { section: "Appetizers", id: "appetizer" },
    { section: "Main Course", id: "main-course" },
    { section: "Dessert", id: "dessert" },
    { section: "Drinks", id: "beverages" },
  ];
  const categories = sections.map(({ section, id }) => {
    const category = diningMenu.find((entry) => entry.id === id)!;
    return {
      ...category,
      dishes: items.filter((item) => item.section === section).map((item) => {
        const fallback = category.dishes.find((dish) => dish.name === item.name);
        return {
          name: item.name,
          description: item.description || fallback?.description || "",
          price: Number(item.price),
          image: itemPhoto(content, "menu", item.id) ?? menuImage(item.name) ?? fallback?.image ?? "/design/menu/lumpia-shooters.jpg",
          available: item.available,
        };
      }),
    };
  });
  return <div className="public-page dining-page dining-full-menu-page"><div className="dining-full-menu-content">
    <Link className="dining-back-link" href="/dining"><span aria-hidden="true">←</span> Back to Dining</Link>
    <header className="dining-full-menu-heading"><p className="eyebrow">Cozy Palace Dining</p><h1>Our Menu</h1><p>Explore the flavors prepared for your table.</p></header>
    <nav className="dining-menu-nav" aria-label="Menu categories"><a href="#appetizer">Appetizer</a><a href="#main-course">Main Course</a><a href="#dessert">Dessert</a><a href="#beverages">Beverages</a></nav>
    <MenuSections categories={categories} />
  </div></div>;
}
