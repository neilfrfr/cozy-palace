import "server-only";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmail } from "@/lib/email";

export type NoticeEvent =
  | "received"
  | "confirmed"
  | "changed"
  | "cancelled"
  | "expired"
  | "reminder"
  | "refunded";
type Booking = {
  reference: string;
  kind: "hotel" | "dining";
  guests: number;
  guest_full_name: string | null;
  customer: { full_name: string } | null;
  room_bookings: { check_in: string; check_out: string }[] | null;
  table_bookings: { start_at: string }[] | null;
};
const bookingFields =
  "reference,kind,guests,guest_full_name,customer:profiles!reservations_customer_id_fkey(full_name),room_bookings(check_in,check_out),table_bookings(start_at)";

const manila = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
function describe(b: Booking) {
  const stay = b.room_bookings?.[0],
    table = b.table_bookings?.[0];
  const what = stay
    ? `a stay from ${stay.check_in} to ${stay.check_out}`
    : table
      ? `a table on ${manila(table.start_at)}`
      : "your booking";
  return `Booking ${b.reference}: ${what}, ${b.guests} guest${b.guests === 1 ? "" : "s"}`;
}

/** One sentence per event, shared by the in-app list and the email. */
export function noticeText(event: NoticeEvent, b: Booking) {
  const room = b.kind === "hotel";
  const text: Record<NoticeEvent, [string, string]> = {
    received: [
      "We received your booking request",
      room
        ? "We hold the room until your check-in day. Our staff will contact you to confirm it and arrange payment."
        : "We hold the table until our staff confirm it. Seatings last two hours.",
    ],
    confirmed: [
      "Your booking is confirmed",
      "We look forward to welcoming you.",
    ],
    changed: [
      "Your booking was updated",
      "Check the details below. Contact the front desk if this is not what you expected.",
    ],
    cancelled: [
      "Your booking was cancelled",
      "If you did not ask for this, contact the front desk.",
    ],
    expired: [
      "Your booking request expired",
      "We could not confirm it in time. You are welcome to book again.",
    ],
    reminder: [
      room ? "Your stay starts tomorrow" : "Your table is tomorrow",
      "We look forward to welcoming you.",
    ],
    refunded: [
      "Your payment was refunded",
      "We sent it back to the GCash or Maya account you paid with. It can take a few days to appear.",
    ],
  };
  const [title, next] = text[event];
  return { title, next, booking: describe(b) };
}

export function emailFor(
  n: { id: string; event: NoticeEvent; email: string },
  b: Booking,
) {
  const t = noticeText(n.event, b);
  return {
    to: n.email,
    subject: `${t.title} · Booking ${b.reference}`,
    lines: [
      `Hello ${b.customer?.full_name ?? b.guest_full_name ?? "there"},`,
      `${t.title}. ${t.booking}.`,
      t.next,
      n.event === "refunded"
        ? `For questions, contact the front desk and quote booking number ${b.reference}.`
        : `To change or cancel it, contact the front desk and quote booking number ${b.reference}.`,
      "Cozy Palace Hotel and Restaurant",
    ],
    id: "notice-" + n.id,
  };
}

/** The signed-in customer's notices, newest first (RLS limits them to their own). */
export async function getMyNotifications() {
  const db = await createClient();
  const { data } = await db
    .from("notifications")
    .select(
      `id,event,created_at,read_at,reservation_id,reservations(${bookingFields})`,
    )
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((n) => {
    const row = n as unknown as {
      id: string;
      event: NoticeEvent;
      created_at: string;
      read_at: string | null;
      reservation_id: string;
      reservations: Booking;
    };
    return { ...row, ...noticeText(row.event, row.reservations) };
  });
}

/**
 * Sends due notification emails and records each attempt; failures are retried on a later run.
 * Runs after booking changes and from the daily cron. The booking itself never depends on this.
 */
export async function deliverNotifications(limit = 20) {
  if (!adminConfigured() || !emailConfigured()) return 0;
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_notifications", {
    p_limit: limit,
  });
  if (error) {
    console.error("Claiming notifications failed", error);
    return 0;
  }
  let sent = 0;
  for (const n of data as {
    id: string;
    event: NoticeEvent;
    email: string;
    reservation_id: string;
  }[]) {
    const { data: b } = await db
      .from("reservations")
      .select(bookingFields)
      .eq("id", n.reservation_id)
      .single();
    const booking = b as unknown as Booking | null;
    const failure = booking
      ? await sendEmail(emailFor(n, booking))
      : "Booking not found";
    await db.rpc("finish_notification", { p_id: n.id, p_error: failure });
    if (!failure) sent++;
  }
  return sent;
}
