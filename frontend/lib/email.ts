import "server-only";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/**
 * Emails a visitor without an account the details of their booking through Resend. This email is
 * their only record of it. Returns false when not configured or not sent.
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
  /** Booking id: a replayed request gets the same id, so it sends one email. */
  id: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY,
    from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  const lines = [
    `Hello ${p.name},`,
    `We received your booking request ${p.reference}: ${p.booking}, ${p.guests} guest${p.guests === 1 ? "" : "s"}.`,
    p.next,
    `To change or cancel it, contact the front desk and quote ${p.reference}.`,
    "Cozy Palace Hotel and Restaurant",
  ];
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + key,
        "content-type": "application/json",
        "idempotency-key": "booking-" + p.id,
      },
      body: JSON.stringify({
        from,
        to: [p.to],
        subject: `Your Cozy Palace booking ${p.reference}`,
        text: lines.join("\n\n"),
        html: lines.map((l) => `<p>${escape(l)}</p>`).join(""),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("Booking email failed", res.status);
    return res.ok;
  } catch (error) {
    console.error("Booking email failed", error);
    return false;
  }
}
