import Image from "next/image";
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
    <div className="auth-layout">
      <aside className="auth-photo">
        <Image src="/design/hotel-hero.jpg" alt="" fill sizes="50vw" />
        <div>
          <h2>
            Cozy Palace
            <br />
            Hotel &amp;
            <br />
            Restaurant
          </h2>
          <p>
            Beautiful stays. Memorable tables.
            <br />
            Your next escape starts here.
          </p>
        </div>
      </aside>
      <div className="login auth-content">
        <h1>Welcome back</h1>
        <p className="intro">Sign in to manage your reservations.</p>
        {!isConfigured() && <SetupNotice />}
        {p.notice === "invalid-link" && (
          <div className="notice error" role="alert">
            This link is invalid or expired. Request a fresh confirmation or
            recovery link.
          </div>
        )}
        <LoginForm next={safeRedirect(p.next)} configured={isConfigured()} />
      </div>
    </div>
  );
}
