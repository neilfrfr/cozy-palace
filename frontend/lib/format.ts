/** Turns stored values such as "checked_in" into display labels such as "Checked in". */
export function formatLabel(value: string): string {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
const manila = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});
/** When a booking was made, in hotel time: "Oct 29, 2026, 9:27 PM". */
export const bookedAt = (iso: string) => manila.format(new Date(iso));
export function sourceLabel(source?: string): string {
  return source === "staff_guest"
    ? "Staff-entered guest"
    : source === "guest_online"
      ? "Online guest (no account)"
      : "Customer online";
}
/**
 * Booking and order references as typed: room bookings are R-42, table bookings T-42, orders plain numbers.
 * "r 0042" and "#R42" read as "R-42", "#0042" as "42"; older CP-/OR- codes pass through.
 */
export function normalizeReference(input: string): string {
  const ref = input.trim().toUpperCase();
  const m = /^#?([RT])?[\s-]*#?0*(\d+)$/.exec(ref);
  return m ? (m[1] ? m[1] + "-" : "") + m[2] : ref;
}
