import { diningMenu, type DiningCategory } from "@/app/dining/menu-data";
import { menuImage } from "@/lib/menu";
import { itemPhoto, type SiteContent } from "@/lib/site-content";
import type { MenuRow } from "@/lib/orders";

export function publicDiningMenu(
  rows: MenuRow[],
  content: SiteContent,
): DiningCategory[] {
  return diningMenu
    .map((category) => {
      const section =
        category.title === "Appetizer"
          ? "Appetizers"
          : category.title === "Beverages"
            ? "Drinks"
            : category.title;
      return {
        ...category,
        dishes: rows
          .filter((row) => row.available && row.section === section)
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
      };
    })
    .filter((category) => category.dishes.length > 0);
}
