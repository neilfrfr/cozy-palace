import { z } from "zod";
import { getDiningTables } from "@/lib/inventory/service";
import { getTableBookingsForDay } from "@/lib/reservations/dining";
import { businessDate } from "@/lib/operations/schema";
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
  const date = picked.success ? picked.data : today;
  const [rows, tables] = await Promise.all([
    getTableBookingsForDay(date),
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
        <DatePicker name="date" label="Seating date" defaultValue={date} />
        <button className="button">Show</button>
      </form>
      <TableBookingList rows={rows} staff />
      <h2>Book a Walk-in</h2>
      <TablePicker tables={tables} today={today} walkIn />
    </>
  );
}
