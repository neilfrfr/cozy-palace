import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireCustomer } from "@/lib/auth/authorize";
import { getBookedNightsByRoom, getRooms } from "@/lib/reservations/service";
import { businessDate } from "@/lib/operations/schema";
import { addDays } from "@/lib/reservations/availability";
import { ReservationForm } from "@/components/reservation-form";
import { WorkspaceNav } from "@/components/workspace-nav";
import { GuestReservationForm } from "@/components/guest-reservation-form";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { visitorBookingEnabled } from "@/lib/captcha";
export const dynamic = "force-dynamic";
export default async function NewReservation({
  searchParams,
}: {
  searchParams: Promise<{
    room?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  }>;
}) {
  const defaults = await searchParams;
  const safe = Object.fromEntries(
    Object.entries(defaults).filter(
      (v): v is [string, string] => typeof v[1] === "string",
    ),
  );
  const next = "/reservations/new?" + new URLSearchParams(safe);
  // Signed-out visitors book without an account; everyone else goes through the account flow.
  const signedIn =
    isConfigured() && !!(await (await createClient()).auth.getUser()).data.user;
  if (!signedIn && visitorBookingEnabled()) {
    const rooms = await getRooms();
    return (
      <>
        <h1>Book your stay</h1>
        <p className="intro">
          No account needed.{" "}
          <Link href={"/login?next=" + encodeURIComponent(next)}>Sign in</Link>{" "}
          instead to keep your bookings in one place.
        </p>
        <GuestReservationForm
          visitor
          rooms={rooms}
          defaults={safe}
          requestKey={randomUUID()}
          bookedNights={await getBookedNightsByRoom(rooms)}
          // Visitors, like customers, book from tomorrow onward.
          today={addDays(businessDate(), 1)}
        />
      </>
    );
  }
  await requireCustomer(next);
  const rooms = await getRooms();
  const bookedNights = await getBookedNightsByRoom(rooms);
  return (
    <>
      <WorkspaceNav />
      <h1>Plan your stay</h1>
      <p className="intro">
        Save a draft, review your details, then send your booking request.
      </p>
      <ReservationForm
        rooms={rooms}
        defaults={defaults}
        requestKey={randomUUID()}
        bookedNights={bookedNights}
        today={businessDate()}
      />
    </>
  );
}
