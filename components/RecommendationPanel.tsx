import type { MatchRecommendation } from "@/lib/types";
import { pct } from "@/lib/format";
import { Callout } from "./Callout";

export function RecommendationPanel({ rec }: { rec: MatchRecommendation }) {
  const tone = rec.confidence === "Tinggi" ? "tinggi" : rec.confidence === "Sedang" ? "sedang" : "rendah";
  return (
    <section className="bb-panel rec-panel" id="rekomendasi">
      <h2>
        REKOMENDASI STATISTIK <span className="bb-fn-inline">REC &lt;GO&gt;</span>
      </h2>
      <Callout>{rec.disclaimer}</Callout>
      <p className="rec-headline">{rec.headline}</p>
      <div className="rec-kpis">
        <div className="stat">
          <span>Hasil paling mungkin</span>
          <b>{rec.outcomeLabel}</b>
        </div>
        <div className="stat">
          <span>Keyakinan model</span>
          <b className={`rec-conf ${tone}`}>{rec.confidence}</b>
        </div>
        {rec.predScore ? (
          <div className="stat">
            <span>Skor paling mungkin</span>
            <b>{rec.predScore}</b>
          </div>
        ) : null}
        {rec.goalRange ? (
          <div className="stat">
            <span>Kisaran gol</span>
            <b>
              {rec.goalRange.label} <em>{pct(rec.goalRange.p)}</em>
            </b>
          </div>
        ) : null}
        {rec.btts ? (
          <div className="stat">
            <span>Kedua tim mencetak gol</span>
            <b>
              {pct(rec.btts.p)}{" "}
              <em>
                {rec.btts.lean === "ya" ? "condong ya" : rec.btts.lean === "tidak" ? "condong tidak" : "berimbang"}
              </em>
            </b>
          </div>
        ) : null}
      </div>
      <ul className="rec-bullets">
        {rec.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <h3>Mengapa model condong ke situ</h3>
      <p className="rec-why">{rec.why}</p>
      {rec.caveats.length ? (
        <>
          <h3>Catatan</h3>
          <ul className="rec-caveats">
            {rec.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
