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
        <details className="terms-panel">
          <summary>Terms and Conditions</summary>
          <p>Please review these terms before creating your account.</p>
          <h2>Reservations</h2>
          <p>Check your room or table, dates, guest count, and contact details before confirming. A confirmation screen shows the details of your reservation.</p>
          <h2>Payment</h2>
          <p>Your booking summary identifies whether payment is collected online or is due at the hotel. Keep your reservation ID and payment receipt for reference.</p>
          <h2>Changes and cancellations</h2>
          <p>Use your reservation details to review or cancel a booking. Contact Cozy Palace Hotel and Restaurant for applicable booking conditions and any refund questions.</p>
          <h2>Your information</h2>
          <p>Provide accurate contact details so the hotel can send booking updates. Use Contact for questions about your account or reservation.</p>
        </details>
      </div>
    </div>
  );
}
