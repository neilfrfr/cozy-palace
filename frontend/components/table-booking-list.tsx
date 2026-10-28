"use client";
import { useState, useTransition } from "react";
import {
  cancelTableBookingAction,
  setTableBookingStatusAction,
} from "@/app/actions/dining";
import {
  diningError,
  seatingLabel,
  tableStatuses,
  type TableBooking,
} from "@/lib/dining";
import { formatLabel } from "@/lib/format";

function Controls({ row, staff }: { row: TableBooking; staff: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());
  const run = (action: () => ReturnType<typeof cancelTableBookingAction>) =>
    startTransition(async () => {
      setError("");
      const result = await action();
      if (!result.ok) setError(diningError(result.code));
    });
  const upcoming =
    ["pending", "confirmed"].includes(row.status) &&
    Date.parse(row.table_bookings.start_at) > now;
  return (
    <>
      {staff ? (
        <select
          aria-label={`Change status of ${row.reference}`}
          value=""
          disabled={pending}
          onChange={(e) => {
            const status = e.target.value as (typeof tableStatuses)[number];
            run(() =>
              setTableBookingStatusAction({
                id: row.id,
                version: row.version,
                status,
              }),
            );
          }}
        >
          <option value="">{pending ? "Saving…" : "Change status…"}</option>
          {tableStatuses
            .filter((s) => s !== row.status)
            .map((s) => (
              <option key={s} value={s}>
                {formatLabel(s)}
              </option>
            ))}
        </select>
      ) : (
        upcoming && (
          <button
            className="text-link"
            disabled={pending}
            onClick={() =>
              confirm("Cancel this table booking?") &&
              run(() =>
                cancelTableBookingAction({ id: row.id, version: row.version }),
              )
            }
          >
            {pending ? "Cancelling…" : "Cancel"}
          </button>
        )
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function TableBookingList({
  rows,
  staff = false,
}: {
  rows: TableBooking[];
  staff?: boolean;
}) {
  if (!rows.length)
    return (
      <p className="empty">
        {staff
          ? "No table bookings on this day."
          : "No table bookings yet. Book one from the Dining page."}
      </p>
    );
  return (
    <div className="table-wrap">
      <table>
        <caption className="hidden-label">Table bookings</caption>
        <thead>
          <tr>
            <th scope="col">Booking</th>
            <th scope="col">Seating</th>
            <th scope="col">Table</th>
            {staff && <th scope="col">Guest</th>}
            <th scope="col">Guests</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.reference}</td>
              <td>{seatingLabel(r.table_bookings)}</td>
              <td>{r.table_bookings.restaurant_tables.table_number}</td>
              {staff && (
                <td>
                  {r.guest_full_name ?? r.customer?.full_name ?? "Guest"}
                  {r.guest_phone && (
                    <>
                      <br />
                      {r.guest_phone}
                    </>
                  )}
                </td>
              )}
              <td>{r.guests}</td>
              <td>
                <span className={"status " + r.status}>
                  {formatLabel(r.status)}
                </span>
              </td>
              <td>
                <Controls row={r} staff={staff} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
