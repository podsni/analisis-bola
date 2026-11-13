import type { GoalPoint, PointsPoint } from "@/lib/types";

export function GoalsTrendChart({ points }: { points: GoalPoint[] }) {
  if (points.length < 2) return <p className="empty">Belum cukup laga untuk grafik gol.</p>;
  const w = 640;
  const h = 180;
  const pad = { l: 28, r: 8, t: 16, b: 28 };
  const max = Math.max(3, ...points.flatMap((p) => [p.gf, p.ga]));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const path = (key: "gf" | "ga") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="Tren gol dan kebobolan">
        {[0, 1, 2, 3].map((n) => {
          const v = (max / 3) * n;
          return (
            <g key={n}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} className="chart-grid" />
              <text x={pad.l - 6} y={y(v) + 3} className="chart-axis" textAnchor="end">
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        <path d={path("gf")} className="chart-line gf" />
        <path d={path("ga")} className="chart-line ga" />
        {points.map((p, i) => (
          <g key={p.dateWib + i}>
            <circle cx={x(i)} cy={y(p.gf)} r="3" className="chart-dot gf">
              <title>{p.dateWib} vs {p.opponent}: membuat {p.gf}, kebobolan {p.ga}</title>
            </circle>
            <circle cx={x(i)} cy={y(p.ga)} r="3" className="chart-dot ga">
              <title>{p.dateWib} vs {p.opponent}: kebobolan {p.ga}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        <span className="lg gf">Gol dibuat</span>
        <span className="lg ga">Kebobolan</span>
      </div>
    </div>
  );
}

export function PointsChart({ points }: { points: PointsPoint[] }) {
  if (points.length < 2) return <p className="empty">Belum cukup laga untuk grafik poin.</p>;
  const w = 640;
  const h = 180;
  const pad = { l: 32, r: 8, t: 16, b: 28 };
  const max = Math.max(3, ...points.map((p) => p.points));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.points).toFixed(1)}`).join(" ");
  const area = `${d} L ${x(points.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="Akumulasi poin">
        <path d={area} className="chart-area" />
        <path d={d} className="chart-line pts" />
        {points.map((p, i) => (
          <circle key={p.dateWib + i} cx={x(i)} cy={y(p.points)} r="3" className="chart-dot pts">
            <title>
              {p.dateWib}: {p.points} poin setelah lawan {p.label}
            </title>
          </circle>
        ))}
        <text x={pad.l - 6} y={y(max) + 3} className="chart-axis" textAnchor="end">
          {max}
        </text>
        <text x={pad.l - 6} y={y(0) + 3} className="chart-axis" textAnchor="end">
          0
        </text>
      </svg>
    </div>
  );
}
