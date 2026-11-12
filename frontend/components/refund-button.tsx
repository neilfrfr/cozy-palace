"use client";
import { useFormStatus } from "react-dom";
/** Disabled while the refund is being sent, so a double click posts once. The database also allows one pending refund. */
export function RefundButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button" disabled={pending}>
      {pending ? "Sending to Xendit…" : "Refund via Xendit"}
    </button>
  );
}
