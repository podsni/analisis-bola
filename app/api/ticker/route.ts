import { NextResponse } from "next/server";
import { loadTicker } from "@/lib/data";

export const revalidate = 20;
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await loadTicker();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat ticker";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
