import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import { readRole, roleHome } from "@/lib/auth/authorize";
import { getBookedNightsByRoom, getRooms } from "@/lib/reservations/service";
import { businessDate } from "@/lib/operations/schema";
import { ReservationForm } from "@/components/reservation-form";
import { WorkspaceNav } from "@/components/workspace-nav";
import { GuestOnlineRoomForm } from "@/components/guest-online-room-form";
import { SetupNotice } from "@/components/setup-notice";
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
  if (!isConfigured()) return <SetupNotice />;
  const db = await createClient();
  const { data } = await db.auth.getUser();
  let customer = false;
  if (data.user) {
    const role = await readRole(db, data.user.id);
    if (role !== "customer") redirect(roleHome(role));
    customer = true;
  }
  const rooms = await getRooms();
  const bookedNights = await getBookedNightsByRoom(rooms);
  if (!customer) return (
    <div className="public-page guest-booking-page">
      <h1>Plan your stay</h1>
      <p className="intro">Choose your room and dates, then send a request with your contact details. You can look up its status with your confirmation number.</p>
      <GuestOnlineRoomForm rooms={rooms} defaults={defaults} bookedNights={bookedNights} today={businessDate()} />
    </div>
  );
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
