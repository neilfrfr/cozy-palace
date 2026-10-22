export type MenuItem = { name: string; image: string };
export type MenuSection = { title: string; items: MenuItem[] };

const item = (name: string, file: string): MenuItem => ({
  name,
  image: `/design/menu/${file}.jpg`,
});

export const menu: MenuSection[] = [
  {
    title: "Appetizers",
    items: [
      item("Lumpia Shooters", "lumpia-shooters"),
      item("Lemon Garlic Calamari", "lemon-garlic-calamari"),
      item("Malunggay Niçoise Salad", "malunggay-nicoise-salad"),
    ],
  },
  {
    title: "Main Course",
    items: [
      item("Kare-kare with Lechon Kawali", "kare-kare-lechon-kawali"),
      item("Crispy Cordon Bleu", "crispy-cordon-bleu"),
      item("Prawn Sinigang with Guava", "prawn-sinigang-guava"),
    ],
  },
  {
    title: "Dessert",
    items: [
      item("Halo-halo", "halo-halo"),
      item("Creamy Buko Tart", "creamy-buko-tart"),
      item("Assorted Kakanin", "assorted-kakanin"),
    ],
  },
  {
    title: "Drinks",
    items: [
      item("Premium Wine", "premium-wine"),
      item("Fresh Pineapple Juice", "fresh-pineapple-juice"),
      item("Fruit Smoothie", "fruit-smoothie"),
    ],
  },
];
