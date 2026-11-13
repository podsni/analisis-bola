"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatCountdown, pct } from "@/lib/format";
import type { LiveMatchCard, LivePayload, PoissonEstimate } from "@/lib/types";
import { Callout } from "./Callout";
import { TeamLink } from "./TeamLink";

function EstimateBars({ estimate, home, away }: { estimate: PoissonEstimate; home: string; away: string }) {
  if (!estimate.available) return <p className="empty">{estimate.reason}</p>;
  return (
    <div className="bars" style={{ marginTop: 10 }}>
      <div className="bar-row">
        <span>Menang {home}</span>
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
        <span>Menang {away}</span>
        <div className="bar away">
          <i style={{ width: pct(estimate.pAway) }} />
        </div>
        <strong>{pct(estimate.pAway)}</strong>
      </div>
    </div>
  );
}

function Card({ item, now, live }: { item: LiveMatchCard; now: Date; live: boolean }) {
  const { match, estimate } = item;
  const href = `/liga/${item.slug}/pertandingan/${match.id}`;
  return (
    <article className={`card ${live ? "live-card" : "live-card upcoming"}`}>
      <div className="live-top">
        <span>
          {live ? <span className="badge live">LIVE {match.clock || match.detail || ""}</span> : <span className="badge soon">PRA-LAGA</span>}{" "}
          {item.leagueName}
        </span>
        <span>
          {match.dateWib}
          {match.timeValid && match.timeWib ? ` · ${match.timeWib} WIB` : ""}
          {match.venue ? ` · ${match.venue}` : ""}
        </span>
      </div>
      <div className="live-score">
        <div className="name"><TeamLink slug={item.slug} id={match.home.id} name={match.home.name} logo={match.home.logo} size={32} /></div>
        <div className="nums">
          {live || match.status === "post" ? (
            <>
              {match.home.score ?? "–"}–{match.away.score ?? "–"}
            </>
          ) : (
            <div className="countdown">{formatCountdown(match.dateUtc, now)}</div>
          )}
        </div>
        <div className="name right"><TeamLink slug={item.slug} id={match.away.id} name={match.away.name} logo={match.away.logo} size={32} className="right" /></div>
      </div>
      {estimate.available ? (
        <p className="lambda">
          {estimate.mode === "in"
            ? `Estimasi berjalan (sisa model ${estimate.remainingMinutes ?? "–"} menit). `
            : "Estimasi pra-laga. "}
          Perkiraan gol{estimate.mode === "in" ? " sisa" : ""}: {match.home.name} {estimate.lambdaHome.toFixed(2).replace(".", ",")} · {match.away.name}{" "}
          {estimate.lambdaAway.toFixed(2).replace(".", ",")}
        </p>
      ) : null}
      <EstimateBars estimate={estimate} home={match.home.name} away={match.away.name} />
      {match.events && match.events.length > 0 ? (
        <ul className="events">
          {match.events.slice(-8).map((e, i) => (
            <li key={`${e.minute}-${e.type}-${e.player ?? ""}-${i}`}>{e.text}</li>
          ))}
        </ul>
      ) : live ? (
        <p className="empty">Peristiwa penting belum tersedia di papan skor.</p>
      ) : null}
      <p className="meta" style={{ marginTop: 10 }}>
        <Link href={href}>buka analisis lengkap →</Link>
      </p>
    </article>
  );
}

export function LiveBoard() {
  const [data, setData] = useState<LivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/langsung", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json as LivePayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data langsung.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, [load]);

  useEffect(() => {
    const ms = Math.max(5, data?.pollSeconds ?? 10) * 1000;
    const poll = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, ms);
    const onVis = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, data?.pollSeconds]);

  if (loading && !data) {
    return <p className="loading">$ memuat papan skor<span className="cursor" /></p>;
  }
  if (error && !data) {
    return (
      <div>
        <p className="error">error: {error}</p>
        <button type="button" onClick={load} style={{ background: "transparent", color: "var(--green)", border: "1px solid var(--line)", padding: "6px 10px", fontFamily: "inherit", cursor: "pointer" }}>
          $ retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div>
      <p className="poll-meta">
        last fetch: {data.fetchedAtWib} · interval {data.pollSeconds}s · clock {now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour12: false })} WIB
        {error ? ` · peringatan: ${error}` : ""}
      </p>
      {data.note ? <Callout>{data.note}</Callout> : null}

      <section className="section">
        <h2>$ tail -f /var/log/langsung.log</h2>
        {data.live.length === 0 ? (
          <p className="empty">Tidak ada pertandingan berlangsung saat ini.</p>
        ) : (
          <div className="live-board">
            {data.live.map((item) => (
              <Card key={item.match.id} item={item} now={now} live />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>$ cron --next-kickoff</h2>
        {data.upcoming.length === 0 ? (
          <p className="empty">Jadwal berikutnya belum tersedia di sumber data.</p>
        ) : (
          <div className="live-board">
            {data.upcoming.map((item) => (
              <Card key={item.match.id} item={item} now={now} live={false} />
            ))}
          </div>
        )}
      </section>

      <p className="method">
        Estimasi di halaman ini memakai model Poisson plus faktor kandang 1,15, dari rata-rata
        gol klasemen. Saat laga berlangsung, perkiraan gol sisa diskalakan menurut sisa waktu
        regulasi lalu ditambah skor berjalan. Ini estimasi statistik untuk analisis, bukan saran
        taruhan, dan tidak terkait peluang judi atau hadiah.
      </p>
    </div>
  );
}
