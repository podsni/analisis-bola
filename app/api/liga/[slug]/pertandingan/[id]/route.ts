import { NextResponse } from "next/server";
import { loadMatch } from "@/lib/data";

export const revalidate = 300;
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
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
