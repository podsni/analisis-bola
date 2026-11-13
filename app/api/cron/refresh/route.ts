import { NextResponse } from "next/server";
import { warmupCaches } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 60;
export const revalidate = 0;

export async function GET(req: Request) {
  const cron = req.headers.get("x-vercel-cron");
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cron) {
    if (secret && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    // Allow unauthenticated warmup after deploy so caches fill immediately.
    // If CRON_SECRET is set, require it (checked above).
  }
  try {
    const result = await warmupCaches();
    return NextResponse.json({ ok: result.ok, ms: result.ms, notes: result.notes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memanaskan cache";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
