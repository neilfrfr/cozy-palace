"use client";

import { startTransition, useActionState, useState } from "react";
import { Turnstile } from "@/components/turnstile";
import { sendInquiryAction } from "./actions";

const fieldClassName =
  "!mt-2 !min-h-12 !w-full !rounded-md !border-[var(--line)] !bg-[var(--paper)] !px-4 !py-3 !font-[inherit] !text-base !text-[var(--ink)]";

export function InquiryForm() {
  const [state, submit, pending] = useActionState(sendInquiryAction, {
    message: "",
    success: false,
  });
  // Each Turnstile token works once, so remount the widget on every submit.
  const [captcha, setCaptcha] = useState("");
  const [round, setRound] = useState(0);
  const needsCaptcha = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <section
      className="form-panel !bg-[var(--paper)] !p-8 shadow-sm lg:!p-10"
      aria-labelledby="inquiry-title"
    >
      <h2 id="inquiry-title">Send an Inquiry</h2>
      <p className="intro">
        Send us a message and our front desk will reply by email.
      </p>

      {state.success ? (
        <p className="notice" role="status">
          {state.message}
        </p>
      ) : (
        <form
          className="form-grid"
          // Submitted by hand so a failed send keeps what the guest typed (form actions reset fields).
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(() => submit(data));
            setCaptcha("");
            setRound((n) => n + 1);
          }}
        >
          <input type="hidden" name="captchaToken" value={captcha} />
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
              className={`${fieldClassName} !border !min-h-32 !resize-y !leading-relaxed`}
              name="message"
              rows={5}
              required
            />
          </label>
          {needsCaptcha && (
            <div className="full">
              <Turnstile key={round} action="inquiry" onToken={setCaptcha} />
            </div>
          )}
          {state.message && (
            <p role="alert" className="notice error full">
              {state.message}
            </p>
          )}
          <button
            className="primary full"
            type="submit"
            disabled={pending || (needsCaptcha && !captcha)}
          >
            {pending ? "Sending…" : "Send Message"}
          </button>
        </form>
      )}
    </section>
  );
}
