import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { guestLinkToken } from "@/lib/operations/schema";
import { paymongoKey } from "@/lib/payments/paymongo";
import { formatLabel } from "@/lib/format";
import { PayButton } from "@/components/pay-button";
import { CancelGuestBooking } from "@/components/cancel-guest-booking";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
};
type GuestBooking = {
  reference: string;
  status: string;
  guests: number;
  total: number;
  guest_full_name: string;
  hold_expires_at: string | null;
  room_bookings: {
    check_in: string;
    check_out: string;
    room_number: string;
    room_type: string;
  }[];
};
/** A visitor's booking, reached only through the private link shown after booking. */
export default async function Stay({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ paid?: string }>;
}) {
  const token = guestLinkToken.safeParse((await params).token);
  if (!token.success || !adminConfigured()) notFound();
  const { data, error } = await createAdminClient().rpc("guest_reservation", {
    p_token: token.data,
  });
  if (error?.message === "NOT_FOUND" || (!error && !data)) notFound();
  if (error) throw new Error("Booking could not be loaded.");
  const r = data as GuestBooking;
  const stay = r.room_bookings[0];
  const holding =
    r.status === "pending" && new Date(r.hold_expires_at ?? 0) > new Date();
  const returned = (await searchParams)?.paid === "1";
  return (
    <>
      <p className="eyebrow">YOUR BOOKING</p>
      <h1>Reservation {r.reference}</h1>
      <span className={"status " + r.status}>{formatLabel(r.status)}</span>
      <p className="notice" role="note">
        Bookmark this page: it is the only way to view, pay for or cancel this
        booking online. Keep the link private; anyone who has it can do the
        same. You can also quote your reference to the hotel staff.
      </p>
      <dl className="details">
        <div>
          <dt>Guest</dt>
          <dd>{r.guest_full_name}</dd>
        </div>
        <div>
          <dt>Room</dt>
          <dd>{stay ? `${stay.room_type} · Room ${stay.room_number}` : "—"}</dd>
        </div>
        <div>
          <dt>Stay</dt>
          <dd>
            {stay?.check_in} to {stay?.check_out} · {r.guests} guests
          </dd>
        </div>
        <div>
          <dt>Total in PHP</dt>
          <dd>₱{Number(r.total).toLocaleString("en-PH")}</dd>
        </div>
      </dl>
      {returned && (
        <p className="notice" role="status">
          Thank you. Your booking is confirmed as soon as PayMongo reports the
          payment, usually within a minute. Refresh to see the update.
        </p>
      )}
      {holding && !returned && (
        <p className="notice">
          The room is held until{" "}
          {new Date(r.hold_expires_at!).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short",
          })}
          .{" "}
          {paymongoKey()
            ? "Pay online to confirm it."
            : "Contact the hotel to arrange payment before then."}
        </p>
      )}
      <div className="actions">
        {holding && !returned && paymongoKey() && (
          <PayButton token={token.data} />
        )}
        {r.status === "pending" && <CancelGuestBooking token={token.data} />}
        <Link className="button secondary" href="/rooms">
          Browse rooms
        </Link>
      </div>
    </>
  );
}
