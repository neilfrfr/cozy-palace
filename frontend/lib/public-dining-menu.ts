import type { DiningCategory } from "@/app/dining/menu-data";
import { menuImage } from "@/lib/menu";
import { itemPhoto, type SiteContent } from "@/lib/site-content";
import type { MenuRow, MenuSection } from "@/lib/orders";

/** Sections and items as the admin arranged them, limited to what is orderable and on the website. */
export function publicDiningMenu(
  rows: MenuRow[],
  sections: MenuSection[],
  content: SiteContent,
): DiningCategory[] {
  return sections
    .map((section, i) => ({
      title: section.name,
      id: section.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || section.id,
      tag: "COURSE " + String(i + 1).padStart(2, "0"),
      description: section.description,
      dishes: rows
        .filter((row) => row.available && row.on_website && row.section === section.name)
        .map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          price: Number(row.price),
          image:
            itemPhoto(content, "menu", row.id) ??
            menuImage(row.name) ??
            "/design/dining.jpg",
        })),
    }))
    .filter((category) => category.dishes.length > 0);
}
