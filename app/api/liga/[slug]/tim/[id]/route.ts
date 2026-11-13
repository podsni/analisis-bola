import { NextResponse } from "next/server";
import { loadTeam } from "@/lib/data";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  try {
    const data = await loadTeam(slug, id);
    if (!data) return NextResponse.json({ error: "Tim tidak ditemukan" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat data tim";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
