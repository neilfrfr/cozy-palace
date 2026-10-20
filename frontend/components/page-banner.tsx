import Image from "next/image";

/** Full-width photo banner that opens each public page below the header. */
export function PageBanner({
  eyebrow,
  title,
  intro,
  image = "/design/hotel-hero.jpg",
  position = "center",
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  image?: string;
  position?: string;
}) {
  return (
    <section className="page-banner" aria-labelledby="page-title">
      <Image
        src={image}
        alt=""
        fill
        preload
        sizes="100vw"
        className="page-banner-image"
        style={{ objectPosition: position }}
      />
      <div className="page-banner-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="page-title">{title}</h1>
        {intro && <p className="page-banner-intro">{intro}</p>}
      </div>
    </section>
  );
}
