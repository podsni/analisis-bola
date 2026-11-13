import type { LeagueDef } from "./leagues";
import type {
  HeadToHeadMatch,
  MatchEvent,
  MatchSummary,
  Scorer,
  SeasonAggregate,
  StandingRow,
  TeamAnalysis,
  TeamFormItem,
  TeamInfo,
  TeamMatchStats,
  TeamSplit,
} from "./types";
import { displayScore, formatDateWib, formatTimeWib, toNum } from "./format";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const REVALIDATE = 300;

export function espnCrest(teamId?: string, logo?: string): string | undefined {
  if (logo) return logo;
  if (!teamId) return undefined;
  return `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`;
}

function teamLogo(team: { id?: string; logos?: { href?: string }[]; logo?: string } | undefined, fallbackId?: string): string | undefined {
  const id = team?.id || fallbackId;
  const href = team?.logos?.[0]?.href || team?.logo;
  return espnCrest(id, href);
}

export async function espnFetch(url: string, revalidate: number | false = REVALIDATE): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
    },
    ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
  });
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} untuk ${url}`);
  }
  return res.json();
}

function statValue(stats: unknown, keys: string[]): number {
  if (!Array.isArray(stats)) return 0;
  for (const key of keys) {
    const found = stats.find((s) => {
      if (!s || typeof s !== "object") return false;
      const o = s as { name?: string; abbreviation?: string };
      return o.name === key || o.abbreviation === key;
    }) as { value?: unknown; displayValue?: unknown } | undefined;
    if (found) {
      if (typeof found.value === "number") return found.value;
      return toNum(found.displayValue);
    }
  }
  return 0;
}

export async function fetchEspnStandings(league: LeagueDef): Promise<StandingRow[]> {
  const slug = league.espnSlug!;
  const data = (await espnFetch(
    `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`
  )) as Record<string, unknown>;

  const children = Array.isArray(data.children) ? data.children : [data];
  const rows: StandingRow[] = [];
  for (const child of children) {
    const standings = (child as { standings?: { entries?: unknown[] } })?.standings;
    const entries = standings?.entries ?? [];
    for (const entry of entries) {
      const e = entry as {
        team?: { id?: string; displayName?: string; name?: string; logos?: { href?: string }[] };
        stats?: unknown;
        note?: { description?: string };
      };
      const team = e.team ?? {};
      const stats = e.stats;
      const played = statValue(stats, ["gamesPlayed", "GP"]);
      const gf = statValue(stats, ["pointsFor", "F", "goalsFor"]);
      const ga = statValue(stats, ["pointsAgainst", "A", "goalsAgainst"]);
      rows.push({
        rank: statValue(stats, ["rank", "R"]),
        teamId: String(team.id ?? ""),
        team: team.displayName || team.name || "Tidak diketahui",
        logo: team.logos?.[0]?.href,
        played,
        won: statValue(stats, ["wins", "W"]),
        drawn: statValue(stats, ["ties", "D", "draws"]),
        lost: statValue(stats, ["losses", "L"]),
        gf,
        ga,
        gd: statValue(stats, ["pointDifferential", "GD", "differential"]) || gf - ga,
        points: statValue(stats, ["points", "PTS"]),
        note: e.note?.description,
      });
    }
  }
  rows.sort((a, b) => a.rank - b.rank || b.points - a.points);
  return rows;
}

type EspnEvent = Record<string, unknown>;

function eventStatus(ev: EspnEvent): MatchSummary["status"] {
  const comps = ev.competitions as Array<{ status?: { type?: { state?: string; completed?: boolean; name?: string } } }> | undefined;
  const state = comps?.[0]?.status?.type?.state ?? (ev.status as { type?: { state?: string } } | undefined)?.type?.state;
  if (state === "post") return "post";
  if (state === "in") return "in";
  if (state === "pre") return "pre";
  const completed = comps?.[0]?.status?.type?.completed;
  if (completed) return "post";
  return "unknown";
}

function translateEventType(raw: string, flags: { scoring?: boolean; yellow?: boolean; red?: boolean; own?: boolean; penalty?: boolean }): string {
  const n = raw.toLowerCase();
  if (flags.own || n.includes("own goal")) return "Gol bunuh diri";
  if (flags.penalty || n.includes("penalty")) return flags.scoring ? "Gol penalti" : "Tendangan penalti";
  if (flags.scoring || n === "goal" || n.includes("goal")) return "Gol";
  if (flags.red || n.includes("red")) return "Kartu merah";
  if (flags.yellow || n.includes("yellow")) return "Kartu kuning";
  if (n.includes("substitut")) return "Pergantian";
  return raw || "Peristiwa";
}

function mapDetails(details: unknown, homeId: string, awayId: string, homeName: string, awayName: string): MatchEvent[] {
  if (!Array.isArray(details)) return [];
  const out: MatchEvent[] = [];
  for (const d of details) {
    if (!d || typeof d !== "object") continue;
    const o = d as {
      type?: { text?: string };
      clock?: { displayValue?: string };
      team?: { id?: string; displayName?: string };
      scoringPlay?: boolean;
      redCard?: boolean;
      yellowCard?: boolean;
      ownGoal?: boolean;
      penaltyKick?: boolean;
      athletesInvolved?: Array<{ displayName?: string; shortName?: string }>;
      text?: string;
    };
    const rawType = o.type?.text ?? "";
    const flags = {
      scoring: !!o.scoringPlay,
      yellow: !!o.yellowCard,
      red: !!o.redCard,
      own: !!o.ownGoal,
      penalty: !!o.penaltyKick,
    };
    const interesting = flags.scoring || flags.yellow || flags.red || flags.own || flags.penalty ||
      /goal|card|penalty|red|yellow/i.test(rawType);
    if (!interesting) continue;
    const teamId = o.team?.id ? String(o.team.id) : undefined;
    const team = o.team?.displayName || (teamId === homeId ? homeName : teamId === awayId ? awayName : undefined);
    const player = o.athletesInvolved?.[0]?.displayName || o.athletesInvolved?.[0]?.shortName;
    const minute = o.clock?.displayValue || "";
    const typ = translateEventType(rawType, flags);
    out.push({
      minute,
      type: typ,
      player,
      teamId,
      team,
      scoring: flags.scoring || typ.startsWith("Gol"),
      text: [minute, typ, player, team ? `(${team})` : ""].filter(Boolean).join(" "),
    });
  }
  return out;
}

function mapEvent(ev: EspnEvent): MatchSummary | null {
  const comps = ev.competitions as Array<{
    competitors?: Array<Record<string, unknown>>;
    venue?: { fullName?: string };
    status?: {
      type?: { state?: string; detail?: string; shortDetail?: string; description?: string };
      displayClock?: string;
      period?: number;
    };
    date?: string;
    details?: unknown;
  }> | undefined;
  const evStatus = ev.status as {
    type?: { state?: string; detail?: string; shortDetail?: string; description?: string };
    displayClock?: string;
    period?: number;
  } | undefined;
  const comp = comps?.[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  if (!home || !away) return null;
  const date = String(comp?.date || ev.date || "");
  if (!date) return null;
  const status = eventStatus(ev);
  const st = comp?.status ?? evStatus;
  const homeTeam = (home.team ?? {}) as { id?: string; displayName?: string; name?: string; shortDisplayName?: string; logos?: { href?: string }[]; logo?: string };
  const awayTeam = (away.team ?? {}) as { id?: string; displayName?: string; name?: string; shortDisplayName?: string; logos?: { href?: string }[]; logo?: string };
  const showScore = status === "post" || status === "in";
  const homeId = String(homeTeam.id ?? home.id ?? "");
  const awayId = String(awayTeam.id ?? away.id ?? "");
  const homeName = homeTeam.displayName || homeTeam.name || homeTeam.shortDisplayName || "Tuan rumah";
  const awayName = awayTeam.displayName || awayTeam.name || awayTeam.shortDisplayName || "Tamu";
  const seasonRaw = ev.season as { slug?: string; year?: number; displayName?: string } | undefined;
  const seasonMatch = seasonRaw?.slug?.match(/(\d{4}-\d{2})/);
  const seasonLabel = seasonMatch?.[1] || seasonRaw?.displayName;
  return {
    id: String(ev.id ?? ""),
    dateUtc: date,
    dateWib: formatDateWib(date),
    timeWib: formatTimeWib(date),
    timeValid: true,
    status,
    clock: st?.displayClock || st?.type?.shortDetail || null,
    period: st?.period,
    detail: st?.type?.shortDetail || st?.type?.detail || st?.type?.description,
    venue: comp?.venue?.fullName,
    season: seasonLabel,
    home: {
      id: homeId,
      name: homeName,
      score: showScore ? displayScore(home.score) : null,
      logo: teamLogo(homeTeam, homeId),
    },
    away: {
      id: awayId,
      name: awayName,
      score: showScore ? displayScore(away.score) : null,
      logo: teamLogo(awayTeam, awayId),
    },
    events: mapDetails(comp?.details, homeId, awayId, homeName, awayName),
  };
}

async function fetchScoreboard(slug: string, dates?: string, revalidate: number | false = REVALIDATE): Promise<{ events: MatchSummary[]; calendar: string[] }> {
  const isYear = !!(dates && /^\d{4}$/.test(dates));
  const limit = isYear ? 500 : 50;
  // Year-wide scoreboards often exceed Next's 2MB data cache; parse first, cache the slim events elsewhere.
  const rv: number | false = isYear ? false : revalidate;
  const url = dates
    ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dates}&limit=${limit}`
    : `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?limit=${limit}`;
  const data = (await espnFetch(url, rv)) as {
    events?: EspnEvent[];
    leagues?: Array<{ calendar?: string[] }>;
  };
  const events = (data.events ?? []).map(mapEvent).filter((e): e is MatchSummary => !!e);
  if (isYear) {
    for (const ev of events) ev.events = undefined;
  }
  const calendar = data.leagues?.[0]?.calendar ?? [];
  return { events, calendar };
}

function ymdUtc(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

export async function fetchEspnFixtures(league: LeagueDef): Promise<{
  recent: MatchSummary[];
  upcoming: MatchSummary[];
}> {
  const slug = league.espnSlug!;
  const first = await fetchScoreboard(slug);
  const cal = first.calendar.map((d) => (d.includes("T") ? ymdUtc(d) : d.replace(/-/g, "")));
  const today = ymdUtc(new Date().toISOString());

  const pastDates = cal.filter((d) => d < today).sort().slice(-8);
  const futureDates = cal.filter((d) => d >= today).sort().slice(0, 12);
  const needed = Array.from(new Set([...pastDates, ...futureDates]));

  const all: MatchSummary[] = [...first.events];
  const seen = new Set(all.map((e) => e.id));

  // Fetch remaining dates in small batches to stay polite.
  const chunk = 4;
  for (let i = 0; i < needed.length; i += chunk) {
    const batch = needed.slice(i, i + chunk);
    const parts = await Promise.all(
      batch.map(async (d) => {
        try {
          return (await fetchScoreboard(slug, d)).events;
        } catch {
          return [] as MatchSummary[];
        }
      })
    );
    for (const ev of parts.flat()) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        ev.events = undefined;
      all.push(ev);
      }
    }
  }

  all.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  const recent = all.filter((e) => e.status === "post").slice(-16).reverse();
  const upcomingSorted = all
    .filter((e) => e.status === "pre" || e.status === "in")
    .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc))
    .slice(0, 16);

  return { recent, upcoming: upcomingSorted };
}

function httpsRef(url: string): string {
  return url.replace(/^http:\/\//, "https://");
}

async function resolveRef(url: string): Promise<string> {
  try {
    const data = (await espnFetch(httpsRef(url))) as {
      displayName?: string;
      name?: string;
      fullName?: string;
      shortName?: string;
    };
    return data.displayName || data.fullName || data.name || data.shortName || "";
  } catch {
    return "";
  }
}

export async function fetchEspnScorers(league: LeagueDef): Promise<{ scorers: Scorer[]; note?: string }> {
  const slug = league.espnSlug!;
  const year = league.espnSeason ?? "2026";
  try {
    const data = (await espnFetch(
      `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/seasons/${year}/types/1/leaders`
    )) as {
      categories?: Array<{
        name?: string;
        abbreviation?: string;
        displayName?: string;
        leaders?: Array<{
          value?: number;
          displayValue?: string;
          athlete?: { $ref?: string };
          team?: { $ref?: string };
          rel?: string[];
        }>;
      }>;
    };
    const cat =
      data.categories?.find((c) => {
        const n = `${c.name ?? ""} ${c.abbreviation ?? ""} ${c.displayName ?? ""}`.toLowerCase();
        return n.includes("scorer") || n.includes("goal") || n === "goals" || n.includes("pencetak");
      }) ?? data.categories?.[0];
    if (!cat?.leaders?.length) {
      return { scorers: [], note: "Daftar pencetak gol belum tersedia di sumber ini." };
    }
    const top = cat.leaders.slice(0, 10);
    const scorers: Scorer[] = [];
    for (let i = 0; i < top.length; i++) {
      const L = top[i];
      const [player, team] = await Promise.all([
        L.athlete?.$ref ? resolveRef(L.athlete.$ref) : Promise.resolve(""),
        L.team?.$ref ? resolveRef(L.team.$ref) : Promise.resolve(""),
      ]);
      const teamId = L.team?.$ref?.match(/teams\/(\d+)/)?.[1];
      const matches = L.displayValue?.match(/Matches:\s*(\d+)/i)?.[1];
      scorers.push({
        rank: i + 1,
        player: player || "Tidak diketahui",
        team: team || "Tidak diketahui",
        teamId,
        goals: typeof L.value === "number" ? L.value : toNum(L.displayValue),
        matches,
      });
    }
    return { scorers };
  } catch {
    return { scorers: [], note: "Daftar pencetak gol tidak dapat dimuat saat ini." };
  }
}

function emptySplit(): TeamSplit {
  return { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gfAvg: null, gaAvg: null };
}

function finalizeSplit(s: TeamSplit): TeamSplit {
  if (s.played > 0) {
    s.gfAvg = s.gf / s.played;
    s.gaAvg = s.ga / s.played;
  }
  return s;
}

function addResult(s: TeamSplit, scored: number, conceded: number) {
  s.played += 1;
  s.gf += scored;
  s.ga += conceded;
  if (scored > conceded) s.won += 1;
  else if (scored === conceded) s.drawn += 1;
  else s.lost += 1;
}

export function analyzeSchedule(
  teamId: string,
  teamName: string,
  events: MatchSummary[]
): TeamAnalysis {
  const finished = events
    .filter((e) => e.status === "post" && e.home.score != null && e.away.score != null)
    .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));

  const overall = emptySplit();
  const home = emptySplit();
  const away = emptySplit();
  const formItems: TeamFormItem[] = [];

  for (const ev of finished) {
    const isHome = ev.home.id === teamId;
    const scored = toNum(isHome ? ev.home.score : ev.away.score);
    const conceded = toNum(isHome ? ev.away.score : ev.home.score);
    const result: TeamFormItem["result"] = scored > conceded ? "W" : scored === conceded ? "D" : "L";
    const item: TeamFormItem = {
      id: ev.id,
      dateWib: ev.dateWib,
      opponent: isHome ? ev.away.name : ev.home.name,
      homeAway: isHome ? "home" : "away",
      scored,
      conceded,
      result,
    };
    formItems.push(item);
    addResult(overall, scored, conceded);
    addResult(isHome ? home : away, scored, conceded);
  }

  return {
    id: teamId,
    name: teamName,
    lastFive: formItems.slice(-5),
    overall: finalizeSplit(overall),
    home: finalizeSplit(home),
    away: finalizeSplit(away),
    sampleNote:
      finished.length < 3
        ? "Sampel pertandingan selesai masih kecil, jadi rata-rata bisa berubah cepat."
        : finished.length <= 10
          ? `Analisis memakai ${finished.length} pertandingan selesai yang tersedia dari jadwal tim di ESPN.`
          : undefined,
  };
}

export async function fetchTeamSchedule(league: LeagueDef, teamId: string, season?: string): Promise<MatchSummary[]> {
  const slug = league.espnSlug!;
  const url = season
    ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${teamId}/schedule?season=${season}`
    : `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${teamId}/schedule`;
  const data = (await espnFetch(url)) as {
    events?: EspnEvent[];
    season?: { year?: number; displayName?: string };
    requestedSeason?: { year?: number; displayName?: string };
  };
  const label = data.requestedSeason?.displayName || data.season?.displayName || season;
  return (data.events ?? [])
    .map(mapEvent)
    .filter((e): e is MatchSummary => !!e)
    .map((e) => ({ ...e, season: label }));
}

export async function fetchEspnEvent(league: LeagueDef, eventId: string): Promise<MatchSummary | null> {
  const slug = league.espnSlug!;
  try {
    const data = (await espnFetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`
    )) as { header?: { competitions?: EspnEvent[]; id?: string }; boxscore?: unknown };
    // summary often nests under header
    const header = data.header as
      | {
          id?: string;
          competitions?: Array<Record<string, unknown>>;
          season?: unknown;
        }
      | undefined;
    if (header?.competitions?.[0]) {
      const ev: EspnEvent = {
        id: header.id ?? eventId,
        date: header.competitions[0].date,
        competitions: header.competitions,
        status: (header.competitions[0] as { status?: unknown }).status,
      };
      return mapEvent(ev);
    }
  } catch {
    // fall through
  }
  const { recent, upcoming } = await fetchEspnFixtures(league);
  return [...recent, ...upcoming].find((e) => e.id === eventId) ?? null;
}

export function headToHead(homeId: string, homeEvents: MatchSummary[], awayId: string): TeamFormItem[] {
  return homeEvents
    .filter((e) => {
      if (e.status !== "post") return false;
      const ids = [e.home.id, e.away.id];
      return ids.includes(homeId) && ids.includes(awayId);
    })
    .sort((a, b) => b.dateUtc.localeCompare(a.dateUtc))
    .map((e) => {
      const isHome = e.home.id === homeId;
      const scored = toNum(isHome ? e.home.score : e.away.score);
      const conceded = toNum(isHome ? e.away.score : e.home.score);
      return {
        id: e.id,
        dateWib: e.dateWib,
        dateUtc: e.dateUtc,
        season: e.season,
        opponent: isHome ? e.away.name : e.home.name,
        homeAway: isHome ? "home" as const : "away" as const,
        scored,
        conceded,
        result: (scored > conceded ? "W" : scored === conceded ? "D" : "L") as "W" | "D" | "L",
        homeName: e.home.name,
        awayName: e.away.name,
        homeLogo: e.home.logo,
        awayLogo: e.away.logo,
      } as HeadToHeadMatch;
    });
}


export async function fetchLiveScoreboard(league: LeagueDef): Promise<MatchSummary[]> {
  const slug = league.espnSlug!;
  const { events } = await fetchScoreboard(slug, undefined, false);
  return events;
}

export async function fetchLeagueHistory(league: LeagueDef): Promise<MatchSummary[]> {
  const slug = league.espnSlug!;
  const year = Number(league.espnSeason ?? "2026");
  const years = [year, year - 1, year - 2].map(String);
  const parts = await Promise.all(
    years.map(async (y) => {
      try {
        return (await fetchScoreboard(slug, y)).events;
      } catch {
        return [] as MatchSummary[];
      }
    })
  );
  const seen = new Set<string>();
  const all: MatchSummary[] = [];
  for (const list of parts) {
    for (const ev of list) {
      if (!ev.id || seen.has(ev.id)) continue;
      seen.add(ev.id);
      all.push(ev);
    }
  }
  all.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  return all;
}


export function leagueGfAverage(standings: StandingRow[]): number | null {
  const gp = standings.reduce((s, r) => s + r.played, 0);
  const gf = standings.reduce((s, r) => s + r.gf, 0);
  if (gp <= 0) return null;
  return gf / gp;
}

export async function fetchEspnTeam(league: LeagueDef, teamId: string): Promise<TeamInfo | null> {
  const slug = league.espnSlug!;
  try {
    const data = (await espnFetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${teamId}`
    )) as {
      team?: {
        id?: string;
        displayName?: string;
        name?: string;
        color?: string;
        alternateColor?: string;
        logos?: { href?: string }[];
        standingSummary?: string;
        record?: { items?: Array<{ summary?: string }> };
      };
    };
    const t = data.team;
    if (!t?.id) return null;
    const color = t.color ? (t.color.startsWith("#") ? t.color : `#${t.color}`) : undefined;
    const alternateColor = t.alternateColor
      ? t.alternateColor.startsWith("#")
        ? t.alternateColor
        : `#${t.alternateColor}`
      : undefined;
    return {
      id: String(t.id),
      name: t.displayName || t.name || "Tim",
      logo: teamLogo(t, String(t.id)),
      color,
      alternateColor,
      recordSummary: t.record?.items?.[0]?.summary,
      standingSummary: t.standingSummary,
    };
  } catch {
    return null;
  }
}

function boxStat(stats: unknown, names: string[]): number | undefined {
  if (!Array.isArray(stats)) return undefined;
  for (const name of names) {
    const found = stats.find((s) => s && typeof s === "object" && (s as { name?: string }).name === name) as
      | { value?: unknown; displayValue?: unknown }
      | undefined;
    if (found) {
      const n = typeof found.value === "number" ? found.value : toNum(found.displayValue);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function parseTeamStats(
  block: { team?: { id?: string; displayName?: string }; statistics?: unknown; homeAway?: string },
  fallbackId: string,
  fallbackName: string
): TeamMatchStats {
  const stats = block.statistics;
  const possession = boxStat(stats, ["possessionPct"]);
  const passPctRaw = boxStat(stats, ["passPct"]);
  const xg = boxStat(stats, ["expectedGoals"]);
  return {
    teamId: String(block.team?.id ?? fallbackId),
    team: block.team?.displayName || fallbackName,
    shots: boxStat(stats, ["totalShots"]),
    shotsOnTarget: boxStat(stats, ["shotsOnTarget"]),
    possession: possession != null && possession <= 1 && possession > 0 ? Math.round(possession * 100) : possession,
    yellow: boxStat(stats, ["yellowCards"]),
    red: boxStat(stats, ["redCards"]),
    corners: boxStat(stats, ["wonCorners"]),
    passes: boxStat(stats, ["totalPasses"]),
    passPct: passPctRaw != null && passPctRaw <= 1 ? Math.round(passPctRaw * 100) : passPctRaw,
    fouls: boxStat(stats, ["foulsCommitted"]),
    offsides: boxStat(stats, ["offsides"]),
    saves: boxStat(stats, ["saves"]),
    expectedGoals: xg ?? null,
  };
}

function mapKeyEvents(raw: unknown, homeId: string, awayId: string, homeName: string, awayName: string): MatchEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: MatchEvent[] = [];
  for (const ev of raw) {
    if (!ev || typeof ev !== "object") continue;
    const o = ev as {
      type?: { text?: string; type?: string };
      clock?: { displayValue?: string };
      team?: { id?: string; displayName?: string };
      scoringPlay?: boolean;
      text?: string;
      shortText?: string;
      participants?: Array<{ athlete?: { displayName?: string } }>;
    };
    const rawType = o.type?.text || o.type?.type || "";
    const flags = {
      scoring: !!o.scoringPlay,
      yellow: /yellow/i.test(rawType),
      red: /red/i.test(rawType) && !/yellow/i.test(rawType),
      own: /own/i.test(rawType),
      penalty: /penalty/i.test(rawType),
    };
    const interesting =
      flags.scoring ||
      flags.yellow ||
      flags.red ||
      flags.own ||
      flags.penalty ||
      /goal|card|penalty|red|yellow/i.test(rawType);
    if (!interesting) continue;
    const teamId = o.team?.id ? String(o.team.id) : undefined;
    const team = o.team?.displayName || (teamId === homeId ? homeName : teamId === awayId ? awayName : undefined);
    const player = o.participants?.[0]?.athlete?.displayName;
    const typ = translateEventType(rawType, flags);
    const minute = o.clock?.displayValue || "";
    out.push({
      minute,
      type: typ,
      player,
      teamId,
      team,
      scoring: flags.scoring || typ.startsWith("Gol"),
      text: o.shortText || o.text || [minute, typ, player, team ? `(${team})` : ""].filter(Boolean).join(" "),
    });
  }
  return out;
}

function mapSeriesEvent(ev: Record<string, unknown>, perspectiveId: string): HeadToHeadMatch | null {
  const mapped = mapEvent(ev as EspnEvent);
  if (!mapped || mapped.status !== "post") {
    // series events sometimes use team.logo and score as string, status as string
    const comps = ev.competitions as Array<Record<string, unknown>> | undefined;
    const competitors = (comps?.[0]?.competitors || ev.competitors) as Array<Record<string, unknown>> | undefined;
    if (!competitors || competitors.length < 2) return null;
    const date = String((comps?.[0]?.date as string) || ev.date || "");
    if (!date) return null;
    const homeC = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
    const awayC = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
    const ht = (homeC.team ?? {}) as { id?: string; displayName?: string; logo?: string; logos?: { href?: string }[] };
    const at = (awayC.team ?? {}) as { id?: string; displayName?: string; logo?: string; logos?: { href?: string }[] };
    const homeId = String(ht.id ?? "");
    const awayId = String(at.id ?? "");
    const statusRaw = ev.statusType as { state?: string } | undefined;
    const state = statusRaw?.state || (typeof ev.status === "string" ? ev.status : undefined);
    if (state && state !== "post") return null;
    const homeScore = displayScore(homeC.score);
    const awayScore = displayScore(awayC.score);
    if (homeScore == null || awayScore == null) return null;
    const isHome = homeId === perspectiveId;
    const scored = toNum(isHome ? homeScore : awayScore);
    const conceded = toNum(isHome ? awayScore : homeScore);
    return {
      id: String(ev.id ?? ""),
      dateWib: formatDateWib(date),
      dateUtc: date,
      opponent: isHome ? at.displayName || "Lawan" : ht.displayName || "Lawan",
      homeAway: isHome ? "home" : "away",
      scored,
      conceded,
      result: scored > conceded ? "W" : scored === conceded ? "D" : "L",
      homeName: ht.displayName,
      awayName: at.displayName,
      homeLogo: teamLogo(ht, homeId),
      awayLogo: teamLogo(at, awayId),
    };
  }
  const isHome = mapped.home.id === perspectiveId;
  const scored = toNum(isHome ? mapped.home.score : mapped.away.score);
  const conceded = toNum(isHome ? mapped.away.score : mapped.home.score);
  return {
    id: mapped.id,
    dateWib: mapped.dateWib,
    dateUtc: mapped.dateUtc,
    season: mapped.season,
    opponent: isHome ? mapped.away.name : mapped.home.name,
    homeAway: isHome ? "home" : "away",
    scored,
    conceded,
    result: scored > conceded ? "W" : scored === conceded ? "D" : "L",
    homeName: mapped.home.name,
    awayName: mapped.away.name,
    homeLogo: mapped.home.logo,
    awayLogo: mapped.away.logo,
  };
}

export async function fetchEspnSummary(
  league: LeagueDef,
  eventId: string
): Promise<{
  match: MatchSummary | null;
  stats: { home: TeamMatchStats; away: TeamMatchStats } | null;
  events: MatchEvent[];
  series: HeadToHeadMatch[];
  seriesSummary?: string;
}> {
  const slug = league.espnSlug!;
  const empty = { match: null as MatchSummary | null, stats: null, events: [] as MatchEvent[], series: [] as HeadToHeadMatch[] };
  try {
    const data = (await espnFetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`
    )) as Record<string, unknown>;
    const header = data.header as { id?: string; competitions?: Array<Record<string, unknown>> } | undefined;
    let match: MatchSummary | null = null;
    if (header?.competitions?.[0]) {
      match = mapEvent({
        id: header.id ?? eventId,
        date: header.competitions[0].date,
        competitions: header.competitions,
        status: header.competitions[0].status,
      });
    }
    if (!match) return empty;

    const box = data.boxscore as { teams?: Array<{ team?: { id?: string; displayName?: string }; statistics?: unknown; homeAway?: string }> } | undefined;
    let stats: { home: TeamMatchStats; away: TeamMatchStats } | null = null;
    if (box?.teams && box.teams.length >= 2) {
      const homeB = box.teams.find((t) => t.homeAway === "home") ?? box.teams[0];
      const awayB = box.teams.find((t) => t.homeAway === "away") ?? box.teams[1];
      stats = {
        home: parseTeamStats(homeB, match.home.id, match.home.name),
        away: parseTeamStats(awayB, match.away.id, match.away.name),
      };
    }

    const keyEvents = mapKeyEvents(data.keyEvents, match.home.id, match.away.id, match.home.name, match.away.name);
    const events = keyEvents.length ? keyEvents : match.events ?? [];
    match = { ...match, events };

    const seriesBlocks = Array.isArray(data.seasonseries) ? (data.seasonseries as Array<Record<string, unknown>>) : [];
    const h2hBlock = seriesBlocks.find((b) => String(b.type) === "head-to-head") ?? seriesBlocks[0];
    const series: HeadToHeadMatch[] = [];
    if (h2hBlock && Array.isArray(h2hBlock.events)) {
      for (const ev of h2hBlock.events as Array<Record<string, unknown>>) {
        const item = mapSeriesEvent(ev, match.home.id);
        if (item) series.push(item);
      }
    }
    return {
      match,
      stats,
      events,
      series,
      seriesSummary: typeof h2hBlock?.summary === "string" ? h2hBlock.summary : undefined,
    };
  } catch {
    return empty;
  }
}

export function seasonAggregate(teamId: string, events: MatchSummary[]): SeasonAggregate {
  const analysis = analyzeSchedule(teamId, "", events);
  const finished = events
    .filter((e) => e.status === "post" && e.home.score != null && e.away.score != null)
    .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));

  let cleanSheets = 0;
  let failedToScore = 0;
  let biggestWin: TeamFormItem | undefined;
  let biggestLoss: TeamFormItem | undefined;
  let points = 0;
  const pointsProgression: SeasonAggregate["pointsProgression"] = [];
  const goalsTrend: SeasonAggregate["goalsTrend"] = [];

  for (const ev of finished) {
    const isHome = ev.home.id === teamId;
    const scored = toNum(isHome ? ev.home.score : ev.away.score);
    const conceded = toNum(isHome ? ev.away.score : ev.home.score);
    const opponent = isHome ? ev.away.name : ev.home.name;
    const result: TeamFormItem["result"] = scored > conceded ? "W" : scored === conceded ? "D" : "L";
    const item: TeamFormItem = {
      id: ev.id,
      dateWib: ev.dateWib,
      opponent,
      homeAway: isHome ? "home" : "away",
      scored,
      conceded,
      result,
    };
    if (conceded === 0) cleanSheets += 1;
    if (scored === 0) failedToScore += 1;
    const diff = scored - conceded;
    if (diff > 0 && (!biggestWin || diff > biggestWin.scored - biggestWin.conceded)) biggestWin = item;
    if (diff < 0 && (!biggestLoss || diff < biggestLoss.scored - biggestLoss.conceded)) biggestLoss = item;
    points += result === "W" ? 3 : result === "D" ? 1 : 0;
    pointsProgression.push({ dateWib: ev.dateWib, points, label: opponent });
    goalsTrend.push({ dateWib: ev.dateWib, gf: scored, ga: conceded, opponent });
  }

  return {
    overall: analysis.overall,
    home: analysis.home,
    away: analysis.away,
    lastFive: analysis.lastFive,
    cleanSheets,
    failedToScore,
    biggestWin,
    biggestLoss,
    pointsProgression,
    goalsTrend,
  };
}
