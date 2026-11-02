import { bookedAt, formatLabel } from "@/lib/format";
import { peso } from "@/lib/orders";
import { pick, readFilters, type ReportQuery } from "@/lib/report-filters";
import { totals } from "@/lib/reports";
import { getReport } from "@/lib/reports-data";
export const dynamic = "force-dynamic";

export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<ReportQuery>;
}) {
  const f = readFilters(await searchParams);
  const report = await getReport(f.from, f.to);
  const rows = pick(report.transactions, f);
  const sum = totals(rows);
  const employees = [
    ...new Set(report.transactions.map((t) => t.recordedBy)),
  ].sort();
  const csv = (section: string) =>
    "/admin/reports/export?" +
    new URLSearchParams({ section, ...f }).toString();
  const o = report.occupancy;
  return (
    <>
      <p className="eyebrow">MANAGEMENT</p>
      <h1>Reports</h1>
      <p className="intro">
        Occupancy, dining and recorded payments for the dates you choose, in
        hotel time. Collections are money recorded, not recognized revenue.
      </p>
      <form className="operations-filters">
        <label>
          From
          <input name="from" type="date" required defaultValue={f.from} />
        </label>
        <label>
          To
          <input name="to" type="date" required defaultValue={f.to} />
        </label>
        <label>
          Payment status
          <select name="status" defaultValue={f.status}>
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="review">Needs review</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label>
          Recorded by
          <select name="employee" defaultValue={f.employee}>
            <option value="">Anyone</option>
            {employees.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <button className="button">Show</button>
      </form>

      <h2>Hotel occupancy</h2>
      <dl className="report-figures">
        <div>
          <dt>Occupancy</dt>
          <dd>{(o.rate * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Occupied room-nights</dt>
          <dd>{o.occupied}</dd>
        </div>
        <div>
          <dt>Sellable room-nights</dt>
          <dd>{o.sellable}</dd>
        </div>
        <div>
          <dt>Reserved, not yet checked in</dt>
          <dd>{o.reserved}</dd>
        </div>
      </dl>
      <p className="subtle">
        Occupied counts checked-in and completed stays. Sellable leaves out
        rooms out of service and closed dates.{" "}
        <a href={csv("occupancy")}>Download CSV</a>
      </p>

      <h2>Dining reservations</h2>
      {Object.keys(report.dining).length ? (
        <dl className="report-figures">
          {Object.entries(report.dining).map(([status, n]) => (
            <div key={status}>
              <dt>{formatLabel(status)}</dt>
              <dd>{n}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="empty">No dining reservations in these dates.</p>
      )}
      <p className="subtle">
        <a href={csv("dining")}>Download CSV</a>
      </p>

      <h2>Payments</h2>
      <dl className="report-figures">
        <div>
          <dt>Collected</dt>
          <dd>{peso(sum.collected)}</dd>
        </div>
        <div>
          <dt>Needs review</dt>
          <dd>{peso(sum.review)}</dd>
        </div>
        <div>
          <dt>Refunded</dt>
          <dd>{peso(sum.refunded)}</dd>
        </div>
      </dl>
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">Payments</caption>
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={i}>
                <td>{bookedAt(t.date)}</td>
                <td>{t.kind}</td>
                <td>{t.reference}</td>
                <td>{peso(t.amount)}</td>
                <td>{t.method}</td>
                <td>{formatLabel(t.status)}</td>
                <td>{t.recordedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty">No payments match.</p>}
      </div>
      <p className="subtle">
        <a href={csv("transactions")}>Download CSV</a>
      </p>
    </>
  );
}
