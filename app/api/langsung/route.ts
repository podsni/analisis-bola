import { NextResponse } from "next/server";
import { loadLive } from "@/lib/data";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await loadLive();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat data langsung";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
