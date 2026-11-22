import { bookedAt, formatLabel } from "@/lib/format";
import { peso } from "@/lib/orders";
import { pick, readFilters, type ReportQuery } from "@/lib/report-filters";
import { previousPeriod, totals, vatSplit } from "@/lib/reports";
import { getReport } from "@/lib/reports-data";
import { PrintButton } from "@/components/print-button";
import { ReportBars } from "@/components/report-bars";
export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<ReportQuery>;
}) {
  const f = readFilters(await searchParams);
  const prev = previousPeriod(f.from, f.to);
  const [report, before] = await Promise.all([
    getReport(f.from, f.to),
    getReport(prev.from, prev.to),
  ]);
  // Period-wide figures, compared with the same number of days just before.
  const headline = (r: typeof report) => ({
    occupancy: r.occupancy.rate * 100,
    earned: r.days.reduce((n, d) => n + d.earned, 0),
    collected: totals(r.transactions).collected,
    net: r.revenue.total.net,
  });
  const now = headline(report);
  const was = headline(before);
  const change = (a: number, b: number) =>
    b
      ? `${a >= b ? "up" : "down"} ${Math.abs(((a - b) / b) * 100).toFixed(1)}%`
      : "no figures before";
  const vat = vatSplit(now.earned);
  const shortDate = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
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
    <div className="report-page">
      <p className="eyebrow">MANAGEMENT</p>
      <h1>Reports</h1>
      <p className="intro">
        Occupancy, dining and recorded payments for the dates you choose, in
        hotel time. Collections are money recorded, not recognized revenue.
      </p>
      <div className="report-actions">
        <strong>
          {shortDate(f.from)} to {shortDate(f.to)}, {f.from.slice(0, 4)}
        </strong>
        <PrintButton />
      </div>
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

      <h2>Summary</h2>
      <dl className="report-figures">
        {(
          [
            [
              "Occupancy",
              now.occupancy,
              was.occupancy,
              (n: number) => n.toFixed(1) + "%",
            ],
            ["Earned from stays", now.earned, was.earned, peso],
            ["Collected", now.collected, was.collected, peso],
            ["Net revenue", now.net, was.net, peso],
          ] as const
        ).map(([label, a, b, fmt]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{fmt(a)}</dd>
            <dd className="change">
              {change(a, b)} on {shortDate(prev.from)} to {shortDate(prev.to)} (
              {fmt(b)})
            </dd>
          </div>
        ))}
      </dl>
      <p className="subtle">
        Compared with the {report.days.length} days just before. The payment
        filters don&apos;t apply to the summary.
      </p>

      <h2>Day by day</h2>
      <div className="report-charts">
        <ReportBars
          title="Occupancy by night"
          data={report.days.map((d) => ({
            label: shortDate(d.date),
            value: d.occupancy * 100,
          }))}
          format={(n) => n.toFixed(1) + "%"}
        />
        <ReportBars
          title="Earned from stays by night"
          data={report.days.map((d) => ({
            label: shortDate(d.date),
            value: d.earned,
          }))}
          format={peso}
        />
        <ReportBars
          title="Collected by day"
          data={report.days.map((d) => ({
            label: shortDate(d.date),
            value: d.collected,
          }))}
          format={peso}
        />
      </div>
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">Day by day</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Rooms occupied</th>
              <th>Occupancy</th>
              <th>Earned from stays</th>
              <th>Collected</th>
            </tr>
          </thead>
          <tbody>
            {report.days.map((d) => (
              <tr key={d.date}>
                <td>{shortDate(d.date)}</td>
                <td>{d.occupied}</td>
                <td>{(d.occupancy * 100).toFixed(1)}%</td>
                <td>{peso(d.earned)}</td>
                <td>{peso(d.collected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="subtle">
        <a className="csv-link" href={csv("daily")}>
          Download CSV
        </a>
      </p>

      <h2>Accounting</h2>
      <dl className="report-figures">
        <div>
          <dt>Earned from stays (accrual)</dt>
          <dd>{peso(vat.gross)}</dd>
        </div>
        <div>
          <dt>VAT included (12%)</dt>
          <dd>{peso(vat.vat)}</dd>
        </div>
        <div>
          <dt>Earned, net of VAT</dt>
          <dd>{peso(vat.net)}</dd>
        </div>
        <div>
          <dt>Collected minus earned</dt>
          <dd>{peso(now.collected - now.earned)}</dd>
        </div>
      </dl>
      <p className="subtle">
        Earned counts each confirmed, checked-in or completed booking evenly
        across its nights, extras included, whenever it was paid. Collected is
        money received in these dates, so a positive difference is mostly
        deposits for later stays. Rates are assumed to include 12% VAT.
      </p>

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
        <a className="csv-link" href={csv("occupancy")}>
          Download CSV
        </a>
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
        <a className="csv-link" href={csv("dining")}>
          Download CSV
        </a>
      </p>

      <h2>Revenue by room type</h2>
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">Revenue by room type</caption>
          <thead>
            <tr>
              <th>Room type</th>
              <th>Room</th>
              <th>Extras</th>
              <th>Room charges</th>
              <th>Refunds</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {[...report.revenue.rows, report.revenue.total].map((r) => (
              <tr key={r.roomType}>
                <td>{r.roomType}</td>
                <td>{peso(r.room)}</td>
                <td>{peso(r.extras)}</td>
                <td>{peso(r.charges)}</td>
                <td>{peso(r.refunds)}</td>
                <td>{peso(r.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="subtle">
        Money counts on the day it moved: online payments when paid, room
        charges when the room bill is settled, refunds when completed. Each
        payment is split into its booking&apos;s extras and the room. The
        payment filters above don&apos;t apply here.{" "}
        <a className="csv-link" href={csv("revenue")}>
          Download CSV
        </a>
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
      <div className="table-wrap report-transactions">
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
        <a className="csv-link" href={csv("transactions")}>
          Download CSV
        </a>
      </p>
    </div>
  );
}
