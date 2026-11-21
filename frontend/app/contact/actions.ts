"use server";
import { z } from "zod";
import { sendEmail, emailConfigured } from "@/lib/email";

const maxWords = 500;
const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().max(254),
  topic: z.enum(["General Question", "Room Reservation", "Dining & Events", "Feedback"]),
  message: z.string().trim().min(1).max(10000).refine((value) => (value.match(/\S+/g)?.length ?? 0) <= maxWords, "WORD_LIMIT"),
  website: z.string().max(0).optional(),
});

export async function sendInquiryAction(form: FormData): Promise<{ ok: boolean; code: string }> {
  const parsed = inquirySchema.safeParse({
    name: form.get("name"), email: form.get("email"), topic: form.get("topic"),
    message: form.get("message"), website: form.get("website") ?? "",
  });
  if (!parsed.success) return { ok: false, code: parsed.error.issues.some((issue) => issue.message === "WORD_LIMIT") ? "WORD_LIMIT" : "INVALID_INPUT" };
  if (!emailConfigured()) return { ok: false, code: "EMAIL_UNAVAILABLE" };
  const { name, email, topic, message } = parsed.data;
  const error = await sendEmail({
    to: "cozypalace.bookings@gmail.com",
    subject: `Website inquiry: ${topic}`,
    lines: [`From: ${name}`, `Reply email: ${email}`, `Topic: ${topic}`, "", message],
    id: `inquiry-${crypto.randomUUID()}`,
  });
  return error ? { ok: false, code: "SEND_FAILED" } : { ok: true, code: "SENT" };
}
