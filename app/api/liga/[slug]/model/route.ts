import { NextResponse } from "next/server";
import { buildLeagueModel, loadLeague } from "@/lib/data";
import { getLeague } from "@/lib/leagues";

export const revalidate = 300;
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const league = getLeague(slug);
  if (!league) return NextResponse.json({ error: "Liga tidak ditemukan" }, { status: 404 });
  try {
    const page = await loadLeague(slug);
    const model = page?.model ?? (await buildLeagueModel(slug, page?.upcoming ?? [], league.espnSeason));
    return NextResponse.json({
      slug,
      leagueName: league.name,
      fetchedAtWib: page?.fetchedAtWib,
      model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat model";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
