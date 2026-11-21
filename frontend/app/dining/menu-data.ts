export type DiningDish = {
  id?: string;
  name: string;
  description: string;
  price: number;
  image: string;
};

export type DiningCategory = {
  title: string;
  id: "appetizer" | "main-course" | "dessert" | "beverages";
  tag: string;
  description: string;
  dishes: DiningDish[];
};

export const diningMenu: DiningCategory[] = [
  {
    title: "Appetizer",
    id: "appetizer",
    tag: "COURSE 01",
    description: "A thoughtful beginning, prepared to awaken the palate.",
    dishes: [
      { name: "Lumpia Shooters", description: "Crisp Filipino spring rolls served as a lively, shareable first bite.", price: 220, image: "/design/menu/lumpia-shooters.jpg" },
      { name: "Lemon Garlic Calamari", description: "Tender calamari brightened with lemon and savory garlic.", price: 320, image: "/design/menu/lemon-garlic-calamari.jpg" },
      { name: "Malunggay Niçoise Salad", description: "A fresh Niçoise inspired salad with a local malunggay touch.", price: 280, image: "/design/menu/malunggay-nicoise-salad.jpg" },
    ],
  },
  {
    title: "Main Course",
    id: "main-course",
    tag: "COURSE 02",
    description: "Seasonal favorites and generous plates from our kitchen.",
    dishes: [
      { name: "Kare-kare with Lechon Kawali", description: "Rich Filipino kare-kare paired with crisp lechon kawali.", price: 520, image: "/design/menu/kare-kare-lechon-kawali.jpg" },
      { name: "Crispy Cordon Bleu", description: "A golden, crisp take on the classic cordon bleu.", price: 450, image: "/design/menu/crispy-cordon-bleu.jpg" },
      { name: "Prawn Sinigang with Guava", description: "Comforting prawn sinigang lifted with the gentle sweetness of guava.", price: 580, image: "/design/menu/prawn-sinigang-guava.jpg" },
    ],
  },
  {
    title: "Dessert",
    id: "dessert",
    tag: "COURSE 03",
    description: "A sweet finish, made for sharing and savoring.",
    dishes: [
      { name: "Halo-halo", description: "A beloved Filipino shaved-ice dessert layered with colorful treats.", price: 180, image: "/design/menu/halo-halo.jpg" },
      { name: "Creamy Buko Tart", description: "A smooth coconut tart in a delicate pastry shell.", price: 150, image: "/design/menu/creamy-buko-tart.jpg" },
      { name: "Assorted Kakanin", description: "A selection of traditional Filipino rice delicacies.", price: 160, image: "/design/menu/assorted-kakanin.jpg" },
    ],
  },
  {
    title: "Beverages",
    id: "beverages",
    tag: "COURSE 04",
    description: "Refreshing pours and carefully chosen favorites.",
    dishes: [
      { name: "Premium Wine", description: "A considered wine selection to complement your meal.", price: 350, image: "/design/menu/premium-wine.jpg" },
      { name: "Fresh Pineapple Juice", description: "Bright, refreshing juice made with pineapple.", price: 120, image: "/design/menu/fresh-pineapple-juice.jpg" },
      { name: "Fruit Smoothie", description: "A cool, blended fruit drink for a refreshing pause.", price: 150, image: "/design/menu/fruit-smoothie.jpg" },
    ],
  },
];
