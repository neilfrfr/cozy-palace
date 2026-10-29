"use client";
import { useActionState } from "react";
import { startCheckoutAction } from "@/app/actions/payments";
import { errorMessages } from "@/lib/reservations/errors";
/** Pass the reservation id for a signed-in customer, or the booking-link token for a visitor. */
export function PayButton({ id, token }: { id?: string; token?: string }) {
  const [state, submit, pending] = useActionState(startCheckoutAction, null);
  return (
    <form action={submit}>
      {id && <input type="hidden" name="id" value={id} />}
      {token && <input type="hidden" name="token" value={token} />}
      <button className="primary gold" type="submit" disabled={pending}>
        {pending ? "Opening PayMongo…" : "Pay with PayMongo"}
      </button>
      {state && (
        <p className="notice error" role="alert">
          {errorMessages[state.code] ?? errorMessages.REQUEST_FAILED}
        </p>
      )}
    </form>
  );
}
