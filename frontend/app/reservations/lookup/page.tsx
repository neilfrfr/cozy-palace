import Link from "next/link";
import { GuestBookingLookup } from "@/components/guest-booking-lookup";

export const metadata = { title: "Find a booking" };

export default function GuestReservationLookup() {
  return <div className="public-page guest-booking-page">
    <p className="eyebrow">Your stay, in one place</p>
    <h1>Find a booking</h1>
    <p className="intro">Look up a room or table request made without an account.</p>
    <GuestBookingLookup />
    <p className="subtle">Have an account? <Link className="text-link" href="/login?next=/reservations">Sign in to view all reservations.</Link></p>
  </div>;
}
