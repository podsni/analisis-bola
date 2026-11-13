import Link from "next/link";
import type { BacktestResult, LeagueModelPayload } from "@/lib/types";
import { pct } from "@/lib/format";

function labelOutcome(o: "H" | "D" | "A"): string {
  return o === "H" ? "Tuan rumah" : o === "D" ? "Seri" : "Tamu";
}

export function BacktestPanel({
  model,
  slug,
}: {
  model?: LeagueModelPayload;
  slug: string;
}) {
  if (!model) return null;
  if (!model.available) {
    return (
      <section className="bb-panel" id="uji-balik">
        <h2>UJI BALIK  <span className="bb-fn-inline">MODEL &lt;GO&gt;</span></h2>
        <p className="empty">{model.reason}</p>
      </section>
    );
  }
  const bt = model.backtest;
  return (
    <section className="bb-panel" id="uji-balik">
      <h2>UJI BALIK MODEL  <span className="bb-fn-inline">BTST &lt;GO&gt;</span></h2>
      <p className="meta">
        Keunggulan kandang terpasang {model.homeAdvantage?.toFixed(3).replace(".", ",")} · rho {model.rho?.toFixed(3).replace(".", ",")} ·
        sampel {model.samples} laga · paruh hidup {model.halfLifeDays} hari.
        Semua angka di bawah adalah estimasi statistik, bukan saran taruhan.
      </p>
      {!bt?.available ? (
        <p className="empty">{bt?.reason}</p>
      ) : (
        <>
          <div className="bb-kpi">
            <div>
              <b>{pct(bt.accuracy)}</b>
              <span>Akurasi 1/X/2</span>
            </div>
            <div>
              <b>{bt.brier.toFixed(3).replace(".", ",")}</b>
              <span>Skor Brier</span>
            </div>
            <div>
              <b>{bt.logLoss.toFixed(3).replace(".", ",")}</b>
              <span>Log-loss</span>
            </div>
            <div>
              <b>
                {bt.correct}/{bt.n}
              </b>
              <span>Tepat 1X2 / laga diuji</span>
            </div>
            <div>
              <b>{bt.exactCorrect}/{bt.n}</b>
              <span>Skor tepat ({pct(bt.exactAccuracy)})</span>
            </div>
            <div>
              <b>{bt.predictedDraws}</b>
              <span>Prediksi seri (aktual {bt.byOutcome.D.n})</span>
            </div>
          </div>
          <p className="meta">
            Skor Brier 0 berarti sempurna; pembagian peluang merata (⅓–⅓–⅓) sekitar 0,667. Log-loss lebih rendah lebih baik.
            Setiap laga diperkirakan hanya dengan data sebelum kickoff.
          </p>
          <div className="bb-split">
            <div>
              <h3>Kalibrasi peluang tuan rumah</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Kelompok p</th>
                      <th className="num">N</th>
                      <th className="num">Rata-rata p</th>
                      <th className="num">Terbukti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bt.calibration.map((c) => (
                      <tr key={`${c.from}-${c.to}`}>
                        <td>
                          {Math.round(c.from * 100)}–{Math.round(c.to * 100)}%
                        </td>
                        <td className="num">{c.count}</td>
                        <td className="num">{pct(c.avgPredicted)}</td>
                        <td className="num">{pct(c.observed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3>Pecahan hasil aktual</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Hasil</th>
                      <th className="num">Laga</th>
                      <th className="num">Tepat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["H", "D", "A"] as const).map((k) => (
                      <tr key={k}>
                        <td>{labelOutcome(k)}</td>
                        <td className="num">{bt.byOutcome[k].n}</td>
                        <td className="num">{bt.byOutcome[k].correct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <h3>Laga yang diuji</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Pertandingan</th>
                  <th className="num">Skor</th>
                  <th className="num">P tuan</th>
                  <th className="num">P seri</th>
                  <th className="num">P tamu</th>
                  <th>Model</th>
                  <th>Skor model</th>
                  <th>Aktual</th>
                  <th className="num">Brier</th>
                </tr>
              </thead>
              <tbody>
                {bt.rows.map((r) => (
                  <tr key={r.id} className={r.correct ? "ok" : "miss"}>
                    <td>
                      <Link href={`/liga/${slug}/pertandingan/${r.id}`}>{r.dateWib}</Link>
                    </td>
                    <td>
                      {r.home} vs {r.away}
                    </td>
                    <td className="num">{r.score}</td>
                    <td className="num">{pct(r.pHome)}</td>
                    <td className="num">{pct(r.pDraw)}</td>
                    <td className="num">{pct(r.pAway)}</td>
                    <td>{labelOutcome(r.predicted)}</td>
                    <td>{r.predScore ?? "—"}</td>
                    <td>{labelOutcome(r.actual)}</td>
                    <td className="num">{r.brier.toFixed(3).replace(".", ",")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export function ModelMeta({ model }: { model?: LeagueModelPayload }) {
  if (!model) return null;
  return <p className="method">{model.method}</p>;
}

// silence unused if tree-shaken differently
export type { BacktestResult };
