import { NextResponse } from "next/server";
import { loadMatch } from "@/lib/data";
import { isFreshWindow } from "@/lib/live";

export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  try {
    const data = await loadMatch(slug, id);
    if (!data) return NextResponse.json({ error: "Pertandingan tidak ditemukan" }, { status: 404 });
    const fresh = isFreshWindow(data.match);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": fresh ? "no-store, max-age=0" : "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
