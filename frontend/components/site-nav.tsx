import { SiteHeaderFrame } from "@/components/site-header-frame";
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
    <SiteHeaderFrame
      links={[
        { href: "/", label: "Home" },
        { href: "/rooms", label: "Rooms" },
        { href: "/dining", label: "Dining" },
        {
          href: home,
          label: employee ? "Work dashboard" : "My Reservations",
        },
        { href: "/about", label: "About" },
        { href: "/contact", label: "Contact" },
      ]}
      account={{
        href: signedIn ? (employee ? home : "/account") : "/login",
        label: signedIn ? (employee ? "Workspace" : "My account") : "Sign in",
      }}
    />
  );
}
