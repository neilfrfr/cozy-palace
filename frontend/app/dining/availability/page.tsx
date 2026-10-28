import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBanner } from "@/components/page-banner";
import { SetupNotice } from "@/components/setup-notice";
import { TablePicker } from "@/components/table-picker";
import { isConfigured } from "@/lib/supabase/config";
import { getDiningTables } from "@/lib/inventory/service";
import { BOOKING_WINDOW_DAYS, diningSlots, slotStart } from "@/lib/dining";
import { addDays } from "@/lib/reservations/availability";
import { businessDate } from "@/lib/operations/schema";
import { createClient } from "@/lib/supabase/server";
import { readRole } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

async function viewerRole() {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  return data.user ? readRole(db, data.user.id) : null;
}

export default async function DiningAvailability({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string; guests?: string }>;
}) {
  const params = await searchParams;
  const today = businessDate();
  const date = params.date ?? "";
  const time = params.time ?? "";
  const guests = Number(params.guests);
  const realDate = /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (
    !realDate ||
    date < today ||
    date > addDays(today, BOOKING_WINDOW_DAYS) ||
    !diningSlots.includes(time) ||
    Date.parse(slotStart(date, time)) <= Date.now() ||
    !Number.isInteger(guests) ||
    guests < 1 ||
    guests > 6
  ) {
    redirect("/dining");
  }

  const configured = isConfigured();
  const [tables, role] = configured
    ? await Promise.all([getDiningTables(), viewerRole()])
    : [[], null];

  return (
    <div className="public-page dining-availability-page">
      <PageBanner
        eyebrow="Dining"
        title="Choose Your Table."
        intro="Select a table for your chosen date, time and party size."
        image="/design/dining.jpg"
      />
      <section className="section" aria-labelledby="available-tables-title">
        <div className="dining-availability-heading">
          <div>
            <p className="eyebrow">Table reservations</p>
            <h2 id="available-tables-title">Available Tables</h2>
            <p className="intro">
              {guests} {guests === 1 ? "guest" : "guests"} · {date} at {time}
            </p>
          </div>
          <Link className="button secondary" href="/dining#table-reservations">
            Change search
          </Link>
        </div>
        {!configured && <SetupNotice />}
        <TablePicker
          tables={tables}
          today={today}
          initialDate={date}
          initialTime={time}
          initialGuests={guests}
          availabilityBar
          publicGuest={role === null}
          draftFlow={role === null || role === "customer"}
          instead={
            role !== null && role !== "customer" ? (
              <Link className="button" href="/staff/tables">
                Book walk-ins in Table Service
              </Link>
            ) : undefined
          }
        />
        {configured && !tables.length && (
          <p className="empty">No restaurant tables are listed yet.</p>
        )}
        <p className="subtle">
          Prototype seating records are fictional. Tables can be booked from
          11:00 to 14:00 and 17:00 to 21:00.
        </p>
      </section>
    </div>
  );
}
