/** Placeholder layout for the rooms page while availability loads. */
export default function RoomsLoading() {
  return (
    <div className="rooms-skeleton" role="status">
      <span className="hidden-label">Loading rooms…</span>
      <div className="skeleton skeleton-banner" />
      <div className="skeleton skeleton-bar" />
      <div className="grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skeleton skeleton-card" key={i} />
        ))}
      </div>
    </div>
  );
}
