import Link from "next/link";
import { AccountAuthForm } from "@/components/account-auth-form";
import { isConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/setup-notice";
import { safeRedirect } from "@/lib/auth/redirect";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const p = await searchParams;
  return (
    <div className="login">
      <p className="eyebrow">Your Cozy Palace account</p>
      <h1>Create your account</h1>
      <p className="intro">
        Save your reservations and return to manage every stay.
      </p>
      {!isConfigured() && <SetupNotice />}
      <AccountAuthForm
        mode="register"
        configured={isConfigured()}
        next={safeRedirect(p.next)}
      />
      <p>
        Already registered? <Link href="/login">Sign in</Link>
      </p>
      <p className="subtle">
        Joining the team? Register with the exact email approved by your
        administrator, verify your email, then sign in. Registration alone does
        not grant staff access.
      </p>
      <Link href="/forgot-password?mode=resend">
        Resend a confirmation link
      </Link>
    </div>
  );
}
