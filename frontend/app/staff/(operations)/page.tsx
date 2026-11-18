import Link from "next/link";
import { getStaffDashboard } from "@/lib/operations/service";
import { getMyShift } from "@/lib/reservations/service";
import { ShiftFigures } from "@/components/shift-figures";
import { KeyRack, deskDate } from "@/components/key-rack";
export const dynamic = "force-dynamic";
export default async function StaffDashboard() {
  const [data, shift] = await Promise.all([getStaffDashboard(), getMyShift()]);
  return (
    <>
      <header className="operations-heading">
        <div>
          <h1>{deskDate(data.date)}</h1>
          <p>What&apos;s waiting at the front desk today.</p>
        </div>
        <Link className="button gold" href="/staff/reservations/new">
          New guest booking
        </Link>
      </header>
      <KeyRack label="Work waiting today" items={data.metrics} />
      <section className="operations-section">
        <div className="section-head">
          <h2>My shift today</h2>
          <Link className="text-link" href="/staff/activity">
            See my activity
          </Link>
        </div>
        <ShiftFigures shift={shift} />
      </section>
    </>
  );
}
