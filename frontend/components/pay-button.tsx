"use client";
import { useActionState } from "react";
import { startCheckoutAction } from "@/app/actions/payments";
import { errorMessages } from "@/lib/reservations/errors";
export function PayButton({ id }: { id: string }) {
  const [state, submit, pending] = useActionState(startCheckoutAction, null);
  return (
    <form action={submit}>
      <input type="hidden" name="id" value={id} />
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
