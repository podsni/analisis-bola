"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PredictionLogPayload, PredictionLogRow } from "@/lib/types";
import { pct } from "@/lib/format";
import { Callout } from "./Callout";
import { OutcomeBar } from "./OutcomeBar";

function hasilClass(h: PredictionLogRow["hasil"]): string {
  if (h === "TEPAT") return "tepat";
  if (h === "MELESET") return "meleset";
  return "menunggu";
}

function HasilBadge({ h }: { h: PredictionLogRow["hasil"] }) {
  return <span className={`log-badge ${hasilClass(h)}`}>{h}</span>;
}

export function PredictionLogTable({
  data,
  showLeague = false,
}: {
  data: PredictionLogPayload;
  showLeague?: boolean;
}) {
  const s = data.summary;
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<"ALL" | "TEPAT" | "MELESET" | "MENUNGGU">("ALL");
  const [league, setLeague] = useState("ALL");
  const [minP, setMinP] = useState(0);
  const [sort, setSort] = useState<"date" | "p" | "hasil">("date");

  const leagues = useMemo(() => {
    const set = new Set(data.rows.map((r) => r.leagueName));
    return [...set].sort();
  }, [data.rows]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = data.rows.filter((r) => {
      if (hasil !== "ALL" && r.hasil !== hasil) return false;
      if (league !== "ALL" && r.leagueName !== league) return false;
      if (r.totals.p < minP / 100) return false;
      if (!needle) return true;
      return `${r.home} ${r.away} ${r.predictionText} ${r.leagueName}`.toLowerCase().includes(needle);
    });
    out = [...out].sort((a, b) => {
      if (sort === "p") return b.totals.p - a.totals.p;
      if (sort === "hasil") return a.hasil.localeCompare(b.hasil) || b.dateUtc.localeCompare(a.dateUtc);
      const aw = a.hasil === "MENUNGGU" ? 0 : 1;
      const bw = b.hasil === "MENUNGGU" ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return aw === 0 ? a.dateUtc.localeCompare(b.dateUtc) : b.dateUtc.localeCompare(a.dateUtc);
    });
    return out;
  }, [data.rows, q, hasil, league, minP, sort]);

  return (
    <div className="log-wrap">
      <Callout>
        Ini estimasi statistik dari model Dixon-Coles, bukan saran taruhan. Tidak ada pasaran, nilai taruhan,
        keuntungan, atau ROI. Kolom Hasil merujuk pada garis total gol. 1X2 dan skor tepat dinilai terpisah.
      </Callout>
      {!data.available ? (
        <p className="empty">{data.reason}</p>
      ) : (
        <>
          <div className="log-kpi">
            <div>
              <span>Jml sampel</span>
              <b>{s.n}</b>
            </div>
            <div>
              <span>Tepat (garis)</span>
              <b className="ok">{s.tepat}</b>
            </div>
            <div>
              <span>Meleset</span>
              <b className="bad">{s.meleset}</b>
            </div>
            <div>
              <span>Akurasi garis</span>
              <b>{s.n ? pct(s.accuracy) : "—"}</b>
            </div>
            <div>
              <span>Menunggu</span>
              <b>{s.waiting}</b>
            </div>
            <div>
              <span>Akurasi 1X2</span>
              <b>{s.n && s.oneXtwoAccuracy != null ? pct(s.oneXtwoAccuracy) : "—"}</b>
            </div>
            <div>
              <span>Akurasi skor</span>
              <b>{s.n && s.scoreAccuracy != null ? pct(s.scoreAccuracy) : "—"}</b>
            </div>
          </div>

          <div className="bb-split log-breaks">
            <div>
              <h3>Pecahan menurut garis total gol</h3>
              {s.byLine.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Garis</th>
                        <th className="num">N</th>
                        <th className="num">Tepat</th>
                        <th className="num">Akurasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.byLine.map((l) => (
                        <tr key={l.key}>
                          <td>{l.key}</td>
                          <td className="num">{l.n}</td>
                          <td className="num">{l.tepat}</td>
                          <td className="num">{pct(l.accuracy)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty">Belum ada pecahan garis.</p>
              )}
            </div>
            <div>
              <h3>Kalibrasi peluang garis</h3>
              {s.calibration.length ? (
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
                      {s.calibration.map((c) => (
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
              ) : (
                <p className="empty">Belum ada kalibrasi.</p>
              )}
            </div>
          </div>

          <form className="log-filters" onSubmit={(e) => e.preventDefault()}>
            <label>
              <span>Cari tim</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. City atau Fulham" />
            </label>
            <label>
              <span>Hasil garis</span>
              <select value={hasil} onChange={(e) => setHasil(e.target.value as typeof hasil)}>
                <option value="ALL">Semua</option>
                <option value="TEPAT">TEPAT</option>
                <option value="MELESET">MELESET</option>
                <option value="MENUNGGU">MENUNGGU</option>
              </select>
            </label>
            {showLeague || leagues.length > 1 ? (
              <label>
                <span>Liga</span>
                <select value={league} onChange={(e) => setLeague(e.target.value)}>
                  <option value="ALL">Semua liga</option>
                  {leagues.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>Peluang min {minP}%</span>
              <input type="range" min={0} max={90} step={5} value={minP} onChange={(e) => setMinP(Number(e.target.value))} />
            </label>
            <label>
              <span>Urutan</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="date">Tanggal</option>
                <option value="p">Peluang</option>
                <option value="hasil">Hasil</option>
              </select>
            </label>
          </form>
          <p className="meta">{rows.length} baris tampil dari {data.rows.length} laga.</p>

          <div className="table-wrap log-table-desktop">
            <table className="log-sheet">
              <thead>
                <tr>
                  <th>Hasil</th>
                  {showLeague ? <th>Liga</th> : null}
                  <th>Pertandingan</th>
                  <th>Prediksi</th>
                  <th className="num">Peluang</th>
                  <th className="num">Skor akhir</th>
                  <th>Tanggal WIB</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.slug}-${r.id}`} className={hasilClass(r.hasil)}>
                    <td>
                      <HasilBadge h={r.hasil} />
                    </td>
                    {showLeague ? <td>{r.leagueName}</td> : null}
                    <td>
                      <Link href={`/liga/${r.slug}/pertandingan/${r.id}`}>
                        {r.home} vs {r.away}
                      </Link>
                    </td>
                    <td>
                      <div className="log-pred">
                        <strong>{r.totals.label}</strong>
                        <span>
                          1X2: {r.oneXtwoLabel}
                          {r.predScore ? ` · skor ${r.predScore}` : ""}
                        </span>
                        {r.totals.belowThreshold ? <span className="meta">Peluang garis di bawah 65%</span> : null}
                        {r.oneXtwoHasil ? <span className="meta">1X2 {r.oneXtwoHasil.toLowerCase()}</span> : null}
                        {r.scoreHasil ? <span className="meta">skor {r.scoreHasil.toLowerCase()}</span> : null}
                      </div>
                    </td>
                    <td className="num">{pct(r.totals.p)}</td>
                    <td className="num">{r.score ?? "—"}</td>
                    <td>
                      {r.dateWib}
                      {r.timeWib ? ` · ${r.timeWib}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="log-cards">
            {rows.map((r) => (
              <article key={`card-${r.slug}-${r.id}`} className={`log-card ${hasilClass(r.hasil)}`}>
                <Link href={`/liga/${r.slug}/pertandingan/${r.id}`} className="log-card-match">
                  <div className="log-card-top">
                    <HasilBadge h={r.hasil} />
                    <span className="log-card-date">
                      {r.dateWib}
                      {r.timeWib ? ` · ${r.timeWib} WIB` : ""}
                    </span>
                  </div>
                  {showLeague ? <p className="meta">{r.leagueName}</p> : null}
                  <strong>
                    {r.home} vs {r.away}
                  </strong>
                </Link>
                <p className="log-card-pred">
                  <strong>{r.totals.label}</strong> · {pct(r.totals.p)}
                  {r.predScore ? ` · skor model ${r.predScore}` : ""}
                </p>
                {r.pHome != null ? (
                  <OutcomeBar
                    estimate={{
                      available: true,
                      lambdaHome: 0,
                      lambdaAway: 0,
                      pHome: r.pHome,
                      pDraw: r.pDraw,
                      pAway: r.pAway,
                      method: "Dixon-Coles",
                      pick: r.oneXtwoPick,
                      predScore: r.predScore,
                      oneXtwoHasil: r.oneXtwoHasil,
                      scoreHasil: r.scoreHasil,
                    }}
                    compact
                  />
                ) : (
                  <p className="meta">1X2: {r.oneXtwoLabel}</p>
                )}
                <p className="log-card-score">Skor akhir: {r.score ?? "belum kickoff"}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
