import Link from "next/link";
export default function Contact() {
  return (
    <>
      <p className="eyebrow">COZY PALACE</p>
      <h1>Get in touch.</h1>
      <p className="intro">Questions about your reservation?</p>
      <section className="panel">
        <h2>Contact information</h2>
        <p>Contact details are not available yet.</p>
        <p className="subtle">
          A verified phone number, email address, business address and opening
          hours have not been published for this prototype.
        </p>
        <div className="actions">
          <Link className="button" href="/reservations">
            View my reservations
          </Link>
          <Link className="button secondary" href="/rooms">
            Explore rooms
          </Link>
        </div>
      </section>
    </>
  );
}
