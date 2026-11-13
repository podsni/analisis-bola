import type { MatchSummary, PoissonEstimate } from "@/lib/types";
import { pct } from "@/lib/format";
import { Callout } from "./Callout";
import { ScoreHeatmap } from "./ScoreHeatmap";

export function PredictionCard({
  estimate,
  match,
}: {
  estimate: PoissonEstimate;
  match: MatchSummary;
}) {
  const actual =
    match.status === "post" && match.home.score != null && match.away.score != null
      ? `${match.home.score}–${match.away.score}`
      : null;
  const actualSide =
    actual != null
      ? Number(match.home.score) > Number(match.away.score)
        ? "tuan rumah"
        : Number(match.home.score) === Number(match.away.score)
          ? "seri"
          : "tamu"
      : null;
  const pActual =
    actualSide === "tuan rumah" ? estimate.pHome : actualSide === "seri" ? estimate.pDraw : actualSide === "tamu" ? estimate.pAway : null;

  return (
    <section className="bb-panel estimate" id="model">
      <h2>ESTIMASI MODEL  <span className="bb-fn-inline">MODEL &lt;GO&gt;</span></h2>
      <Callout>
        Angka di bawah ini adalah estimasi statistik dari model Poisson berbobot Dixon-Coles, memakai riwayat liga
        sebelum kickoff. Ini bukan saran taruhan, bukan pasaran, dan tidak dijamin akurat.
      </Callout>
      {!estimate.available ? (
        <p className="empty">{estimate.reason}</p>
      ) : (
        <>
          <p className="lambda">
            {estimate.mode === "in" && estimate.remainingMinutes != null
              ? `Mode berjalan · sisa waktu model ${estimate.remainingMinutes.toFixed(0)} menit · skor ${estimate.currentHome ?? "–"}–${estimate.currentAway ?? "–"}. `
              : estimate.mode === "post"
                ? "Mode pra-laga (hanya data sebelum kickoff), dibanding hasil aktual. "
                : "Mode pra-laga. "}
            Perkiraan gol model{estimate.mode === "in" ? " sisa" : ""}: {match.home.name}{" "}
            {estimate.lambdaHome.toFixed(2).replace(".", ",")} · {match.away.name} {estimate.lambdaAway.toFixed(2).replace(".", ",")}
            {estimate.homeAdvantage ? ` · keunggulan kandang ${String(estimate.homeAdvantage).replace(".", ",")}` : ""}
            {estimate.rho != null ? ` · rho ${String(estimate.rho).replace(".", ",")}` : ""}
          </p>
          <div className="bb-xg">
            <div>
              <span>Perkiraan gol {match.home.name}</span>
              <b>{estimate.lambdaHome.toFixed(2).replace(".", ",")}</b>
            </div>
            <div>
              <span>Perkiraan gol {match.away.name}</span>
              <b>{estimate.lambdaAway.toFixed(2).replace(".", ",")}</b>
            </div>
          </div>
          {actual && pActual != null ? (
            <p className="lambda">
              Hasil aktual {actual} ({actualSide}). Model memberi {pct(pActual)} pada hasil yang terjadi.
            </p>
          ) : null}
          {estimate.predScore ? (
            <p className="pred-score-line">
              Skor paling mungkin menurut model: <strong>{estimate.predScore}</strong>
              {estimate.pick === "H"
                ? " · 1X2: menang tuan rumah"
                : estimate.pick === "A"
                  ? " · 1X2: menang tamu"
                  : estimate.pick === "D"
                    ? " · 1X2: seri"
                    : ""}
              {estimate.oneXtwoHasil ? (
                <span className={`log-badge ${estimate.oneXtwoHasil === "TEPAT" ? "tepat" : "meleset"}`}>1X2 {estimate.oneXtwoHasil}</span>
              ) : null}
              {estimate.scoreHasil ? (
                <span className={`log-badge ${estimate.scoreHasil === "TEPAT" ? "tepat" : "meleset"}`}>Skor {estimate.scoreHasil}</span>
              ) : null}
            </p>
          ) : null}
          <div className="bars">
            <div className="bar-row">
              <span>Menang {match.home.name}</span>
              <div className="bar">
                <i style={{ width: pct(estimate.pHome) }} />
              </div>
              <strong>{pct(estimate.pHome)}</strong>
            </div>
            <div className="bar-row">
              <span>Seri</span>
              <div className="bar draw">
                <i style={{ width: pct(estimate.pDraw) }} />
              </div>
              <strong>{pct(estimate.pDraw)}</strong>
            </div>
            <div className="bar-row">
              <span>Menang {match.away.name}</span>
              <div className="bar away">
                <i style={{ width: pct(estimate.pAway) }} />
              </div>
              <strong>{pct(estimate.pAway)}</strong>
            </div>
          </div>
          <ScoreHeatmap estimate={estimate} home={match.home.name} away={match.away.name} />
          {estimate.confidence ? <p className="confidence">{estimate.confidence}</p> : null}
        </>
      )}
      <p className="method">{estimate.method}</p>
    </section>
  );
}
