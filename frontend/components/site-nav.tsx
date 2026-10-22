import { SiteHeaderFrame } from "@/components/site-header-frame";
import { readNavState } from "@/lib/auth/nav-state";
export async function SiteNav() {
  const { signedIn, home, employee } = await readNavState();
  return (
    <SiteHeaderFrame
      links={[
        { href: "/", label: "Home" },
        { href: "/rooms", label: "Rooms" },
        { href: "/dining", label: "Dining" },
        ...(signedIn
          ? [
              {
                href: home,
                label: employee ? "Work dashboard" : "My Reservations",
              },
            ]
          : []),
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
