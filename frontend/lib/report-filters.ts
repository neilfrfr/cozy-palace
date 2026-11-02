import { periodSchema, thisMonth, type Transaction } from "@/lib/reports";

export type ReportQuery = {
  from?: string;
  to?: string;
  status?: string;
  employee?: string;
};

/** Reads the report filters from the URL; a bad period falls back to this month. */
export function readFilters(q: ReportQuery) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  const period = periodSchema.safeParse({ from: q.from, to: q.to });
  return {
    ...(period.success ? period.data : thisMonth(today)),
    status: ["paid", "review", "refunded"].includes(q.status ?? "")
      ? q.status!
      : "",
    employee: (q.employee ?? "").slice(0, 100),
  };
}

export const pick = (
  rows: Transaction[],
  f: { status: string; employee: string },
) =>
  rows.filter(
    (r) =>
      (!f.status || r.status === f.status) &&
      (!f.employee || r.recordedBy === f.employee),
  );
