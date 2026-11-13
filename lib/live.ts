import type { MatchSummary } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** True when a match is in play, about to start, or just finished and still settling. */
export function isFreshWindow(match: Pick<MatchSummary, "status" | "dateUtc">, now = Date.now()): boolean {
  if (match.status === "in") return true;
  const kick = Date.parse(match.dateUtc);
  if (!Number.isFinite(kick)) return false;
  if (now >= kick - 20 * MINUTE && now <= kick + 3 * HOUR) {
    return match.status !== "post" || now <= kick + 3 * HOUR;
  }
  return false;
}

export function isLiveOrImminent(match: Pick<MatchSummary, "status" | "dateUtc">, now = Date.now()): boolean {
  if (match.status === "in") return true;
  const kick = Date.parse(match.dateUtc);
  if (!Number.isFinite(kick)) return false;
  return now >= kick - 20 * MINUTE && now <= kick + 3 * HOUR && match.status !== "post";
}

export function livePollSeconds(hasLive: boolean, hasImminent = false): number {
  if (hasLive || hasImminent) return 10;
  return 60;
}
