import Link from "next/link";

/**
 * Front desk pigeonholes: each queue hangs a brass key tag with its count.
 * An empty queue shows an empty hook, so "nothing waiting" reads at a glance.
 */
export function KeyRack({
  label,
  items,
}: {
  label: string;
  items: { name: string; count: number; href: string }[];
}) {
  return (
    <nav className="key-rack" aria-label={label}>
      {items.map((item) => (
        <Link
          className={"pigeonhole" + (item.count ? "" : " is-empty")}
          href={item.href}
          key={item.name}
        >
          <span className="key-hook" aria-hidden="true" />
          <strong className="key-tag">{item.count}</strong>
          <span className="pigeonhole-name">{item.name}</span>
        </Link>
      ))}
    </nav>
  );
}

/** "Wednesday, 18 November" for a YYYY-MM-DD business date. */
export function deskDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
}
