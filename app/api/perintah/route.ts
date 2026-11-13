import { NextResponse } from "next/server";
import { loadCommandIndex } from "@/lib/data";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await loadCommandIndex();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memuat indeks perintah";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
