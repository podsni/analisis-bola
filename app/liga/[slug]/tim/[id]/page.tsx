import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/components/Callout";
import dynamic from "next/dynamic";
import { FormPills } from "@/components/FormPills";
import { TeamLink } from "@/components/TeamLink";
import { loadTeam } from "@/lib/data";
import { avgLabel } from "@/lib/format";
import { getLeague } from "@/lib/leagues";
import type { SeasonHistory } from "@/lib/types";

const GoalsTrendChart = dynamic(() => import("@/components/Charts").then((m) => m.GoalsTrendChart), {
  loading: () => <p className="meta">Memuat grafik gol…</p>,
});
const PointsChart = dynamic(() => import("@/components/Charts").then((m) => m.PointsChart), {
  loading: () => <p className="meta">Memuat grafik poin…</p>,
});

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
  try {
    const data = await loadTeam(slug, id);
    if (!data) return { title: league?.name || "Tim" };
    return { title: `${data.team.name} · ${data.leagueName}` };
  } catch {
    return { title: league?.name || "Tim" };
  }
}

function resultLabel(r: "W" | "D" | "L") {
  return r === "W" ? "Menang" : r === "D" ? "Seri" : "Kalah";
}

function SeasonBlock({
  history,
  slug,
  teamId,
}: {
  history: SeasonHistory;
  slug: string;
  teamId: string;
}) {
  const a = history.analysis;
  return (
    <section className="section season-block">
      <h2>RIWAYAT MUSIM {history.year}</h2>
      <p className="meta">{history.label}</p>

      <div className="split-grid" style={{ marginBottom: 16 }}>
        <div className="stat">
          <span>Rekor</span>
          <b>
            {a.overall.won}–{a.overall.drawn}–{a.overall.lost}
          </b>
          <span>
            {a.overall.played} main · gol {avgLabel(a.overall.gfAvg)} / kebobolan {avgLabel(a.overall.gaAvg)}
          </span>
        </div>
        <div className="stat">
          <span>Kandang</span>
          <b>
            {a.home.played ? `${a.home.won}–${a.home.drawn}–${a.home.lost}` : "—"}
          </b>
          <span>{a.home.played ? `${a.home.played} main` : "Belum ada data kandang"}</span>
        </div>
        <div className="stat">
          <span>Tandang</span>
          <b>
            {a.away.played ? `${a.away.won}–${a.away.drawn}–${a.away.lost}` : "—"}
          </b>
          <span>{a.away.played ? `${a.away.played} main` : "Belum ada data tandang"}</span>
        </div>
        <div className="stat">
          <span>Clean sheet</span>
          <b>{a.cleanSheets}</b>
          <span>Gagal mencetak gol: {a.failedToScore}</span>
        </div>
        <div className="stat">
          <span>Kemenangan terbesar</span>
          <b>{a.biggestWin ? `${a.biggestWin.scored}–${a.biggestWin.conceded}` : "—"}</b>
          <span>{a.biggestWin ? `${a.biggestWin.dateWib} vs ${a.biggestWin.opponent}` : "Belum ada"}</span>
        </div>
        <div className="stat">
          <span>Kekalahan terlebar</span>
          <b>{a.biggestLoss ? `${a.biggestLoss.scored}–${a.biggestLoss.conceded}` : "—"}</b>
          <span>{a.biggestLoss ? `${a.biggestLoss.dateWib} vs ${a.biggestLoss.opponent}` : "Belum ada"}</span>
        </div>
      </div>

      <p className="meta">Form lima pertandingan terakhir</p>
      <FormPills items={a.lastFive} />

      <div className="two" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>Tren gol</h3>
          <GoalsTrendChart points={a.goalsTrend} />
        </div>
        <div className="card">
          <h3>Akumulasi poin</h3>
          <PointsChart points={a.pointsProgression} />
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Tanggal (WIB)</th>
              <th>Lawan</th>
              <th>Tempat</th>
              <th className="num">Skor</th>
              <th>Hasil</th>
            </tr>
          </thead>
          <tbody>
            {history.matches
              .slice()
              .reverse()
              .map((m) => {
                const isHome = m.home.id === teamId;
                const opp = isHome ? m.away : m.home;
                const scored = m.status === "post" ? m.home.score != null && m.away.score != null : false;
                const gf = isHome ? m.home.score : m.away.score;
                const ga = isHome ? m.away.score : m.home.score;
                const result =
                  m.status !== "post" || gf == null || ga == null
                    ? null
                    : Number(gf) > Number(ga)
                      ? "W"
                      : Number(gf) === Number(ga)
                        ? "D"
                        : "L";
                return (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/liga/${slug}/pertandingan/${m.id}`}>
                        {m.dateWib}
                        {m.timeValid && m.timeWib ? ` · ${m.timeWib}` : ""}
                      </Link>
                    </td>
                    <td>
                      <TeamLink slug={slug} id={opp.id} name={opp.name} logo={opp.logo} size={22} />
                    </td>
                    <td>{isHome ? "Kandang" : "Tandang"}</td>
                    <td className="num">{scored ? `${gf}–${ga}` : m.status === "pre" ? "Akan datang" : "—"}</td>
                    <td>
                      {result ? (
                        <span className={`pill ${result}`}>{result === "W" ? "M" : result === "D" ? "S" : "K"}</span>
                      ) : (
                        "—"
                      )}
                      {result ? ` ${resultLabel(result)}` : ""}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  let data;
  try {
    data = await loadTeam(slug, id);
  } catch (err) {
    return (
      <div className="wrap page-head">
        <h1>Riwayat tim tidak dapat dimuat</h1>
        <p className="error">{err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil data."}</p>
      </div>
    );
  }
  if (!data) notFound();

  return (
    <div className="wrap">
      <header className="page-head team-hero">
        <p className="crumb">
          <Link href="/">Beranda</Link> / <Link href={`/liga/${data.slug}`}>{data.leagueName}</Link> / {data.team.name}
        </p>
        <p className="kicker">TEAM {data.team.id} &lt;GO&gt;</p>
        <div className="team-title">
          <TeamLink slug={data.slug} id={data.team.id} name={data.team.name} logo={data.team.logo} size={72} />
        </div>
        <p className="meta">
          {data.team.standingSummary ? `${data.team.standingSummary} · ` : ""}
          {data.team.recordSummary ? `rekor ${data.team.recordSummary} · ` : ""}
          Sumber: {data.source}. Diperbarui {data.fetchedAtWib}.
        </p>
      </header>
      {data.limitedNote ? <Callout>{data.limitedNote}</Callout> : null}
      <SeasonBlock history={data.current} slug={data.slug} teamId={data.team.id} />
      {data.previous.map((season) => (
        <SeasonBlock key={season.year} history={season} slug={data.slug} teamId={data.team.id} />
      ))}
    </div>
  );
}
