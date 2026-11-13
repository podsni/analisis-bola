import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/components/Callout";
import { ContributionsPanel } from "@/components/ContributionsPanel";
import { MatchTabs } from "@/components/MatchTabs";
import { PredictionCard } from "@/components/PredictionCard";
import { ScorersTable } from "@/components/ScorersTable";
import { StatCompare } from "@/components/StatCompare";
import { TeamLink } from "@/components/TeamLink";
import { TeamStats } from "@/components/TeamStats";
import { loadMatch } from "@/lib/data";
import { getLeague } from "@/lib/leagues";

export const revalidate = 300;
export const maxDuration = 60;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const league = getLeague(slug);
  if (!league) return { title: "Pertandingan" };
  try {
    const data = await loadMatch(slug, id);
    if (!data) return { title: league.name };
    return {
      title: `${data.match.home.name} vs ${data.match.away.name} · ${league.name}`,
    };
  } catch {
    return { title: league.name };
  }
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  let data;
  try {
    data = await loadMatch(slug, id);
  } catch (err) {
    return (
      <div className="wrap page-head">
        <h1>Analisis tidak dapat dimuat</h1>
        <p className="error">{err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil data."}</p>
      </div>
    );
  }
  if (!data) notFound();
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
        <p className="kicker">LAGA {match.id}  ·  MODEL &lt;GO&gt;  ·  H2H &lt;GO&gt;</p>
        <div className="match-hero">
          <TeamLink slug={data.slug} id={match.home.id} name={match.home.name} logo={match.home.logo} size={56} />
          <div className="hero-score">
            <div className="score">{scoreLine === "belum kickoff" ? "vs" : scoreLine}</div>
            <div className="when">
              {match.status === "in" ? <span className="badge live">LIVE {match.clock || match.detail || ""}</span> : null}
              {match.status === "post" ? <span className="badge done">Selesai</span> : null}
            </div>
          </div>
          <TeamLink slug={data.slug} id={match.away.id} name={match.away.name} logo={match.away.logo} size={56} className="right" />
        </div>
        <p className="when">
          {match.dateWib}
          {match.timeValid && match.timeWib ? ` · ${match.timeWib} WIB` : " · jam belum tersedia"}
          {match.venue ? ` · ${match.venue}` : ""}
        </p>
        <p className="meta">Sumber: {data.source}. Diperbarui {data.fetchedAtWib}.</p>
      </header>

      {data.limitedNote ? <Callout>{data.limitedNote}</Callout> : null}

      <MatchTabs
        tabs={[
          {
            id: "prediksi",
            label: "Prediksi",
            node: (
              <>
                <PredictionCard estimate={data.estimate} match={match} />
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
                      Statistik diambil dari ringkasan ESPN. xG tim hanya tampil jika sumbernya menyediakan angka tingkat tim, bukan xG satu pemain.
                    </p>
                    <div className="card">
                      <StatCompare home={data.matchStats.home} away={data.matchStats.away} />
                    </div>
                  </section>
                ) : match.status === "post" ? (
                  <p className="empty">Statistik detail belum tersedia untuk pertandingan ini.</p>
                ) : (
                  <p className="empty">Statistik laga muncul setelah pertandingan selesai, jika sumbernya menyediakan.</p>
                )}
                {match.events && match.events.length > 0 ? (
                  <section className="section">
                    <h2>PERISTIWA</h2>
                    <ul className="events glow-list">
                      {match.events.map((e, i) => (
                        <li key={`${e.minute}-${e.type}-${e.player ?? ""}-${i}`} className={e.scoring ? "goal" : ""}>
                          {e.text}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
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
                  <h2>HEAD-TO-HEAD  <span className="bb-fn-inline">H2H &lt;GO&gt;</span></h2>
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
                  ) : null}
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
