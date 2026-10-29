import "server-only";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Emails a visitor their private booking link through Resend. Returns false when not configured or not sent. */
export async function sendBookingLink(p: {
  to: string;
  name: string;
  reference: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  link: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY,
    from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  const lines = [
    `Hello ${p.name},`,
    `Your booking request ${p.reference} is held: ${p.checkIn} to ${p.checkOut}, ${p.guests} guest${p.guests === 1 ? "" : "s"}.`,
    "View, pay for or cancel it with your private link (keep it to yourself; anyone with it can do the same):",
    p.link,
    "Unpaid requests are released after 24 hours, or sooner if you arrive sooner.",
    "Cozy Palace Hotel and Restaurant",
  ];
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + key,
        "content-type": "application/json",
        // A replayed booking gets a new link, so the link identifies one email.
        "idempotency-key": "booking-link-" + p.link.slice(-64),
      },
      body: JSON.stringify({
        from,
        to: [p.to],
        subject: `Your Cozy Palace booking ${p.reference}`,
        text: lines.join("\n\n"),
        html: lines
          .map((l) =>
            l === p.link
              ? `<p><a href="${escape(l)}">${escape(l)}</a></p>`
              : `<p>${escape(l)}</p>`,
          )
          .join(""),
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
