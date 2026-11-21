import Link from "next/link";
import { PageBanner } from "@/components/page-banner";
import { getSiteContent, photo, text } from "@/lib/site-content";
import { InquiryForm } from "./inquiry-form";

export default async function Contact() {
  const content = await getSiteContent();
  const phone = text(content, "contact.phone");
  const email = text(content, "contact.email");

  return (
    <div className="public-page">
      <PageBanner
        eyebrow="Contact"
        title={text(content, "contact.title")}
        intro={text(content, "contact.intro")}
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
                <a href={"tel:" + phone.replace(/[^\d+]/g, "")}>{phone}</a>
              </dd>
            </div>
            <div>
              <dt>EMAIL</dt>
              <dd>
                <a href={"mailto:" + email}>{email}</a>
              </dd>
            </div>
            <div>
              <dt>ADDRESS</dt>
              <dd className="pre-line">{text(content, "contact.address")}</dd>
            </div>
            <div>
              <dt>HOURS</dt>
              <dd className="pre-line">{text(content, "contact.hours")}</dd>
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
