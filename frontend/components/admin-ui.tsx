import Link from "next/link";

/** A top card whose "+ Add …" button opens the add form, kept apart from the list below. */
export function AddCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="add-card">
      <summary>
        <span className="button">+ {title}</span>
      </summary>
      <div className="add-card-body">{children}</div>
    </details>
  );
}

/** Category tabs with item counts; each tab is a link so the filter survives a reload. */
export function FilterTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: { label: string; count: number; href: string; active: boolean }[];
}) {
  return (
    <nav className="filter-tabs" aria-label={label}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
        >
          {t.label} <span>{t.count}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * A card per section: title, item count and one shared column header, so rows don't repeat their labels.
 * `cols` is the grid template the header and every row share.
 */
export function SectionCard({
  title,
  count,
  head,
  cols,
  children,
}: {
  title: string;
  count: number;
  head: string[];
  cols: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="section-card"
      style={{ "--cols": cols } as React.CSSProperties}
    >
      <h2>
        {title} <span className="count-chip">{count}</span>
      </h2>
      {count > 0 ? (
        <>
          <div className="edit-head" aria-hidden="true">
            {head.map((h, i) => (
              <span key={i}>{h}</span>
            ))}
          </div>
          {children}
        </>
      ) : (
        <p className="empty">Nothing here yet.</p>
      )}
    </section>
  );
}

/** A field label that the shared header replaces on wide screens; still read out, and shown on phones. */
export const colLabel = (text: string, compact?: boolean) =>
  compact ? <span className="col-label">{text}</span> : text;
