"use client";

import { useState, type FormEvent } from "react";

const fieldClassName =
  "!mt-2 !min-h-12 !w-full !rounded-md !border-[var(--line)] !bg-[var(--paper)] !px-4 !py-3 !font-[inherit] !text-base !text-[var(--ink)]";

export function InquiryForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section
      className="form-panel !bg-[var(--paper)] !p-8 shadow-sm lg:!p-10"
      aria-labelledby="inquiry-title"
    >
      <h2 id="inquiry-title">Send an Inquiry</h2>
      <p className="intro">
        Prototype inquiry form — messages are simulated for demonstration.
      </p>

      {submitted ? (
        <p className="notice" role="status">
          Thank you for reaching out. We have received your inquiry.
        </p>
      ) : (
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="full">
            Full Name
            <input
              className={fieldClassName}
              name="name"
              type="text"
              autoComplete="name"
              required
            />
          </label>
          <label className="full">
            Email Address
            <input
              className={fieldClassName}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="full">
            Inquiry Topic
            <select
              className={fieldClassName}
              name="topic"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Select a topic...
              </option>
              <option>General Question</option>
              <option>Room Reservation</option>
              <option>Dining &amp; Events</option>
              <option>Feedback</option>
            </select>
          </label>
          <label className="full">
            Message
            <textarea
              className={`${fieldClassName} !min-h-32 !resize-y !leading-relaxed`}
              name="message"
              rows={5}
              required
            />
          </label>
          <button className="primary full" type="submit">
            Send Message
          </button>
        </form>
      )}
    </section>
  );
}
