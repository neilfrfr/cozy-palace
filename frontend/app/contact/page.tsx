import { PageBanner } from "@/components/page-banner";
import Link from "next/link";
export default function Contact() {
  return (
    <div className="public-page">
      <PageBanner
        eyebrow="Contact"
        title="Get in touch."
        intro="Questions about your reservation?"
        position="center 25%"
      />
      <section className="panel">
        <h2>Contact Information</h2>
        <p>Contact details are not available yet.</p>
        <p className="subtle">
          A verified phone number, email address, business address and opening
          hours have not been published for this prototype.
        </p>
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
