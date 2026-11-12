import { PageBanner } from "@/components/page-banner";
import { ContactDetails } from "@/components/contact-details";
import Link from "next/link";
import { getSiteContent, photo, text } from "@/lib/site-content";
export default async function Contact() {
  const content = await getSiteContent();
  return (
    <div className="public-page">
      <PageBanner
        eyebrow="Contact"
        title={text(content, "contact.title")}
        intro={text(content, "contact.intro")}
        image={photo(content, "photo.contact")}
        position="center 25%"
      />
      <section className="panel">
        <h2>Contact Information</h2>
        <ContactDetails content={content} />
        <div className="actions">
          <Link className="button" href="/reservations">
            View My Reservations
          </Link>
          <Link className="button secondary" href="/rooms">
            Explore rooms
          </Link>
        </div>
      </section>
    </div>
  );
}
