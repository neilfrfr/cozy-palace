import Link from "next/link";
import { PageBanner } from "@/components/page-banner";
import { getSiteContent, photo } from "@/lib/site-content";
import { InquiryForm } from "./inquiry-form";

export default async function Contact() {
  const content = await getSiteContent();

  return (
    <div className="public-page">
      <PageBanner
        eyebrow="Contact"
        title="Get in Touch."
        intro="Our concierge team is available 24 hours a day to assist with reservations, dining, and special requests."
        image={photo(content, "photo.contact")}
        position="center 25%"
      />

      <section className="section mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-12 px-4 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="lg:col-span-5">
          <p className="eyebrow">Concierge</p>
          <h2>Contact Information</h2>
          <p className="intro">
            We are always happy to help make your stay feel special. Please
            don&apos;t hesitate to reach out.
          </p>

          <dl className="details !grid-cols-1 sm:!grid-cols-2">
            <div>
              <dt>PHONE</dt>
              <dd>
                <a href="tel:+639171234567">+63 917 123 4567</a>
              </dd>
            </div>
            <div>
              <dt>EMAIL</dt>
              <dd>
                <a href="mailto:cozypalace.bookings@gmail.com">
                  cozypalace.bookings@gmail.com
                </a>
              </dd>
            </div>
            <div>
              <dt>ADDRESS</dt>
              <dd>
                123 Placeholder Street, Makati City, Metro Manila, Philippines
              </dd>
            </div>
            <div>
              <dt>HOURS</dt>
              <dd>
                Front desk: open 24 hours
                <br />
                Restaurant: 11:00–14:00 and 17:00–21:00
              </dd>
            </div>
          </dl>

          <div className="actions">
            <Link className="button" href="/rooms">
              Explore Rooms
            </Link>
            <Link className="button secondary" href="/dining">
              Book a Table
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <InquiryForm />
        </div>
      </section>
    </div>
  );
}
