import { NextResponse } from "next/server";
import { loadAllPredictionLogs } from "@/lib/data";

export const revalidate = 300;
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const data = await loadAllPredictionLogs();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat log prediksi";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
