"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitReservationAction,
  deleteDraftAction,
  transitionReservationAction,
} from "@/app/actions/reservations";
import { errorMessages } from "@/lib/reservations/errors";
import type { Reservation } from "@/lib/reservations/types";
export function ReservationControls({
  reservation: r,
  staff = false,
  businessDay,
}: {
  reservation: Reservation;
  staff?: boolean;
  businessDay?: string;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState("");
  const router = useRouter();
  function act(kind: string) {
    if (
      kind === "delete" &&
      !confirm("Delete this unpaid draft? This cannot be undone.")
    )
      return;
    setError("");
    start(async () => {
      const input = { id: r.id, version: r.version };
      const result =
        kind === "delete"
          ? await deleteDraftAction(input)
          : kind === "submit"
            ? await submitReservationAction(input)
            : await transitionReservationAction({ ...input, status: kind });
      if (!result.ok) {
        setError(errorMessages[result.code] || "Please try again.");
        return;
      }
      if (kind === "delete") router.push("/reservations");
      router.refresh();
    });
  }
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        {!staff && r.status === "draft" && (
          <>
            <button
              type="button"
              className="primary"
              onClick={() => act("submit")}
              disabled={pending}
            >
              Submit booking request
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => act("delete")}
              disabled={pending}
            >
              Delete draft
            </button>
          </>
        )}
        {staff && r.status === "pending" && (
          <button
            className="primary"
            disabled={pending}
            onClick={() => act("confirmed")}
          >
            Confirm booking
          </button>
        )}
        {staff &&
          r.status === "confirmed" &&
          (!businessDay ||
            (r.room_bookings[0]?.check_in <= businessDay &&
              r.room_bookings[0]?.check_out > businessDay)) && (
            <button
              className="primary"
              disabled={pending}
              onClick={() => act("checked_in")}
            >
              Check in
            </button>
          )}
        {staff && r.status === "checked_in" && (
          <button
            className="primary"
            disabled={pending}
            onClick={() => act("completed")}
          >
            Complete stay
          </button>
        )}
        {staff && ["pending", "confirmed"].includes(r.status) && (
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => act("cancelled")}
          >
            Cancel booking
          </button>
        )}
        {pending && <span role="status">Saving changes…</span>}
      </div>
    </>
  );
}
