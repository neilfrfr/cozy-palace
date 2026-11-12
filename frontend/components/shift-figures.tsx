import { bookedAt } from "@/lib/format";
import type { shiftOf } from "@/lib/activity";
/** Time in and action counts for today's shift (FR11). */
export function ShiftFigures({ shift }: { shift: ReturnType<typeof shiftOf> }) {
  return (
    <dl className="report-figures">
      <div>
        <dt>Time in</dt>
        <dd>
          {shift.signedInAt ? bookedAt(shift.signedInAt) : "No sign-in today"}
        </dd>
      </div>
      <div>
        <dt>Actions</dt>
        <dd>{shift.actions.length}</dd>
      </div>
      {shift.counts.map(([label, n]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{n}</dd>
        </div>
      ))}
    </dl>
  );
}
