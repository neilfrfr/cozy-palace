import Link from "next/link";
import { redirect } from "next/navigation";
import { readNavState } from "@/lib/auth/nav-state";
import { FindReservationForm } from "@/components/find-reservation-form";
export const dynamic = "force-dynamic";
export default async function FindReservation() {
  const { signedIn, employee } = await readNavState();
  // Customers with an account already see every booking on My Reservations.
  if (signedIn && !employee) redirect("/reservations");
  return (
    <section className="section">
      <div className="login">
        <h1>Find a Reservation</h1>
        <p className="intro">
          Booked without an account? Enter your name as you gave it when booking
          and the reference from your confirmation email.
        </p>
        <FindReservationForm />
        <p className="subtle">
          Have an account? <Link href="/login?next=/reservations">Sign in</Link>{" "}
          to see and manage all your bookings.
        </p>
      </div>
    </section>
  );
}
