import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PredictionLogTable } from "@/components/PredictionLogTable";
import { PageSkeleton } from "@/components/Skeleton";
import { loadPredictionLog } from "@/lib/data";
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
  return { title: league ? `Log prediksi ${league.name}` : "Log prediksi" };
}

async function LeagueLogPageInner({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getLeague(slug)) notFound();
  let data;
  try {
    data = await loadPredictionLog(slug);
  } catch (err) {
    return (
      <div className="wrap page-head">
        <h1>Log prediksi tidak dapat dimuat</h1>
        <p className="error">{err instanceof Error ? err.message : "Terjadi kesalahan."}</p>
      </div>
    );
  }
  if (!data) notFound();

  return (
    <div className="wrap">
      <header className="page-head">
        <p className="crumb">
          <Link href="/">HOME</Link> / <Link href={`/liga/${data.slug}`}>{data.leagueName}</Link> / Log prediksi
        </p>
        <p className="kicker">LOG &lt;GO&gt;</p>
        <h1>Log prediksi {data.leagueName}</h1>
        <p className="meta">
          Diperbarui {data.fetchedAtWib}. <Link href="/log">Lihat semua liga</Link>. Estimasi statistik, bukan saran taruhan.
        </p>
      </header>
      <PredictionLogTable data={data} />
    </div>
  );
}

export default function LeagueLogPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton lines={8} />}>
      <LeagueLogPageInner params={params} />
    </Suspense>
  );
}
