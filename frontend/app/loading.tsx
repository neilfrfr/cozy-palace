/** Shown while a page's server data loads. Fades in only if loading takes a moment. */
export default function Loading() {
  return (
    <div className="page-loader" role="status">
      <span className="page-loader-mark" aria-hidden="true">
        Cozy Palace
      </span>
      <span className="page-loader-line" aria-hidden="true" />
      <span className="hidden-label">Loading Cozy Palace…</span>
    </div>
  );
}
