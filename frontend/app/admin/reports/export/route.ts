import { pick, readFilters } from "@/lib/report-filters";
import { toCsv } from "@/lib/reports";
import { getReport } from "@/lib/reports-data";
export const dynamic = "force-dynamic";

/** CSV of one report section with the same filters as the page; admins only (getReport checks). */
export async function GET(request: Request) {
  const q = Object.fromEntries(new URL(request.url).searchParams);
  const f = readFilters(q);
  const report = await getReport(f.from, f.to);
  let body: string;
  if (q.section === "occupancy") {
    const o = report.occupancy;
    body = toCsv(
      [
        "from",
        "to",
        "sellable_room_nights",
        "occupied_room_nights",
        "reserved_room_nights",
        "occupancy_percent",
      ],
      [
        [
          f.from,
          f.to,
          o.sellable,
          o.occupied,
          o.reserved,
          (o.rate * 100).toFixed(1),
        ],
      ],
    );
  } else if (q.section === "dining") {
    body = toCsv(
      ["from", "to", "status", "reservations"],
      Object.entries(report.dining).map(([s, n]) => [f.from, f.to, s, n]),
    );
  } else if (q.section === "revenue") {
    const r = report.revenue;
    body = toCsv(
      [
        "from",
        "to",
        "room_type",
        "room_php",
        "extras_php",
        "room_charges_php",
        "refunds_php",
        "net_php",
      ],
      [...r.rows, r.total].map((x) => [
        f.from,
        f.to,
        x.roomType,
        x.room.toFixed(2),
        x.extras.toFixed(2),
        x.charges.toFixed(2),
        x.refunds.toFixed(2),
        x.net.toFixed(2),
      ]),
    );
  } else {
    body = toCsv(
      [
        "paid_at",
        "type",
        "reference",
        "amount_php",
        "method",
        "status",
        "recorded_by",
      ],
      pick(report.transactions, f).map((t) => [
        t.date,
        t.kind,
        t.reference,
        t.amount.toFixed(2),
        t.method,
        t.status,
        t.recordedBy,
      ]),
    );
  }
  const name = `cozy-palace-${["occupancy", "dining", "revenue"].includes(q.section) ? q.section : "payments"}-${f.from}-to-${f.to}.csv`;
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
