"use client";
import { useActionState } from "react";
import { cancelGuestBookingAction } from "@/app/actions/guest-bookings";
import { errorMessages } from "@/lib/reservations/errors";
export function CancelGuestBooking({ token }: { token: string }) {
  const [state, submit, pending] = useActionState(
    cancelGuestBookingAction,
    null,
  );
  return (
    <form
      action={submit}
      onSubmit={(event) => {
        if (!window.confirm("Cancel this booking and release the room?"))
          event.preventDefault();
      }}
    >
      <input type="hidden" name="token" value={token} />
      <button className="button secondary" type="submit" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel booking"}
      </button>
      {state && (
        <p className="notice error" role="alert">
          {errorMessages[state.code] ?? errorMessages.REQUEST_FAILED}
        </p>
      )}
    </form>
  );
}
