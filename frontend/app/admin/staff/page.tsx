export const dynamic = "force-dynamic";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/authorize";
import { WorkspaceNav } from "@/components/workspace-nav";
import { StaffEditor, type StaffMember } from "@/components/staff-manager";
export default async function StaffDirectory({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { db } = await requireStaff(true);
  const p = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(p.page) || 1));
  const { data, error, count } = await db
    .from("staff_members")
    .select("id,employee_code,email,full_name,job_title,state,version", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  return (
    <section className="section">
      <WorkspaceNav />
      <div className="section-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Staff Directory</h1>
          <p className="subtle staff-directory-description">
            Create onboarding records, update employee details, and revoke staff access.
          </p>
        </div>
      </div>
      <div className="notice">
        Share the <Link href="/staff/register">Staff Registration Portal</Link>
        {" "}with employees. They register with the approved email, confirm it,
        then sign in. No email invitation is sent by this screen. Removing a
        record revokes staff access; customer reservations and audit history
        remain.
      </div>
      {error ? (
        <p className="notice error" role="alert">
          Staff services are unavailable. Apply the account and staff onboarding
          migration first.
        </p>
      ) : (
        <>
          <h2>Add an employee</h2>
          <StaffEditor />
          <h2>Team members ({count || 0})</h2>
          {!data?.length && (
            <p className="notice">
              No staff onboarding records yet. Add your first employee above.
            </p>
          )}
          {data?.map((member) => (
            <article key={member.id}>
              <StaffEditor member={member as StaffMember} />
            </article>
          ))}
          <nav className="actions" aria-label="Staff directory pages">
            {page > 1 && (
              <a href={"/admin/staff?page=" + (page - 1)}>Previous</a>
            )}
            {page * 20 < (count || 0) && (
              <a href={"/admin/staff?page=" + (page + 1)}>Next</a>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
