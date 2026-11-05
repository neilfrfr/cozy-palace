import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isConfigured } from "@/lib/supabase/config";
import { safeRedirect } from "@/lib/auth/redirect";
import { LoginBackdrop } from "@/components/login-backdrop";
import { LoginForm } from "@/components/login-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const p = await searchParams;
  return (
    <div className="auth-layout">
      <LoginBackdrop />
      <div className="auth-card">
        <div className="login auth-content">
          <div className="auth-top">
            <Link className="brand" href="/">
              Cozy Palace<span>Hotel and Restaurant</span>
            </Link>
            <Link className="auth-home" href="/">
              <ArrowLeft size={18} aria-hidden="true" />
              Back to home
            </Link>
          </div>
          <p className="auth-eyebrow">Guest login</p>
          <h1>Welcome back</h1>
          <p className="intro">
            Sign in to view your stays, table bookings and receipts.
          </p>
          {!isConfigured() && <SetupNotice />}
          {p.notice === "invalid-link" && (
            <div className="notice error" role="alert">
              This link is invalid or expired. Request a fresh confirmation or
              recovery link.
            </div>
          )}
          <LoginForm
            next={p.next ? safeRedirect(p.next) : ""}
            configured={isConfigured()}
          />
        </div>
        <aside className="auth-photo">
          <Image
            src="/design/rooms/garden-deluxe.jpg"
            alt=""
            fill
            sizes="(max-width: 900px) 0px, 50vw"
            priority
          />
          <nav className="auth-photo-nav" aria-label="Explore">
            <Link href="/">Home</Link>
            <Link href="/rooms">Rooms</Link>
            <Link href="/dining">Dining</Link>
            <Link href="/about">About</Link>
          </nav>
          <div className="auth-photo-caption">
            <p>Beautiful stays. Memorable tables.</p>
            <p>Garden Deluxe room</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
