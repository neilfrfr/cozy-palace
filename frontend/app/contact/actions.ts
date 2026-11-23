"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { captchaConfigured, verifyCaptcha } from "@/lib/captcha";
import { clientIp } from "@/lib/client-ip";
import { emailConfigured, sendEmail } from "@/lib/email";
import { getSiteContent, text } from "@/lib/site-content";

const topics = [
  "General Question",
  "Room Reservation",
  "Dining & Events",
  "Feedback",
] as const;
const inquirySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  topic: z.enum(topics),
  message: z.string().trim().min(1).max(5000),
});

export type InquiryState = { message: string; success: boolean };

/** Emails a contact-page inquiry to the hotel inbox, guarded by CAPTCHA. */
export async function sendInquiryAction(
  _prev: InquiryState,
  form: FormData,
): Promise<InquiryState> {
  if (!emailConfigured() || !captchaConfigured())
    return {
      success: false,
      message: "Inquiries are unavailable right now. Please email or call us.",
    };
  const parsed = inquirySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { success: false, message: "Please check the form and try again." };
  const token = String(form.get("captchaToken") ?? "");
  if (!(await verifyCaptcha(token, await clientIp(), "inquiry")))
    return {
      success: false,
      message: "Please complete the security check and try again.",
    };
  const p = parsed.data;
  const failed = await sendEmail({
    // The address shown on the Contact page (default cozypalace.bookings@gmail.com).
    to: text(await getSiteContent(), "contact.email"),
    replyTo: p.email,
    subject: `Inquiry: ${p.topic} — ${p.name}`,
    heading: `New inquiry: ${p.topic}`,
    button: {
      label: `Reply to ${p.name}`,
      url: `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(`Re: ${p.topic}`)}`,
    },
    reason: "because a guest sent an inquiry through the Contact page",
    lines: [`From: ${p.name} <${p.email}>`, `Topic: ${p.topic}`, p.message],
    id: randomUUID(),
  });
  if (failed)
    return {
      success: false,
      message:
        "We couldn't send your message. Please try again or email us directly.",
    };
  return {
    success: true,
    message: "Thank you for reaching out. We have received your inquiry.",
  };
}
