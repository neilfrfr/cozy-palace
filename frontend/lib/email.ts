import "server-only";
import { createTransport } from "nodemailer";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/**
 * Emails a visitor without an account the details of their booking from the hotel's Gmail account.
 * This email is their only record of it. Returns false when not configured or not sent.
 */
export async function sendBookingEmail(p: {
  to: string;
  name: string;
  reference: string;
  /** e.g. "Deluxe · Room 101, 2027-01-10 to 2027-01-12" or "Table T5, 2027-01-10 at 19:00". */
  booking: string;
  guests: number;
  /** What happens next, e.g. how long the hold lasts. */
  next: string;
  /** Booking id, used as the Message-ID so a resend reads as the same email. */
  id: string;
}): Promise<boolean> {
  const user = process.env.GMAIL_USER,
    // Google shows app passwords in groups of four with spaces.
    pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) return false;
  const lines = [
    `Hello ${p.name},`,
    `We received your booking request ${p.reference}: ${p.booking}, ${p.guests} guest${p.guests === 1 ? "" : "s"}.`,
    p.next,
    `To change or cancel it, contact the front desk and quote ${p.reference}.`,
    "Cozy Palace Hotel and Restaurant",
  ];
  try {
    // shortcut: Gmail has no idempotency key, so a replayed booking request emails twice; fine at hotel volume.
    await createTransport({
      service: "gmail",
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    }).sendMail({
      from: { name: "Cozy Palace", address: user },
      to: p.to,
      subject: `Your Cozy Palace booking ${p.reference}`,
      text: lines.join("\n\n"),
      html: lines.map((l) => `<p>${escape(l)}</p>`).join(""),
      messageId: `<booking-${p.id}@cozypalace>`,
    });
    return true;
  } catch (error) {
    console.error("Booking email failed", error);
    return false;
  }
}
