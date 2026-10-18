import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
export async function SiteNav() {
  let signedIn = false;
  if (isConfigured()) {
    try {
      const db = await createClient();
      const { data, error } = await db.auth.getUser();
      signedIn = !error && !!data.user;
    } catch {
      /* Public navigation remains usable during an Auth outage. */
    }
  }
  return (
    <header className="site-header">
      <nav className="nav" aria-label="Main navigation">
        <Link className="brand" href="/">
          Cozy Palace<span>Hotel and Restaurant</span>
        </Link>
        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/rooms">Rooms</Link>
          <Link href="/dining">Dining</Link>
          <Link href="/reservations">My reservations</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <Link
          className="button nav-account"
          href={signedIn ? "/account" : "/login"}
        >
          {signedIn ? "My account" : "Sign in"}
        </Link>
      </nav>
    </header>
  );
}
