export const dynamic = "force-dynamic";
import Link from "next/link";
import { requireIdentity } from "@/lib/auth/authorize";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ProfileForm } from "@/components/profile-form";
export default async function Account() {
  const { db, userId, email } = await requireIdentity("/account");
  const { data, error } = await db
    .from("profiles")
    .select("full_name,phone")
    .eq("id", userId)
    .single();
  return (
    <section className="section">
      <WorkspaceNav />
      <div className="login">
        <h1>Your account</h1>
        <p className="intro">{email}</p>
        {error ? (
          <p role="alert" className="notice error">
            Profile services are unavailable. Check that the account migration
            has been applied.
          </p>
        ) : (
          <ProfileForm fullName={data.full_name} phone={data.phone} />
        )}
        <Link href="/account/password">Change password</Link>
      </div>
    </section>
  );
}
