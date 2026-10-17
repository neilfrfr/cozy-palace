import Link from "next/link";
import { AccountAuthForm } from "@/components/account-auth-form";
import { isConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/setup-notice";
export default async function Recover({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const resend = (await searchParams).mode === "resend";
  return (
    <div className="login">
      <h1>{resend ? "Confirm your email" : "Reset your password"}</h1>
      <p className="intro">
        {resend
          ? "Request a new account confirmation link."
          : "We’ll send a secure recovery link to your email."}
      </p>
      {!isConfigured() && <SetupNotice />}
      <AccountAuthForm
        mode={resend ? "resend" : "recover"}
        configured={isConfigured()}
      />
      <Link href="/login">Back to sign in</Link>
    </div>
  );
}
