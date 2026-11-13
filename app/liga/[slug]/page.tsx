import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BacktestPanel, ModelMeta } from "@/components/BacktestPanel";
import { Callout } from "@/components/Callout";
import { MatchList } from "@/components/MatchList";
import { ScorersTable } from "@/components/ScorersTable";
import { StandingsTable } from "@/components/StandingsTable";
import { loadLeague } from "@/lib/data";
import { getLeague } from "@/lib/leagues";

export const revalidate = 300;
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const league = getLeague(slug);
  if (!league) return { title: "Liga tidak ditemukan" };
  return { title: `${league.name} ${league.seasonName}` };
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let data;
  try {
    data = await loadLeague(slug);
  } catch (err) {
    return (
      <div className="wrap page-head">
        <h1>Data liga tidak dapat dimuat</h1>
        <p className="error">{err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil data."}</p>
      </div>
    );
  }
  if (!data) notFound();

  return (
    <div className="wrap">
      <header className="page-head">
        <p className="crumb">
          <Link href="/">HOME</Link> / {data.name}
        </p>
        <p className="kicker">
          {data.slug === "premier-league" ? "EPL" : data.slug === "la-liga" ? "LAL" : data.slug === "serie-a" ? "SEA" : "IDN"} &lt;GO&gt;
        </p>
        <h1>
          {data.name} {data.seasonName} · {data.country}
        </h1>
        <p className="meta">
          Sumber: {data.source}. Diperbarui {data.fetchedAtWib}.
        </p>
        {data.sourceNote ? <p className="meta">{data.sourceNote}</p> : null}
        {data.model?.available ? (
          <p className="meta">
            Model historis terpasang dari {data.model.samples} laga · keunggulan kandang{" "}
            {data.model.homeAdvantage?.toFixed(3).replace(".", ",")} · rho {data.model.rho?.toFixed(3).replace(".", ",")}
            . Estimasi statistik, bukan saran taruhan.
          </p>
        ) : null}
      </header>

        <p className="log-league-links">
          <Link href={`/liga/${data.slug}/log`} className="bb-fn">
            LOG &lt;GO&gt;
          </Link>
          <Link href="/log" className="bb-fn">
            LOG SEMUA &lt;GO&gt;
          </Link>
        </p>

      {data.limitedNote ? <Callout>{data.limitedNote}</Callout> : null}

      <div className="bb-league-grid">
        <section className="bb-panel" id="klasemen">
          <h2>KLASEMEN</h2>
          <StandingsTable rows={data.standings} slug={data.slug} />
        </section>
        <div className="bb-stack">
          <section className="bb-panel" id="jadwal">
            <h2>JADWAL</h2>
            <p className="meta">Waktu dalam WIB. Tiga angka di bawah skor/jam adalah peluang model menang tuan rumah, seri, dan tamu.</p>
            <MatchList
              matches={data.upcoming}
              slug={data.slug}
              estimates={data.estimates}
              empty="Tidak ada jadwal berikutnya di sumber data saat ini. Liga Eropa sedang jeda internasional pada pertengahan November 2026, jadi jadwal bisa baru muncul untuk akhir November."
            />
          </section>
          <section className="bb-panel" id="hasil">
            <h2>HASIL</h2>
            <MatchList matches={data.recent} slug={data.slug} estimates={data.estimates} empty="Hasil terbaru belum tersedia." />
          </section>
        </div>
      </div>

      <section className="bb-panel" id="pencetak-gol">
        <h2>PENCETAK GOL</h2>
        <ScorersTable scorers={data.scorers} note={data.scorersNote} slug={data.slug} />
      </section>

      <BacktestPanel model={data.model} slug={data.slug} />
      <ModelMeta model={data.model} />
    </div>
  );
}
