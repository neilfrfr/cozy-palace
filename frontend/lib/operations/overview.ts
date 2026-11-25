import { addDays } from "@/lib/reports";

/** Figures for the admin overview. All dates are Manila hotel dates (YYYY-MM-DD). */

type Stay = {
  room_id: string;
  check_in: string;
  check_out: string;
  status: string;
};
type Closure = { room_id: string | null; starts_on: string; ends_on: string };

export type RoomsTonight = {
  occupied: number;
  reserved: number;
  available: number;
  closed: number;
};

/** Each room counted once for tonight: a guest in it beats a booking, a booking beats a closure. */
export function roomsTonight(
  today: string,
  rooms: { id: string; operational_state: string }[],
  stays: Stay[],
  closures: Closure[],
): RoomsTonight {
  const counts = { occupied: 0, reserved: 0, available: 0, closed: 0 };
  for (const room of rooms) {
    const tonight = stays.filter(
      (s) =>
        s.room_id === room.id && s.check_in <= today && s.check_out > today,
    );
    const shut =
      room.operational_state !== "available" ||
      closures.some(
        (c) =>
          c.room_id === room.id && c.starts_on <= today && c.ends_on > today,
      );
    if (tonight.some((s) => s.status === "checked_in")) counts.occupied++;
    else if (
      tonight.some((s) => s.status === "pending" || s.status === "confirmed")
    )
      counts.reserved++;
    else if (shut) counts.closed++;
    else counts.available++;
  }
  return counts;
}

/** Today's room arrivals and departures, and how many have already happened. */
export function movesToday(today: string, stays: Stay[]) {
  const arriving = stays.filter(
    (s) =>
      s.check_in === today &&
      ["pending", "confirmed", "checked_in"].includes(s.status),
  );
  const leaving = stays.filter(
    (s) =>
      s.check_out === today && ["checked_in", "completed"].includes(s.status),
  );
  return {
    checkIns: arriving.length,
    arrived: arriving.filter((s) => s.status === "checked_in").length,
    checkOuts: leaving.length,
    left: leaving.filter((s) => s.status === "completed").length,
  };
}

const manilaDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

export type DayBookings = { date: string; rooms: number; tables: number };

/** New bookings per day for the `days` days ending today, by the day they were made. */
export function bookingsByDay(
  today: string,
  days: number,
  rows: { kind: string; created_at: string }[],
): DayBookings[] {
  const out = Array.from({ length: days }, (_, i) => ({
    date: addDays(today, i - days + 1),
    rooms: 0,
    tables: 0,
  }));
  const at = new Map(out.map((d) => [d.date, d]));
  for (const r of rows) {
    const day = at.get(manilaDate(r.created_at));
    if (!day) continue;
    if (r.kind === "hotel") day.rooms++;
    else if (r.kind === "dining") day.tables++;
  }
  return out;
}

export type MonthTotal = { month: string; amount: number };

/**
 * Money collected per month for the `months` months ending this one (the Reports page's "Collected"),
 * plus this month so far against the same days of last month.
 */
export function collectedByMonth(
  today: string,
  months: number,
  rows: { paid_at: string; amount: number }[],
) {
  const first = (d: string) => d.slice(0, 8) + "01";
  const keys: string[] = [];
  for (let m = first(today), i = 0; i < months; i++) {
    keys.unshift(m.slice(0, 7));
    m = first(addDays(m, -1));
  }
  const totals: MonthTotal[] = keys.map((month) => ({ month, amount: 0 }));
  const lastMonth = keys.at(-2);
  const day = today.slice(8);
  let soFar = 0;
  let lastSoFar = 0;
  for (const r of rows) {
    const date = manilaDate(r.paid_at);
    const row = totals.find((t) => t.month === date.slice(0, 7));
    if (row) row.amount += r.amount;
    if (date.slice(0, 7) === keys.at(-1)) soFar += r.amount;
    if (date.slice(0, 7) === lastMonth && date.slice(8) <= day)
      lastSoFar += r.amount;
  }
  return {
    months: totals,
    soFar,
    // null when last month had nothing by this day, so there's no fair comparison.
    change: lastSoFar ? (soFar - lastSoFar) / lastSoFar : null,
  };
}
