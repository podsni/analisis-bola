const WIB = "Asia/Jakarta";

export function nowWibLabel(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}.${get("minute")} WIB`;
}

export function formatDateWib(iso: string): string {
  const d = parseUtc(iso);
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}`;
}

export function formatTimeWib(iso: string): string {
  const d = parseUtc(iso);
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}.${get("minute")}`;
}

export function parseUtc(iso: string): Date {
  const trimmed = iso.trim();
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(trimmed)) return new Date(trimmed);
  // TheSportsDB returns UTC without a Z suffix.
  return new Date(trimmed.replace(" ", "T") + "Z");
}

export function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function displayScore(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v !== "") return v;
  if (typeof v === "object" && v !== null && "displayValue" in v) {
    const d = (v as { displayValue?: unknown }).displayValue;
    return typeof d === "string" || typeof d === "number" ? String(d) : null;
  }
  if (typeof v === "object" && v !== null && "value" in v) {
    const d = (v as { value?: unknown }).value;
    return typeof d === "number" || typeof d === "string" ? String(d) : null;
  }
  return null;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function avgLabel(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2).replace(".", ",");
}

export function formatCountdown(iso: string, now = new Date()): string {
  const ms = parseUtc(iso).getTime() - now.getTime();
  if (ms <= 0) return "segera kickoff";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}h ${pad(h)}j ${pad(m)}m ${pad(s)}d`;
  return `${pad(h)}j ${pad(m)}m ${pad(s)}d`;
}
