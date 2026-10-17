export const dynamic = "force-dynamic";
import { requireIdentity } from "@/lib/auth/authorize";
import { WorkspaceNav } from "@/components/workspace-nav";
import { AccountAuthForm } from "@/components/account-auth-form";
export default async function Password() {
  await requireIdentity("/account/password");
  return (
    <section className="section">
      <WorkspaceNav />
      <div className="login">
        <h1>Choose a new password</h1>
        <AccountAuthForm mode="password" configured={true} />
      </div>
    </section>
  );
}
