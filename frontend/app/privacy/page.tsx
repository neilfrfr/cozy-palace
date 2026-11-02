import Link from "next/link";
export const metadata = { title: "Privacy Notice" };
export default function Privacy() {
  return (
    <div className="login terms-page">
      <h1>Privacy Notice</h1>
      <p className="intro">
        How Cozy Palace Hotel and Restaurant uses the details you give us when
        you book a room or a table.
      </p>
      <h2>What we collect</h2>
      <p>
        Your name, email address and phone number, plus the dates, guest count
        and room or table you choose. If you pay online, the payment is handled
        by our payment provider; we do not see or store your e-wallet or card
        details.
      </p>
      <h2>Why we use it</h2>
      <p>
        To hold and confirm your booking, to email you booking updates and
        reminders, and to contact you about your stay. We do not sell your
        details or use them for marketing.
      </p>
      <h2>Who can see it</h2>
      <p>
        Hotel and restaurant staff who handle your booking, and the service
        providers that host this site, send our emails and process payments.
      </p>
      <h2>Your choices</h2>
      <p>
        You can ask to see, correct or delete your details. Use{" "}
        <Link href="/contact">Contact</Link> and quote your booking reference
        if you have one.
      </p>
    </div>
  );
}
