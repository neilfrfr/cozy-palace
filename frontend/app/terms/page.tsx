import Link from "next/link";
export const metadata = { title: "Terms and Conditions" };
export default function Terms() {
  return (
    <div className="login terms-page">
      <Link className="back-link" href="/login">
        ← Back to sign in
      </Link>
      <h1>Terms and Conditions</h1>
      <p className="intro">
        Please review these terms before signing in or creating your account.
      </p>
      <h2>Reservations</h2>
      <p>
        Check your room or table, dates, guest count, and contact details
        before confirming. A confirmation screen shows the details of your
        reservation.
      </p>
      <h2>Payment</h2>
      <p>
        Your booking summary identifies whether payment is collected online or
        is due at the hotel. Keep your reservation ID and payment receipt for
        reference.
      </p>
      <h2>Changes and cancellations</h2>
      <p>
        Use your reservation details to review or cancel a booking. Contact
        Cozy Palace Hotel and Restaurant for applicable booking conditions and
        any refund questions.
      </p>
      <h2>Your information</h2>
      <p>
        Provide accurate contact details so the hotel can send booking updates.
        Use <Link href="/contact">Contact</Link> for questions about your
        account or reservation.
      </p>
    </div>
  );
}
