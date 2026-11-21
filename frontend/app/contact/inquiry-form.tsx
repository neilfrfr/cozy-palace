"use client";
import { useState, useTransition, type FormEvent } from "react";
import { sendInquiryAction } from "./actions";
const fieldClassName = "inquiry-field";
const maxWords = 500;
const feedback: Record<string, string> = {
  INVALID_INPUT: "Check your name, email, topic, and message fields.",
  WORD_LIMIT: `Please keep your message to ${maxWords} words or fewer.`,
  EMAIL_UNAVAILABLE: "Email is not configured yet. Please contact us by phone.",
  SEND_FAILED: "We could not send your inquiry. Please try again shortly.",
};
export function InquiryForm() {
  const [status, setStatus] = useState("");
  const [messageText, setMessageText] = useState("");
  const [pending, startTransition] = useTransition();
  const wordCount = messageText.trim().match(/\S+/g)?.length ?? 0;
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (wordCount > maxWords) { setStatus(feedback.WORD_LIMIT); return; }
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await sendInquiryAction(data);
      setStatus(result.ok ? "Thank you for reaching out. We have received your inquiry." : (feedback[result.code] ?? feedback.SEND_FAILED));
      if (result.ok) { form.reset(); setMessageText(""); }
    });
  }
  return <section className="form-panel inquiry-panel" aria-labelledby="inquiry-title">
    <h2 id="inquiry-title">Send an Inquiry</h2>
    <p className="intro">Send a message to our concierge team. We’ll reply to the email address you provide.</p>
    {status && <p className={`notice${status.startsWith("Thank") ? "" : " error"}`} role={status.startsWith("Thank") ? "status" : "alert"}>{status}</p>}
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="full">Full Name<input className={fieldClassName} name="name" type="text" autoComplete="name" maxLength={100} required /></label>
      <label className="full">Email Address<input className={fieldClassName} name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label className="full">Inquiry Topic<select className={fieldClassName} name="topic" defaultValue="" required><option value="" disabled>Select a topic...</option><option>General Question</option><option>Room Reservation</option><option>Dining &amp; Events</option><option>Feedback</option></select></label>
      <label className="full">Message<textarea className={`${fieldClassName} inquiry-message`} name="message" rows={5} maxLength={10000} required value={messageText} onChange={(event) => { setMessageText(event.target.value); setStatus(""); }} aria-describedby="inquiry-word-count" aria-invalid={wordCount > maxWords || undefined} /></label>
      <p className={`inquiry-word-count${wordCount > maxWords ? " over-limit" : ""}`} id="inquiry-word-count" aria-live="polite">{wordCount} / {maxWords} words{wordCount > maxWords ? ` — Please remove ${wordCount - maxWords} word${wordCount - maxWords === 1 ? "" : "s"}.` : ""}</p>
      <label className="inquiry-trap" aria-hidden="true">Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button className="primary full" type="submit" disabled={pending}>{pending ? "Sending…" : "Send Message"}</button>
    </form>
  </section>;
}
