import { randomUUID } from "node:crypto";
import { getRooms } from "@/lib/reservations/service";
import { businessDate } from "@/lib/operations/schema";
import { GuestReservationForm } from "@/components/guest-reservation-form";
export const dynamic = "force-dynamic";
export default async function NewGuestBooking() {
  const rooms = await getRooms();
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>New guest booking</h1>
          <p>
            Create a hotel reservation on behalf of a guest. Same-day arrivals
            are welcome.
          </p>
        </div>
      </header>
      {rooms.length ? (
        <GuestReservationForm
          rooms={rooms}
          requestKey={randomUUID()}
          today={businessDate()}
        />
      ) : (
        <p className="notice">
          No available room inventory. Ask an administrator to review the room
          records.
        </p>
      )}
    </>
  );
}
