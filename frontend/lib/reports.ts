import { z } from "zod";

/** Report period: inclusive hotel-calendar dates, at most a year. Defaults to this month. */
export const periodSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((p) => p.to >= p.from && nights(p.from, p.to) <= 366);

const DAY = 864e5;
const ms = (d: string) => Date.parse(d + "T00:00:00Z");
export const addDays = (d: string, n: number) =>
  new Date(ms(d) + n * DAY).toISOString().slice(0, 10);
/** Nights in [a, b). */
export const nights = (a: string, b: string) =>
  Math.max(0, Math.round((ms(b) - ms(a)) / DAY));
/** Nights of [a, b) that fall inside [from, end). */
export const overlap = (a: string, b: string, from: string, end: string) =>
  nights(a > from ? a : from, b < end ? b : end);

export function thisMonth(today: string) {
  const from = today.slice(0, 8) + "01";
  return { from, to: addDays(addDays(from, 32).slice(0, 8) + "01", -1) };
}

type Stay = {
  room_id: string;
  check_in: string;
  check_out: string;
  status: string;
};
type Closed = { room_id: string | null; starts_on: string; ends_on: string };

/**
 * Occupancy = occupied room-nights / sellable room-nights (PRD section 11).
 * Sellable excludes out-of-service rooms and closed nights; occupied means checked in or completed;
 * reserved (pending or confirmed) is reported separately.
 */
export function occupancy(
  from: string,
  to: string,
  roomIds: string[],
  stays: Stay[],
  closures: Closed[],
) {
  const end = addDays(to, 1);
  const rooms = new Set(roomIds);
  let closed = 0;
  // Overlapping closures on one room count once per night.
  for (const id of rooms) {
    const shut = new Set<string>();
    for (const c of closures.filter((c) => c.room_id === id))
      for (
        let d = c.starts_on > from ? c.starts_on : from;
        d < c.ends_on && d < end;
        d = addDays(d, 1)
      )
        shut.add(d);
    closed += shut.size;
  }
  const sum = (statuses: string[]) =>
    stays
      .filter((s) => rooms.has(s.room_id) && statuses.includes(s.status))
      .reduce((n, s) => n + overlap(s.check_in, s.check_out, from, end), 0);
  const sellable = rooms.size * nights(from, end) - closed;
  const occupied = sum(["checked_in", "completed"]);
  const reserved = sum(["pending", "confirmed"]);
  return {
    sellable,
    occupied,
    reserved,
    rate: sellable ? occupied / sellable : 0,
  };
}

export type Transaction = {
  date: string;
  kind: "Booking payment" | "Order";
  reference: string;
  amount: number;
  method: string;
  status: string;
  recordedBy: string;
};

export function totals(rows: Transaction[]) {
  const sum = (status: string) =>
    rows.filter((r) => r.status === status).reduce((n, r) => n + r.amount, 0);
  return {
    collected: sum("paid"),
    review: sum("review"),
    refunded: sum("refunded"),
  };
}

export type RevenueRow = {
  roomType: string;
  room: number;
  extras: number;
  charges: number;
  refunds: number;
  net: number;
};
const cents = (n: number) => Math.round(n * 100) / 100;
/**
 * Revenue per room type. Each payment is split into its booking's extras (up to what was paid) and room;
 * refunds and room charges are summed as given. Every room type gets a row, even with nothing in it.
 */
export function revenueByRoomType(
  types: string[],
  payments: { type: string; paid: number; extras: number }[],
  refunds: { type: string; amount: number }[],
  charges: { type: string; amount: number }[],
) {
  const rows = new Map<string, Omit<RevenueRow, "net">>();
  const row = (roomType: string) => {
    if (!rows.has(roomType))
      rows.set(roomType, {
        roomType,
        room: 0,
        extras: 0,
        charges: 0,
        refunds: 0,
      });
    return rows.get(roomType)!;
  };
  types.forEach(row);
  for (const p of payments) {
    const extras = Math.min(p.paid, p.extras);
    row(p.type).extras += extras;
    row(p.type).room += p.paid - extras;
  }
  for (const r of refunds) row(r.type).refunds += r.amount;
  for (const c of charges) row(c.type).charges += c.amount;
  const total: RevenueRow = {
    roomType: "Total",
    room: 0,
    extras: 0,
    charges: 0,
    refunds: 0,
    net: 0,
  };
  const keys = ["room", "extras", "charges", "refunds", "net"] as const;
  const list = [...rows.values()].map((r) => {
    const out = { ...r, net: r.room + r.extras + r.charges - r.refunds };
    for (const k of keys) {
      out[k] = cents(out[k]);
      total[k] = cents(total[k] + out[k]);
    }
    return out;
  });
  return { rows: list, total };
}

/** RFC 4180 CSV; a leading = + - @ is quoted with ' so spreadsheets never run it as a formula. */
export function toCsv(header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
  };
  return (
    [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
  );
}
