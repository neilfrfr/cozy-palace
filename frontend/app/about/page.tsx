import { PageBanner } from "@/components/page-banner";
import Link from "next/link";
import { getSiteContent, photo, text } from "@/lib/site-content";
export default async function About() {
  const content = await getSiteContent();
  return (
    <div className="public-page">
      <PageBanner
        eyebrow="About"
        title={text(content, "about.title")}
        intro={text(content, "about.intro")}
        image={photo(content, "photo.about")}
        position="center 65%"
      />
      <div className="grid">
        <section className="panel">
          <h2>Plan your stay</h2>
          <p>
            Browse the current room inventory, choose dates and guests, and
            review your reservation before sending a request.
          </p>
          <Link href="/rooms">Explore rooms →</Link>
        </section>
        <section className="panel">
          <h2>Keep your details together</h2>
          <p>
            Sign in to view your own reservations and follow their status from
            request to arrival.
          </p>
          <Link href="/reservations">My Reservations →</Link>
        </section>
      </div>
      <p className="notice">
        This is a development prototype with fictional inventory. It is not
        accepting real commercial bookings.
      </p>
    </div>
  );
}
