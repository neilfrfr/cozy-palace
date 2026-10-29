/** Turns stored values such as "checked_in" into display labels such as "Checked in". */
export function formatLabel(value: string): string {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
export function sourceLabel(source?: string): string {
  return source === "staff_guest"
    ? "Staff-entered guest"
    : source === "guest_online"
      ? "Online guest (no account)"
      : "Customer online";
}
