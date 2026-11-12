import Link from "next/link";
import { getActivity } from "@/lib/reservations/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { formatLabel } from "@/lib/format";
import { activityTypes, parseActivityFilter } from "@/lib/activity";
export const dynamic = "force-dynamic";
export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = parseActivityFilter(await searchParams);
  const { page } = f;
  const { rows, employees } = await getActivity(f);
  const pageHref = (n: number) =>
    "?" +
    new URLSearchParams({
      ...(f.employee && { employee: f.employee }),
      ...(f.type && { type: f.type }),
      page: String(n),
    });
  return (
    <>
      <WorkspaceNav />
      <h1>Activity Log</h1>
      <p className="intro">
        Review reservation, account, and staffing changes. Customer and system
        activity are listed separately from employee actions.
      </p>
      <form className="operations-filters">
        <label>
          Employee
          <select name="employee" defaultValue={f.employee ?? ""}>
            <option value="">Anyone</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Action type
          <select name="type" defaultValue={f.type ?? ""}>
            <option value="">All actions</option>
            {Object.entries(activityTypes).map(([k, t]) => (
              <option key={k} value={k}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button">Show</button>
      </form>
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">
            Employee and system activity
          </caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Account</th>
              <th scope="col">Role</th>
              <th scope="col">Action</th>
              <th scope="col">Record</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Manila",
                  }).format(new Date(r.occurred_at))}
                </td>
                <td>
                  {r.actor_name}
                  <br />
                  <small>{r.actor_id || "System"}</small>
                </td>
                <td>{formatLabel(r.actor_role)}</td>
                <td>{formatLabel(r.action)}</td>
                <td>{r.record_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="empty">No activity on this page.</p>
        )}
      </div>
      <div className="actions">
        {page > 1 && (
          <Link className="button secondary" href={pageHref(page - 1)}>
            Previous
          </Link>
        )}
        {rows.length === 25 && (
          <Link className="button secondary" href={pageHref(page + 1)}>
            Next
          </Link>
        )}
      </div>
    </>
  );
}
