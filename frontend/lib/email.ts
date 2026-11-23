import "server-only";
import { createTransport } from "nodemailer";
import { getSiteContent, text } from "@/lib/site-content";
import { siteOrigin } from "@/lib/accounts/site-url";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/**
 * Wraps the body in the Supabase auth-email design (header, gold rule, heading, footer),
 * with the tagline and hotel contact details from the website editor.
 */
async function branded(p: {
  to: string;
  heading: string;
  preheader?: string;
  lines: string[];
  button?: EmailButton;
  reason?: string;
}) {
  const c = await getSiteContent();
  const rawTagline = text(c, "footer.tagline"),
    rawEmail = text(c, "contact.email"),
    rawAddress = text(c, "contact.address").replace(/\s*\n\s*/g, ", "),
    rawPhone = text(c, "contact.phone");
  const tagline = escape(rawTagline),
    email = escape(rawEmail);
  const sentTo = `This email was sent to ${p.to} ${p.reason ?? "because of your contact with Cozy Palace"}.`;
  const site = siteOrigin();
  const link = (path: string, label: string) =>
    `<a href="${site}${path}" style="color:#152238;text-decoration:underline;">${label}</a>`;
  const body = p.lines
    .map((l) => `<p style="margin:0 0 16px;">${escape(l)}</p>`)
    .join("");
  const sans = "font-family:Arial,Helvetica,sans-serif;";
  const serif = "font-family:Georgia,'Times New Roman',serif;";
  const html = `<div style="margin:0;padding:0;background-color:#faf7f1;">
${p.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#faf7f1;font-size:1px;line-height:1px;">${escape(p.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf7f1;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e7e0d3;">
<tr><td align="center" style="background-color:#152238;padding:28px 24px 22px;">
${site ? `<a href="${site}" style="text-decoration:none;">` : ""}<div style="${serif}font-size:30px;line-height:34px;color:#c9a24b;letter-spacing:1px;">Cozy Palace</div>
<div style="${sans}font-size:11px;line-height:16px;color:#f9f5eb;letter-spacing:3px;text-transform:uppercase;padding-top:4px;">${tagline}</div>${site ? "</a>" : ""}
</td></tr>
<tr><td style="background-color:#c9a24b;height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
<tr><td style="padding:32px 32px 24px;${sans}font-size:15px;line-height:24px;color:#262320;">
<h1 style="margin:0 0 16px;${serif}font-size:24px;line-height:30px;font-weight:normal;color:#152238;">${escape(p.heading)}</h1>
${body}
${
  p.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="background-color:#152238;border-radius:4px;"><a href="${escape(p.button.url)}" style="display:inline-block;padding:13px 28px;${sans}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${escape(p.button.label)}</a></td></tr></table>
<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#6b665f;">If the button doesn't work, copy this link into your browser:<br /><a href="${escape(p.button.url)}" style="color:#152238;word-break:break-all;">${escape(p.button.url)}</a></p>`
    : ""
}
</td></tr>
<tr><td align="center" style="background-color:#faf7f1;border-top:1px solid #e7e0d3;padding:24px 32px;${sans}font-size:12px;line-height:19px;color:#6b665f;">
<div style="${serif}font-size:15px;color:#152238;padding-bottom:6px;">Cozy Palace ${tagline}</div>
${site ? `<div style="padding-bottom:10px;">${link("/rooms", "Rooms")} &nbsp;&middot;&nbsp; ${link("/dining", "Dining")} &nbsp;&middot;&nbsp; ${link("/reservations", "My reservations")}</div>` : ""}
<div style="padding-bottom:10px;">${escape(rawAddress)}<br />${escape(rawPhone)} &nbsp;&middot;&nbsp; <a href="mailto:${email}" style="color:#152238;">${email}</a></div>
<div style="padding-bottom:10px;">Questions? Reply to this email or call the front desk.</div>
<div>${escape(sentTo)} Prices are in Philippine pesos and times are in Asia/Manila.</div>
<div style="padding-top:10px;color:#8a847b;">&copy; Cozy Palace ${tagline}</div>
</td></tr>
</table></td></tr></table></div>`;
  const textBody = [
    `Cozy Palace · ${rawTagline}`,
    p.heading,
    ...p.lines,
    ...(p.button ? [`${p.button.label}: ${p.button.url}`] : []),
    "—",
    `${rawAddress}\n${rawPhone} · ${rawEmail}`,
    "Questions? Reply to this email or call the front desk.",
    `${sentTo} Prices are in Philippine pesos and times are in Asia/Manila.`,
    `© Cozy Palace ${rawTagline}`,
  ].join("\n\n");
  return { html, text: textBody };
}
export type EmailButton = { label: string; url: string };
/** True when the hotel's Gmail account is set up for sending. */
export const emailConfigured = () =>
  Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
/**
 * Sends one plain email from the hotel's Gmail account, each line a paragraph.
 * Returns null when sent, otherwise the reason, so the caller can record it and retry.
 */
export async function sendEmail(p: {
  to: string;
  subject: string;
  /** Large title above the body; defaults to the subject. */
  heading?: string;
  /** Hidden line inbox apps show next to the subject. */
  preheader?: string;
  lines: string[];
  /** Navy call-to-action under the body, with the link spelled out below it. */
  button?: EmailButton;
  /** Ends "This email was sent to <address> …", e.g. "because you booked with Cozy Palace". */
  reason?: string;
  replyTo?: string;
  /** Stable per event, so a retried send reads as the same email. */
  id: string;
}): Promise<string | null> {
  const user = process.env.GMAIL_USER,
    // Google shows app passwords in groups of four with spaces.
    pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) return "Email is not configured";
  try {
    await createTransport({
      service: "gmail",
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    }).sendMail({
      from: { name: "Cozy Palace", address: user },
      to: p.to,
      replyTo: p.replyTo,
      subject: p.subject,
      ...(await branded({ ...p, heading: p.heading ?? p.subject })),
      messageId: `<${p.id}@cozypalace>`,
    });
    return null;
  } catch (error) {
    console.error("Email failed", error);
    return error instanceof Error ? error.message : "Email failed";
  }
}
