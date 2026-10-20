import Link from "next/link";
import { readRole, roleHome } from "@/lib/auth/authorize";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
export async function SiteNav() {
  let signedIn = false;
  let home = "/reservations";
  let employee = false;
  if (isConfigured()) {
    try {
      const db = await createClient();
      const { data, error } = await db.auth.getUser();
      signedIn = !error && !!data.user;
      if (data.user) {
        const role = await readRole(db, data.user.id);
        home = roleHome(role);
        employee = role !== "customer";
      }
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
          <Link href={home}>
            {employee ? "Work dashboard" : "My Reservations"}
          </Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <Link
          className="button nav-account"
          href={signedIn ? (employee ? home : "/account") : "/login"}
        >
          {signedIn ? (employee ? "Workspace" : "My account") : "Sign in"}
        </Link>
      </nav>
    </header>
  );
}
