"use client";

import { useState } from "react";
import type { PoissonEstimate } from "@/lib/types";
import { pct } from "@/lib/format";

export function ScoreHeatmap({ estimate, home, away }: { estimate: PoissonEstimate; home: string; away: string }) {
  const [tip, setTip] = useState<string | null>(null);
  if (!estimate.available || !estimate.scoreMatrix?.length) return null;
  const maxShown = 5;
  const cells = estimate.scoreMatrix.filter((c) => c.home <= maxShown && c.away <= maxShown);
  const peak = Math.max(...cells.map((c) => c.p), 0.0001);
  return (
    <div className="bb-heat-wrap">
      <div className="bb-heat-head">
        <span>Matriks skor paling mungkin (0–{maxShown})</span>
        <span className="meta">Tamu → / Tuan rumah ↓</span>
      </div>
      <div className="bb-heat" style={{ gridTemplateColumns: `auto repeat(${maxShown + 1}, 1fr)` }}>
        <div className="bb-heat-axis" />
        {Array.from({ length: maxShown + 1 }, (_, j) => (
          <div key={`c${j}`} className="bb-heat-axis">
            {j}
          </div>
        ))}
        {Array.from({ length: maxShown + 1 }, (_, i) => {
          const row = [
            <div key={`r${i}`} className="bb-heat-axis">
              {i}
            </div>,
          ];
          for (let j = 0; j <= maxShown; j++) {
            const cell = cells.find((c) => c.home === i && c.away === j);
            const p = cell?.p ?? 0;
            const t = p / peak;
            const top = estimate.topScores?.[0];
            const isTop = !!(top && top.home === i && top.away === j);
            row.push(
              <div
                key={`${i}-${j}`}
                className={`bb-heat-cell${isTop ? " top" : ""}`}
                style={{ background: `rgba(255, 153, 0, ${0.08 + t * 0.85})`, color: t > 0.55 ? "#111" : "#ffcc80" }}
                title={`${home} ${i}–${j} ${away}: ${pct(p)}`}
                onMouseEnter={() => setTip(`${home} ${i}–${j} ${away}: ${pct(p)}`)}
                onMouseLeave={() => setTip(null)}
                onFocus={() => setTip(`${home} ${i}–${j} ${away}: ${pct(p)}`)}
                onBlur={() => setTip(null)}
              >
                {p >= 0.01 ? pct(p) : "·"}
              </div>
            );
          }
          return row;
        })}
      </div>
      {tip ? <p className="bb-heat-tip">{tip}</p> : null}
      {estimate.topScores && estimate.topScores.length > 0 ? (
        <ol className="bb-top-scores">
          {estimate.topScores.slice(0, 5).map((c, i) => (
            <li key={`${c.home}-${c.away}-${i}`}>
              <strong>
                {c.home}–{c.away}
              </strong>{" "}
              <span>{pct(c.p)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="meta">
        Sumbu kiri: gol {home}. Sumbu atas: gol {away}. Kotak paling terang adalah skor dengan peluang model tertinggi.
      </p>
    </div>
  );
}
