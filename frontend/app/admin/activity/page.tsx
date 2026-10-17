import Link from "next/link";
import { getActivity } from "@/lib/reservations/service";
import { WorkspaceNav } from "@/components/workspace-nav";
export const dynamic = "force-dynamic";
export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(p.page) || 1));
  const rows = await getActivity(page);
  return (
    <>
      <WorkspaceNav />
      <h1>Activity log</h1>
      <p className="intro">
        A record of reservation, account, and staffing changes. Customer and
        system activity are identified separately from employee actions.
      </p>
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
                <td>{r.actor_role}</td>
                <td>{r.action}</td>
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
          <Link className="button secondary" href={"?page=" + (page - 1)}>
            Previous
          </Link>
        )}
        {rows.length === 25 && (
          <Link className="button secondary" href={"?page=" + (page + 1)}>
            Next
          </Link>
        )}
      </div>
    </>
  );
}
