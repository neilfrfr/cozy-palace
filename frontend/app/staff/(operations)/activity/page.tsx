import { getMyShift } from "@/lib/reservations/service";
import { bookedAt, formatLabel } from "@/lib/format";
import { ShiftFigures } from "@/components/shift-figures";
import { businessDate } from "@/lib/operations/schema";
export const dynamic = "force-dynamic";
export default async function MyActivity() {
  const shift = await getMyShift();
  return (
    <>
      <p className="eyebrow">STAFF WORKSPACE</p>
      <h1>My Activity</h1>
      <p className="intro">
        Today&apos;s shift · {businessDate()} · Asia/Manila. A shift runs from
        your first sign-in of the day until midnight.
      </p>
      <ShiftFigures shift={shift} />
      <div className="table-wrap">
        <table>
          <caption className="hidden-label">Your actions this shift</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Action</th>
              <th scope="col">Record</th>
            </tr>
          </thead>
          <tbody>
            {shift.actions.map((r) => (
              <tr key={r.id}>
                <td>{bookedAt(r.occurred_at)}</td>
                <td>{formatLabel(r.action)}</td>
                <td>{r.record_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shift.actions.length === 0 && (
          <p className="empty">No actions recorded this shift yet.</p>
        )}
      </div>
    </>
  );
}
