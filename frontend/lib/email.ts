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
  lines: string[];
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
      subject: p.subject,
      text: p.lines.join("\n\n"),
      html: p.lines.map((l) => `<p>${escape(l)}</p>`).join(""),
      messageId: `<${p.id}@cozypalace>`,
    });
    return null;
  } catch (error) {
    console.error("Email failed", error);
    return error instanceof Error ? error.message : "Email failed";
  }
}
