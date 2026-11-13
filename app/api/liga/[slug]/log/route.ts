import { NextResponse } from "next/server";
import { loadPredictionLog } from "@/lib/data";

export const revalidate = 300;
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const data = await loadPredictionLog(slug);
    if (!data) return NextResponse.json({ error: "Liga tidak ditemukan" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat log prediksi";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
