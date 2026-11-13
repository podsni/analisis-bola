export function PageSkeleton({ lines = 6 }: { lines?: number }) {
  return (
    <div className="wrap skel-page" aria-busy="true" aria-live="polite">
      <div className="skel skel-kicker" />
      <div className="skel skel-title" />
      <div className="skel skel-line" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skel skel-block" />
      ))}
      <p className="meta">Memuat data liga…</p>
    </div>
  );
}

export function TickerSkeleton() {
  return (
    <div className="bb-ticker">
      <span className="bb-ticker-tag">TICKER</span>
      <span className="bb-ticker-empty">Memuat pita jadwal…</span>
    </div>
  );
}
