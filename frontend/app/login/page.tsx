import { isConfigured } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/auth/redirect";
import { LoginForm } from "@/components/login-form";
import { SetupNotice } from "@/components/setup-notice";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const p = await searchParams;
  return (
    <div className="login">
      <h1>Welcome back</h1>
      <p className="intro">Sign in to manage your reservations.</p>
      {!isConfigured() && <SetupNotice />}
      {p.notice === "invalid-link" && (
        <div className="notice error" role="alert">
          This link is invalid or expired. Please sign in with your test
          account.
        </div>
      )}
      <LoginForm next={safeRedirect(p.next)} configured={isConfigured()} />
    </div>
  );
}
