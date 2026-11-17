import { text, type SiteContent } from "@/lib/site-content";

/** Phone, email, address and opening hours, as edited on the admin Website page. */
export function ContactDetails({ content }: { content: SiteContent }) {
  const phone = text(content, "contact.phone");
  const email = text(content, "contact.email");
  return (
    <dl className="details">
      <div>
        <dt>Phone</dt>
        <dd>
          <a href={"tel:" + phone.replace(/[^\d+]/g, "")}>{phone}</a>
        </dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>
          <a href={"mailto:" + email}>{email}</a>
        </dd>
      </div>
      <div>
        <dt>Address</dt>
        <dd className="pre-line">{text(content, "contact.address")}</dd>
      </div>
      <div>
        <dt>Opening hours</dt>
        <dd className="pre-line">{text(content, "contact.hours")}</dd>
      </div>
    </dl>
  );
}
