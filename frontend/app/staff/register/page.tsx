import Link from "next/link";
import { AccountAuthForm } from "@/components/account-auth-form";
import { SetupNotice } from "@/components/setup-notice";
import { isConfigured } from "@/lib/supabase/config";

const next = "/staff";
const signInUrl = "/login?next=" + encodeURIComponent(next);

export const metadata = { title: "Staff Registration | Cozy Palace" };

export default function StaffRegister() {
  const configured = isConfigured();
  return (
    <div className="login">
      <p className="eyebrow">Join the Cozy Palace team</p>
      <h1>Create your staff account</h1>
      <p className="intro">
        Use the exact email approved by your administrator. Create your account,
        confirm your email, then <Link href={signInUrl}>sign in with your approved email</Link> to open the staff workspace.
      </p>
      <p className="notice">
        Ask your administrator to add you to the staff directory first.
        Registration alone does not grant staff access. Only a matching,
        verified email can activate an approved staff record.
      </p>
      {!configured && <SetupNotice />}
      <AccountAuthForm mode="register" configured={configured} next={next} />
      <p>
        Already have an account? <Link href={signInUrl}>Sign In</Link> with your
        approved email; you do not need to register again.
      </p>
      <p>
        <Link href="/forgot-password?mode=resend">
          Resend a confirmation link
        </Link>
      </p>
      <p className="subtle">
        Booking a stay? <Link href="/register">Customer Registration</Link>
      </p>
    </div>
  );
}
