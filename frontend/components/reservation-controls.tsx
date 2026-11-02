"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitReservationAction,
  deleteDraftAction,
  transitionReservationAction,
} from "@/app/actions/reservations";
import { errorMessages } from "@/lib/reservations/errors";
import { isPaid } from "@/lib/reservations/normalize";
import type { Reservation } from "@/lib/reservations/types";
import { useConfirm } from "@/components/confirm-dialog";
export function ReservationControls({
  reservation: r,
  staff = false,
  businessDay,
  children,
}: {
  reservation: Reservation;
  staff?: boolean;
  businessDay?: string;
  children?: React.ReactNode;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState("");
  const router = useRouter();
  const [ask, dialog] = useConfirm();
  async function act(kind: string) {
    if (
      kind === "delete" &&
      !(await ask({
        title: "Delete this draft?",
        message: "This unpaid draft will be removed. This cannot be undone.",
        confirmLabel: "Delete draft",
        cancelLabel: "Keep draft",
        danger: true,
      }))
    )
      return;
    if (
      kind === "cancelled" &&
      isPaid(r) &&
      !(await ask({
        title: "Cancel a paid booking?",
        message:
          "This booking has been paid. Cancelling it does not refund the guest: send the refund from the Xendit dashboard, then mark it refunded under Payments.",
        confirmLabel: "Cancel booking",
        cancelLabel: "Keep booking",
        danger: true,
      }))
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
      {dialog}
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
        {children}
        {pending && <span className="saving-status" role="status">Saving changes…</span>}
      </div>
    </>
  );
}
