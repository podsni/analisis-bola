import type { TeamMatchStats } from "@/lib/types";

const ROWS: { key: keyof TeamMatchStats; label: string; kind?: "pct" | "xg" }[] = [
  { key: "expectedGoals", label: "xG", kind: "xg" },
  { key: "shots", label: "Tembakan" },
  { key: "shotsOnTarget", label: "Tepat sasaran" },
  { key: "possession", label: "Penguasaan bola", kind: "pct" },
  { key: "passes", label: "Umpan" },
  { key: "passPct", label: "Akurasi umpan", kind: "pct" },
  { key: "corners", label: "Tendangan sudut" },
  { key: "fouls", label: "Pelanggaran" },
  { key: "yellow", label: "Kartu kuning" },
  { key: "red", label: "Kartu merah" },
  { key: "saves", label: "Penyelamatan" },
  { key: "offsides", label: "Offside" },
];

function fmt(v: number | null | undefined, kind?: "pct" | "xg"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (kind === "xg") return v.toFixed(2).replace(".", ",");
  if (kind === "pct") return `${Math.round(v)}%`;
  return String(v);
}

export function StatCompare({
  home,
  away,
}: {
  home: TeamMatchStats;
  away: TeamMatchStats;
}) {
  const visible = ROWS.filter((r) => home[r.key] != null || away[r.key] != null);
  if (!visible.length) return <p className="empty">Statistik pertandingan belum tersedia di ringkasan ESPN.</p>;
  return (
    <div className="stat-compare">
      {visible.map((r) => {
        const hv = typeof home[r.key] === "number" ? (home[r.key] as number) : 0;
        const av = typeof away[r.key] === "number" ? (away[r.key] as number) : 0;
        const sum = hv + av || 1;
        return (
          <div className="stat-cmp-row" key={r.key}>
            <span className="num">{fmt(home[r.key] as number | null, r.kind)}</span>
            <div className="stat-cmp-mid">
              <div className="stat-cmp-label">{r.label}</div>
              <div className="stat-cmp-bars">
                <i className="home" style={{ width: `${(hv / sum) * 50}%` }} />
                <i className="away" style={{ width: `${(av / sum) * 50}%` }} />
              </div>
            </div>
            <span className="num">{fmt(away[r.key] as number | null, r.kind)}</span>
          </div>
        );
      })}
    </div>
  );
}
