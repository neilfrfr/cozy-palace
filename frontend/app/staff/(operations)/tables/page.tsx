import { z } from "zod";
import { getDiningTables } from "@/lib/inventory/service";
import { getTableBookings } from "@/lib/reservations/dining";
import { businessDate } from "@/lib/operations/schema";
import { addDays } from "@/lib/reservations/availability";
import { DatePicker } from "@/components/date-picker";
import { TableBookingList } from "@/components/table-booking-list";
import { TablePicker } from "@/components/table-picker";
export const dynamic = "force-dynamic";
export default async function TableService({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = businessDate();
  const picked = z.iso.date().safeParse((await searchParams).date);
  const date = picked.success ? picked.data : undefined;
  const [rows, tables] = await Promise.all([
    date ? getTableBookings(date, addDays(date, 1)) : getTableBookings(today),
    getDiningTables(),
  ]);
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>Table Service</h1>
          <p>
            Confirm guest requests, seat parties and free tables as service
            runs. Seating and completing are available on the booking&apos;s own
            day.
          </p>
        </div>
      </header>
      <form className="operations-filters" action="/staff/tables">
        <DatePicker name="date" label="Seating date" defaultValue={date ?? today} />
        <button className="button">Show</button>
        {date && (
          <a className="text-link" href="/staff/tables">
            Show all upcoming
          </a>
        )}
      </form>
      <h2>{date ? "Bookings for " + date : "Upcoming bookings"}</h2>
      <TableBookingList rows={rows} staff />
      <h2>Book a Walk-in</h2>
      <TablePicker tables={tables} today={today} walkIn />
    </>
  );
}
