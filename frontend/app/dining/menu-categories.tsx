import Image from "next/image";
import Link from "next/link";
import { diningMenu } from "./menu-data";
import { menuImage } from "@/lib/menu";
import { itemPhoto, type SiteContent } from "@/lib/site-content";
import type { MenuRow } from "@/lib/orders";

export function MenuCategories({ items, content }: { items: MenuRow[]; content: SiteContent }) {
  const map = [
    { section: "Appetizers", id: "appetizer" as const },
    { section: "Main Course", id: "main-course" as const },
    { section: "Dessert", id: "dessert" as const },
    { section: "Drinks", id: "beverages" as const },
  ];
  return <div className="dining-card-grid">{map.map(({ section, id }) => {
    const category = diningMenu.find((c) => c.id === id)!;
    const dishes = items.filter((dish) => dish.section === section);
    if (!dishes.length) return null;
    const featured = dishes[0];
    const fallback = category.dishes[0];
    const image = itemPhoto(content, "menu", featured.id) ?? menuImage(featured.name) ?? fallback.image;
    return <article className="room dining-card" key={id}>
      <div className="dining-card-photo"><Image src={image} alt={featured.name} fill sizes="(max-width: 760px) 100vw, 50vw" /></div>
      <div className="room-card-top"><span className="eyebrow">{category.tag}</span><span className="room-number">{dishes.length} selections</span></div>
      <h2>{category.title}</h2><p>{category.description}</p>
      <p className="subtle dining-featured-item">Featured: {featured.name}{!featured.available && <span className="unavailable-badge">Not Available</span>}</p>
      <div className="room-bottom"><div className="price">₱{Math.min(...dishes.map((dish) => Number(dish.price))).toLocaleString("en-PH")} <small>starting price</small></div><Link className="button secondary" href={`/dining/menu#${id}`}>View menu</Link></div>
    </article>;
  })}</div>;
}
