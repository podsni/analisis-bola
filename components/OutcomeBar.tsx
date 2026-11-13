import type { PoissonEstimate } from "@/lib/types";
import { pct } from "@/lib/format";

export function OutcomeBar({
  estimate,
  compact = false,
}: {
  estimate: PoissonEstimate;
  compact?: boolean;
}) {
  if (!estimate?.available) return null;
  const pred = estimate.predScore;
  const pick =
    estimate.pick === "H" ? "Menang tuan rumah" : estimate.pick === "A" ? "Menang tamu" : estimate.pick === "D" ? "Seri" : null;
  return (
    <div className={`ob${compact ? " compact" : ""}`}>
      {pred ? (
        <div className="ob-score">
          Skor model <strong>{pred}</strong>
          {pick ? <span className="ob-pick"> · {pick}</span> : null}
        </div>
      ) : null}
      <div className="ob-bar" role="img" aria-label={`Peluang ${pct(estimate.pHome)} ${pct(estimate.pDraw)} ${pct(estimate.pAway)}`}>
        <i className="h" style={{ width: pct(estimate.pHome) }} title={`Tuan rumah ${pct(estimate.pHome)}`} />
        <i className="d" style={{ width: pct(estimate.pDraw) }} title={`Seri ${pct(estimate.pDraw)}`} />
        <i className="a" style={{ width: pct(estimate.pAway) }} title={`Tamu ${pct(estimate.pAway)}`} />
      </div>
      <div className="ob-lab">
        <span>{pct(estimate.pHome)}</span>
        <span>{pct(estimate.pDraw)}</span>
        <span>{pct(estimate.pAway)}</span>
      </div>
      {estimate.oneXtwoHasil || estimate.scoreHasil ? (
        <div className="ob-res">
          {estimate.oneXtwoHasil ? (
            <span className={`log-badge ${estimate.oneXtwoHasil === "TEPAT" ? "tepat" : "meleset"}`}>1X2 {estimate.oneXtwoHasil}</span>
          ) : null}
          {estimate.scoreHasil ? (
            <span className={`log-badge ${estimate.scoreHasil === "TEPAT" ? "tepat" : "meleset"}`}>Skor {estimate.scoreHasil}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
