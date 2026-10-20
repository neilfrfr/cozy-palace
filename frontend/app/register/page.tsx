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
      <Link href="/forgot-password?mode=resend">
        Resend a confirmation link
      </Link>
      <p>
        Already registered? <Link href="/login">Sign In</Link>
      </p>
      <p className="subtle">
        Joining the team? Staff registration uses the email approved by your
        administrator. <Link href="/staff/register">Staff Registration</Link>
      </p>
    </div>
  );
}
