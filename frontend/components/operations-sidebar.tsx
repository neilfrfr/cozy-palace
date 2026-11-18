"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/login/actions";

export type NavGroup = { name: string; links: (readonly [string, string])[] };

/** The longest link that is the current path or a parent of it, so detail pages keep their section lit. */
function currentHref(path: string, groups: NavGroup[]) {
  return groups
    .flatMap((g) => g.links.map(([href]) => href))
    .filter((href) => path === href || path.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];
}

/** Sidebar shared by the staff and admin workspaces, grouped like a front desk key cabinet. */
export function OperationsSidebar({
  subtitle,
  home,
  groups,
  footer = [],
}: {
  subtitle: string;
  home: string;
  groups: NavGroup[];
  footer?: (readonly [string, string])[];
}) {
  const path = usePathname();
  const current = currentHref(path, groups);
  const [open, setOpen] = useState(false);
  return (
    <aside className={"admin-sidebar desk-sidebar" + (open ? " is-open" : "")}>
      <div className="desk-sidebar-top">
        <Link className="brand" href={home}>
          Cozy Palace<span>{subtitle}</span>
        </Link>
        <button
          type="button"
          className="desk-menu-button"
          aria-expanded={open}
          aria-controls="desk-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <div className="desk-nav" id="desk-nav">
        <nav aria-label="Workspace">
          {groups.map((group) => (
            <div className="desk-group" key={group.name}>
              <p className="desk-group-name">{group.name}</p>
              {group.links.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={href === current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="desk-footer">
          {footer.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button className="plain sidebar-signout">Sign out</button>
          </form>
        </div>
      </div>
    </aside>
  );
}
