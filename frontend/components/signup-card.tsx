import Link from "next/link";
import { AccountAuthForm } from "@/components/account-auth-form";
import { SetupNotice } from "@/components/setup-notice";

/** Sign-up content shared by the /register page and the sign-up popup. */
export function SignupCard({
  next,
  configured,
}: {
  next: string;
  configured: boolean;
}) {
  return (
    <div className="signup-card">
      <span className="signup-mark" aria-hidden="true">
        CP
      </span>
      <h1 id="signup-title">Welcome to Cozy Palace</h1>
      <p className="intro">
        Create a free account to save your reservations and manage every stay.
      </p>
      {!configured && <SetupNotice />}
      <AccountAuthForm mode="register" configured={configured} next={next} />
      <p className="signup-switch">
        Already have an account?{" "}
        <Link href={"/login?next=" + encodeURIComponent(next)}>Log in</Link>
      </p>
      <p className="subtle signup-fine">
        By continuing, you agree to the{" "}
        <Link href="/terms">Terms and Conditions</Link> and the{" "}
        <Link href="/privacy">Privacy Notice</Link>.{" "}
        <Link href="/forgot-password?mode=resend">
          Resend a confirmation link
        </Link>
      </p>
    </div>
  );
}
