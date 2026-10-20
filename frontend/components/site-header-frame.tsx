"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavLink = { href: string; label: string };

/**
 * Client shell for the public header. On the home page the header sits on top
 * of the hero photo and only gains its solid navy background once the visitor
 * scrolls past the top of the page.
 */
export function SiteHeaderFrame({
  links,
  account,
}: {
  links: NavLink[];
  account: NavLink;
}) {
  const pathname = usePathname();
  const overlay = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [overlay]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className="site-header"
      data-overlay={overlay ? "true" : undefined}
      data-scrolled={overlay && scrolled ? "true" : undefined}
    >
      <nav className="nav" aria-label="Main navigation">
        <div className="nav-top">
          <Link className="brand" href="/">
            Cozy Palace<span>Hotel and Restaurant</span>
          </Link>
          <div className="nav-actions">
            <Link className="nav-account" href={account.href}>
              {account.label}
            </Link>
            <Link className="button gold nav-book" href="/rooms">
              Book a stay
            </Link>
          </div>
        </div>
        <div className="nav-links">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
