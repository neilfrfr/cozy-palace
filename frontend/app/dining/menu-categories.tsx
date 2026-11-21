import Image from "next/image";
import Link from "next/link";
import type { DiningCategory } from "./menu-data";

export function MenuCategories({ categories }: { categories: DiningCategory[] }) {
  return (
    <div className="dining-card-grid">
      {categories.map((category) => (
        <article className="room dining-card" key={category.id}>
          <div className="dining-card-photo">
            <Image
              src={category.dishes[0].image}
              alt={category.dishes[0].name}
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
            />
          </div>
          <div className="room-card-top">
            <span className="eyebrow">{category.tag}</span>
            <span className="room-number">{category.dishes.length} selections</span>
          </div>
          <h2>{category.title}</h2>
          <p>{category.description}</p>
          <p className="subtle dining-featured-item">
            Featured: {category.dishes[0].name}
          </p>
          <div className="room-bottom">
            <div className="price">
              ₱{Math.min(...category.dishes.map((dish) => dish.price))}{" "}
              <small>starting price</small>
            </div>
            <Link className="button secondary" href={`/dining/menu#${category.id}`}>
              View menu
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
