"use client";
import { useActionState } from "react";
import {
  startCheckoutAction,
  startGuestCheckoutAction,
} from "@/app/actions/payments";
import { errorMessages } from "@/lib/reservations/errors";
/** A customer pays by booking id; a visitor without an account by name and booking number. */
export function PayButton(
  props: { id: string } | { first: string; last: string; reference: string },
) {
  const [state, submit, pending] = useActionState(
    "id" in props ? startCheckoutAction : startGuestCheckoutAction,
    null,
  );
  return (
    <form action={submit}>
      {Object.entries(props).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button className="primary gold" type="submit" disabled={pending}>
        {pending ? "Opening Xendit…" : "Pay with Xendit"}
      </button>
      {state && (
        <p className="notice error" role="alert">
          {errorMessages[state.code] ?? errorMessages.REQUEST_FAILED}
        </p>
      )}
    </form>
  );
}
