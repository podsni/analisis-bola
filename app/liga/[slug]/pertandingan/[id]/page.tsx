import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MatchAnalysisView } from "@/components/MatchAnalysisView";
import { loadMatch } from "@/lib/data";
import { getLeague } from "@/lib/leagues";

export const revalidate = 30;
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
  return <MatchAnalysisView initial={data} />;
}
