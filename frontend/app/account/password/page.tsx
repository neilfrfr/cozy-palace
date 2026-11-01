export const dynamic = "force-dynamic";
import { requireIdentity } from "@/lib/auth/authorize";
import { WorkspaceNav } from "@/components/workspace-nav";
import { AccountAuthForm } from "@/components/account-auth-form";
export default async function Password({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  await requireIdentity("/account/password");
  // Reset-link sessions don't need the current password; Supabase still checks either way.
  const reset = (await searchParams).reset === "1";
  return (
    <section className="section">
      <WorkspaceNav />
      <div className="login">
        <h1>Choose a new password</h1>
        <AccountAuthForm mode="password" configured={true} reset={reset} />
      </div>
    </section>
  );
}
