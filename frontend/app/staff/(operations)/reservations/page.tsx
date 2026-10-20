import Link from "next/link";
import { getOperationalReservations } from "@/lib/operations/service";
import {
  parseOperationsFilter,
  operationalStatuses,
} from "@/lib/operations/schema";
import { OperationalReservationList } from "@/components/operational-reservation-list";
import { formatLabel } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function OperationsQueue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = parseOperationsFilter(await searchParams);
  const result = await getOperationalReservations(filter);
  const pageUrl = (page: number) => {
    const p = new URLSearchParams({ page: String(page), q: filter.q });
    if (filter.date) p.set("date", filter.date);
    if (filter.status) p.set("status", filter.status);
    if (filter.source) p.set("source", filter.source);
    if (filter.staying) p.set("staying", "1");
    return "/staff/reservations?" + p;
  };
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>Reservations</h1>
          <p>
            Guest bookings and customer requests. Private customer drafts stay
            in customer self-service.
          </p>
        </div>
        <Link className="button gold" href="/staff/reservations/new">
          New Guest Booking
        </Link>
      </header>
      <form className="operations-filters" action="/staff/reservations">
        <label>
          Reference or guest
          <input name="q" defaultValue={filter.q} maxLength={100} />
        </label>
        <label>
          Arrival date
          <input name="date" type="date" defaultValue={filter.date} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filter.status ?? ""}>
            <option value="">All statuses</option>
            {operationalStatuses.map((s) => (
              <option key={s} value={s}>
                {formatLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Booking source
          <select name="source" defaultValue={filter.source ?? ""}>
            <option value="">All sources</option>
            <option value="customer_online">Customer online</option>
            <option value="staff_guest">Staff-entered guest</option>
          </select>
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            name="staying"
            value="1"
            defaultChecked={filter.staying}
          />
          Include stays covering this date
        </label>
        <div className="actions">
          <button className="primary">Apply filters</button>
          <Link href="/staff/reservations" className="text-link">
            Clear
          </Link>
        </div>
      </form>
      <div className="queue-caption">
        <p>
          {result.count} matching reservations · Page {filter.page} of{" "}
          {Math.max(1, Math.ceil(result.count / 20))}
        </p>
      </div>
      <OperationalReservationList rows={result.rows} />
      <nav className="actions" aria-label="Reservation pages">
        {filter.page > 1 && (
          <Link href={pageUrl(filter.page - 1)}>Previous</Link>
        )}
        {filter.page * 20 < result.count && (
          <Link href={pageUrl(filter.page + 1)}>Next</Link>
        )}
      </nav>
    </>
  );
}
