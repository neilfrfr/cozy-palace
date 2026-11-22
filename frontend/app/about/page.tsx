import Image from "next/image";
import Link from "next/link";
import { PageBanner } from "@/components/page-banner";
import { getSiteContent, photo, text } from "@/lib/site-content";

const pillars = ["rest", "gather", "welcome"] as const;
const stories = [
  { key: "rooms", href: "/rooms", link: "Explore rooms" },
  { key: "dining", href: "/dining", link: "Explore dining" },
] as const;

/** A short brand story: statement, three pillars, two photo stories and a closing call to action. Every line is editable under admin Website. */
export default async function About() {
  const content = await getSiteContent();
  return (
    <div className="public-page about-page">
      <PageBanner
        eyebrow="About"
        title={text(content, "about.title")}
        intro={text(content, "about.intro")}
        image={photo(content, "photo.about")}
        position="center 65%"
      />
      <p className="about-statement">{text(content, "about.statement")}</p>
      <section className="about-pillars" aria-label="What we care about">
        {pillars.map((p) => (
          <article key={p}>
            <div className="about-photo about-photo-tall">
              <Image
                src={photo(content, `photo.about.${p}`)}
                alt=""
                fill
                sizes="(max-width: 760px) 100vw, 33vw"
              />
            </div>
            <p className="eyebrow">{text(content, `about.${p}.eyebrow`)}</p>
            <h2>{text(content, `about.${p}.title`)}</h2>
            <p>{text(content, `about.${p}.body`)}</p>
          </article>
        ))}
      </section>
      {stories.map((s, i) => (
        <section key={s.key} className={i ? "about-story flip" : "about-story"}>
          <div className="about-photo">
            <Image
              src={photo(content, `photo.about.${s.key}`)}
              alt=""
              fill
              sizes="(max-width: 760px) 100vw, 55vw"
            />
          </div>
          <div className="about-story-copy">
            <h2>{text(content, `about.${s.key}.title`)}</h2>
            <p>{text(content, `about.${s.key}.body`)}</p>
            <Link href={s.href}>{s.link} →</Link>
          </div>
        </section>
      ))}
      <section className="about-cta">
        <h2>{text(content, "about.cta.title")}</h2>
        <p>{text(content, "about.cta.body")}</p>
        <div className="actions">
          <Link className="button gold" href="/rooms">
            Book a stay
          </Link>
          <Link className="button outline-light" href="/reservations">
            My Reservations
          </Link>
        </div>
      </section>
    </div>
  );
}
