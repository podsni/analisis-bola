"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Callout } from "@/components/Callout";
import { ContributionsPanel } from "@/components/ContributionsPanel";
import { EventTimeline } from "@/components/EventTimeline";
import { Lineups } from "@/components/LineupCard";
import { MatchTabs } from "@/components/MatchTabs";
import { PredictionCard } from "@/components/PredictionCard";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { ScorersTable } from "@/components/ScorersTable";
import { StatCompare } from "@/components/StatCompare";
import { TeamLink } from "@/components/TeamLink";
import { TeamStats } from "@/components/TeamStats";
import { isFreshWindow } from "@/lib/live";
import type { MatchAnalysisPayload } from "@/lib/types";

export function MatchAnalysisView({ initial }: { initial: MatchAnalysisPayload }) {
  const [data, setData] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState(initial.fetchedAtWib);
  const [error, setError] = useState<string | null>(null);

  const shouldPoll = isFreshWindow(data.match);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/liga/${data.slug}/pertandingan/${data.match.id}/live`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json as MatchAnalysisPayload);
      setUpdatedAt((json as MatchAnalysisPayload).fetchedAtWib);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui data langsung.");
    }
  }, [data.slug, data.match.id]);

  useEffect(() => {
    if (!shouldPoll) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh();
    };
    const id = setInterval(tick, 10_000);
    const onVis = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [shouldPoll, refresh]);

  const { match } = data;
  const scoreLine =
    match.status === "post" || match.status === "in"
      ? `${match.home.score ?? "–"}–${match.away.score ?? "–"}`
      : "belum kickoff";

  return (
    <div className="wrap bb-match">
      <header className="page-head vs-head">
        <p className="crumb">
          <Link href="/">Beranda</Link> / <Link href={`/liga/${data.slug}`}>{data.leagueName}</Link> / Analisis
        </p>
        <p className="kicker">LAGA {match.id}</p>
        <div className="match-hero">
          <TeamLink slug={data.slug} id={match.home.id} name={match.home.name} logo={match.home.logo} size={56} />
          <div className="hero-score">
            <div className="score">{scoreLine === "belum kickoff" ? "vs" : scoreLine}</div>
            <div className="when">
              {match.status === "in" ? <span className="badge live">LIVE {match.clock || match.detail || ""}</span> : null}
              {match.status === "post" ? <span className="badge done">Selesai</span> : null}
            </div>
            {match.halfTime ? (
              <p className="ht-score">
                Babak 1: {match.halfTime.home}–{match.halfTime.away}
                {match.secondHalf ? ` · Babak 2: ${match.secondHalf.home}–${match.secondHalf.away}` : ""}
              </p>
            ) : match.status === "post" || match.status === "in" ? (
              <p className="ht-score muted">Pecahan gol babak 1 dan 2 tidak tersedia di sumber data.</p>
            ) : null}
          </div>
          <TeamLink slug={data.slug} id={match.away.id} name={match.away.name} logo={match.away.logo} size={56} className="right" />
        </div>
        <p className="when">
          {match.dateWib}
          {match.timeValid && match.timeWib ? ` · ${match.timeWib} WIB` : " · jam belum tersedia"}
          {match.venue ? ` · ${match.venue}` : ""}
        </p>
        <p className="meta">
          Sumber: {data.source}. Diperbarui {updatedAt}.
          {shouldPoll ? " Halaman ini memperbarui skor dan prediksi berjalan setiap 10 detik selama laga berlangsung." : ""}
          {error ? ` Peringatan: ${error}` : ""}
        </p>
      </header>

      {data.limitedNote ? <Callout>{data.limitedNote}</Callout> : null}

      {data.recommendation ? <RecommendationPanel rec={data.recommendation} /> : null}

      <MatchTabs
        tabs={[
          {
            id: "prediksi",
            label: "Prediksi",
            node: (
              <>
                <PredictionCard estimate={data.estimate} match={match} />
                {data.estimate.pBtts != null ? (
                  <p className="lambda">
                    Peluang kedua tim mencetak gol menurut model: {(data.estimate.pBtts * 100).toFixed(0)}%.
                  </p>
                ) : null}
                {data.contributions ? <ContributionsPanel data={data.contributions} slug={data.slug} /> : null}
              </>
            ),
          },
          {
            id: "statistik",
            label: "Statistik & peristiwa",
            node: (
              <>
                {data.matchStats ? (
                  <section className="section">
                    <h2>STATISTIK LAGA</h2>
                    <p className="meta">
                      Statistik diambil dari ringkasan ESPN, termasuk saat laga berjalan jika sumbernya mengirim angka itu. xG tim hanya tampil jika tersedia di tingkat tim.
                    </p>
                    <div className="card">
                      <StatCompare home={data.matchStats.home} away={data.matchStats.away} />
                    </div>
                  </section>
                ) : (
                  <p className="empty">Statistik laga tidak tersedia di sumber data untuk pertandingan ini.</p>
                )}
                <section className="section">
                  <h2>LINIMASA PERISTIWA</h2>
                  <EventTimeline events={match.events ?? []} />
                </section>
                {data.lineups ? <Lineups home={data.lineups.home} away={data.lineups.away} /> : (
                  <p className="empty">Susunan pemain tidak tersedia di sumber data untuk pertandingan ini.</p>
                )}
              </>
            ),
          },
          {
            id: "tim",
            label: "Form tim",
            node: (
              <div className="two" style={{ marginTop: 8 }}>
                <TeamStats team={data.home} side="Tuan rumah" slug={data.slug} logo={match.home.logo} />
                <TeamStats team={data.away} side="Tamu" slug={data.slug} logo={match.away.logo} />
              </div>
            ),
          },
          {
            id: "h2h",
            label: "Head-to-head",
            node: (
              <>
                <section className="section bb-panel" id="h2h">
                  <h2>HEAD-TO-HEAD</h2>
                  {data.headToHead.summary ? <p className="meta">{data.headToHead.summary}</p> : null}
                  <p className="meta">{data.headToHead.note}</p>
                  {data.headToHead.matches.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Tanggal</th>
                            <th>Musim</th>
                            <th>Dari sisi {match.home.name}</th>
                            <th>Tempat</th>
                            <th className="num">Skor</th>
                            <th>Hasil</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.headToHead.matches.map((g) => (
                            <tr key={g.id}>
                              <td>
                                <Link href={`/liga/${data.slug}/pertandingan/${g.id}`}>{g.dateWib}</Link>
                              </td>
                              <td>{g.season || "—"}</td>
                              <td>vs {g.opponent}</td>
                              <td>{g.homeAway === "home" ? "Kandang" : "Tandang"}</td>
                              <td className="num">
                                {g.scored}–{g.conceded}
                              </td>
                              <td>
                                <span className={`pill ${g.result}`}>{g.result === "W" ? "M" : g.result === "D" ? "S" : "K"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty">Tidak ada pertemuan yang tercatat di sumber data.</p>
                  )}
                </section>
                <section className="section">
                  <h2>PENCETAK GOL LIGA</h2>
                  <p className="meta">
                    Hanya pemain yang masuk sepuluh besar pencetak gol liga di sumber data. Jika kosong, bukan
                    berarti tim tidak punya pencetak gol, melainkan tidak ada yang masuk daftar itu.
                  </p>
                  <div className="two">
                    <div>
                      <h3>{match.home.name}</h3>
                      <ScorersTable scorers={data.scorers.home} slug={data.slug} />
                    </div>
                    <div>
                      <h3>{match.away.name}</h3>
                      <ScorersTable scorers={data.scorers.away} slug={data.slug} />
                    </div>
                  </div>
                </section>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
