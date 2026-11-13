import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PredictionLogTable } from "@/components/PredictionLogTable";
import { PageSkeleton } from "@/components/Skeleton";
import { loadAllPredictionLogs } from "@/lib/data";

export const metadata: Metadata = { title: "Log prediksi" };
export const revalidate = 300;
export const maxDuration = 60;

async function AllLogsInner() {
  let data;
  try {
    data = await loadAllPredictionLogs();
  } catch (err) {
    return (
      <div className="wrap page-head">
        <h1>Log prediksi tidak dapat dimuat</h1>
        <p className="error">{err instanceof Error ? err.message : "Terjadi kesalahan."}</p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="page-head">
        <p className="crumb">
          <Link href="/">HOME</Link> / Log prediksi
        </p>
        <p className="kicker">LOG &lt;GO&gt;</p>
        <h1>Log prediksi semua liga</h1>
        <p className="meta">
          Premier League, La Liga, dan Serie A. Diperbarui {data.fetchedAtWib}. Estimasi statistik, bukan saran taruhan.
        </p>
        <p className="log-league-links">
          {data.leagues.map((l) => (
            <Link key={l.slug} href={`/liga/${l.slug}/log`} className="bb-fn">
              {(l.slug === "premier-league" ? "EPL" : l.slug === "la-liga" ? "LAL" : "SEA") + " LOG <GO>"}
            </Link>
          ))}
        </p>
      </header>
      <PredictionLogTable data={data.combined} showLeague />
    </div>
  );
}

export default function AllLogsPage() {
  return (
    <Suspense fallback={<PageSkeleton lines={8} />}>
      <AllLogsInner />
    </Suspense>
  );
}
