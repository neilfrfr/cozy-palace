import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isConfigured } from "@/lib/supabase/config";
import { LoginBackdrop } from "@/components/login-backdrop";
import { LoginRoomSlideshow } from "@/components/login-room-slideshow";
import { LoginForm } from "@/components/login-form";
import { SetupNotice } from "@/components/setup-notice";
/** The split login card shared by the guest (/login) and staff (/staff/login) pages. */
export function LoginScreen({
  eyebrow,
  intro,
  notice,
  next,
  portal,
}: {
  eyebrow: string;
  intro: string;
  notice?: string;
  next: string;
  portal: "guest" | "staff";
}) {
  return (
    <div className="auth-layout">
      <LoginBackdrop />
      <div className="auth-card">
        <div className="login auth-content">
          <div className="auth-top">
            <Link className="brand" href="/">
              Cozy Palace<span>HOTEL AND RESTAURANT</span>
            </Link>
            <Link className="auth-home" href="/">
              <ArrowLeft size={18} aria-hidden="true" />
              Back to home
            </Link>
          </div>
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1>Welcome back</h1>
          <p className="intro">{intro}</p>
          {!isConfigured() && <SetupNotice />}
          {notice && (
            <div className="notice error" role="alert">
              {notice}
            </div>
          )}
          <LoginForm next={next} configured={isConfigured()} portal={portal} />
        </div>
        <aside className="auth-photo">
          <LoginRoomSlideshow />
          <nav className="auth-photo-nav" aria-label="Explore">
            <Link href="/">Home</Link>
            <Link href="/rooms">Rooms</Link>
            <Link href="/dining">Dining</Link>
            <Link href="/about">About</Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}
