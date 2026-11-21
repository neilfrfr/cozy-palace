"use client";
import Image from "next/image";
import { useEffect } from "react";
import type { DiningCategory } from "../menu-data";
export type PublicMenuCategory = Omit<DiningCategory, "dishes"> & { dishes: (DiningCategory["dishes"][number] & { available: boolean })[] };
export function MenuSections({ categories }: { categories: PublicMenuCategory[] }) {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    requestAnimationFrame(() => { target.focus({ preventScroll: true }); target.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }, []);
  return <div className="full-menu-sections">{categories.map((category) => <section className="full-menu-category" id={category.id} key={category.id} aria-labelledby={`${category.id}-title`} tabIndex={-1}>
    <div className="full-menu-category-heading"><p className="eyebrow">{category.tag}</p><h2 id={`${category.id}-title`}>{category.title}</h2><p>{category.description}</p></div>
    <div className="full-menu-dishes">{category.dishes.map((dish) => <article className={`full-menu-dish${dish.available ? "" : " unavailable"}`} key={dish.name}>
      <div className="full-menu-dish-photo"><Image src={dish.image} alt={dish.name} fill sizes="(max-width: 760px) 100vw, 33vw" /></div>
      <div className="full-menu-dish-copy"><div className="full-menu-dish-title"><h3>{dish.name}</h3><span>₱{dish.price.toLocaleString("en-PH")}</span></div>{dish.description && <p>{dish.description}</p>}{!dish.available && <span className="unavailable-badge" role="status">Not Available</span>}</div>
    </article>)}</div>
  </section>)}</div>;
}
