import { getLeague, type LeagueDef } from "./leagues";
import {
  analyzeSchedule,
  espnCrest,
  fetchEspnEvent,
  fetchEspnFixtures,
  fetchEspnScorers,
  fetchEspnStandings,
  fetchEspnSummary,
  fetchEspnTeam,
  fetchLeagueHistory,
  fetchLiveScoreboard,
  fetchTeamSchedule,
  headToHead,
  leagueGfAverage,
  seasonAggregate,
} from "./espn";
import { formatDateWib, formatTimeWib, nowWibLabel, toNum } from "./format";
import { poissonEstimate, poissonFromStandings, remainingMinutesFromClock } from "./poisson";
import {
  applyInPlay,
  backtestCurrentSeason,
  buildPredictionLog,
  contributingMatches,
  decorateEstimate,
  emptyEstimate,
  fitModel,
  MODEL_METHOD,
  predictMatch,
  slimEstimate,
  toHistMatches,
} from "./dixoncoles";
import { cached } from "./cache";
import { isFreshWindow, isLiveOrImminent, livePollSeconds } from "./live";
import { attachEstimateExtras, buildRecommendation } from "./recommend";
import type {
  CommandTeam,
  HistMatch,
  LeagueModelPayload,
  MatchSummary,
  PoissonEstimate,
  PredictionLogPayload,
  TickerItem,
} from "./types";
import { cache } from "react";
import {
  buildIndonesiaMatch,
  fetchIndonesiaFixtures,
  fetchIndonesiaStandings,
} from "./sportsdb";
import { LEAGUES } from "./leagues";
import type {
  HeadToHeadMatch,
  LeaguePayload,
  LiveMatchCard,
  LivePayload,
  MatchAnalysisPayload,
  SeasonHistory,
  StandingRow,
  TeamPagePayload,
} from "./types";


const fetchHistoryInner = cached(
  async (slug: string): Promise<MatchSummary[]> => {
    const league = getLeague(slug);
    if (!league || league.source !== "espn" || !league.espnSlug) return [];
    return fetchLeagueHistory(league);
  },
  "history-v1",
  900,
  ["history"]
);

export const loadHistory = cache(async (slug: string): Promise<MatchSummary[]> => fetchHistoryInner(slug));

export function currentSeasonPrefix(espnSeason?: string): string {
  const y = Number(espnSeason ?? "2026");
  return `${y}-${String(y + 1).slice(-2)}`;
}

function formAndSpark(teamId: string, history: MatchSummary[]): { form: Array<"W" | "D" | "L">; spark: number[] } {
  const finished = history
    .filter((e) => e.status === "post" && (e.home.id === teamId || e.away.id === teamId))
    .sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  const form: Array<"W" | "D" | "L"> = [];
  const spark: number[] = [];
  let pts = 0;
  for (const e of finished) {
    const isHome = e.home.id === teamId;
    const scored = toNum(isHome ? e.home.score : e.away.score);
    const conceded = toNum(isHome ? e.away.score : e.home.score);
    const res: "W" | "D" | "L" = scored > conceded ? "W" : scored === conceded ? "D" : "L";
    pts += res === "W" ? 3 : res === "D" ? 1 : 0;
    spark.push(pts);
    form.push(res);
  }
  return { form: form.slice(-5), spark: spark.slice(-12) };
}

function annotateStandings(rows: StandingRow[], history: MatchSummary[]): StandingRow[] {
  if (!history.length) return rows;
  return rows.map((r) => {
    const { form, spark } = formAndSpark(r.teamId, history);
    return { ...r, form, spark };
  });
}

export async function buildLeagueModel(
  slug: string,
  upcoming: MatchSummary[] = [],
  espnSeason?: string
): Promise<LeagueModelPayload> {
  const events = await loadHistory(slug);
  const hist = toHistMatches(events);
  if (hist.length < 40) {
    return {
      available: false,
      reason: "Riwayat liga masih terlalu pendek untuk memasang model Dixon-Coles (butuh sekitar 40 laga selesai).",
      method: MODEL_METHOD,
    };
  }
  const model = fitModel(hist, new Date());
  if (!model) {
    return {
      available: false,
      reason: "Model tidak bisa dipasang dari riwayat yang tersedia.",
      method: MODEL_METHOD,
    };
  }
  const backtest = backtestCurrentSeason(hist, currentSeasonPrefix(espnSeason));
  const upcomingEst = upcoming
    .filter((m) => m.status === "pre" || m.status === "in")
    .map((m) => ({
      matchId: m.id,
      estimate: slimEstimate(predictMatch(model, m.home.id, m.away.id, { mode: m.status === "in" ? "in" : "pre" })),
    }));
  const strengths = Object.values(model.teams)
    .filter((s) => s.matches >= 8)
    .sort((a, b) => b.attack / Math.max(0.3, b.defense) - a.attack / Math.max(0.3, a.defense));
  return {
    available: true,
    homeAdvantage: model.homeAdvantage,
    mu: model.mu,
    rho: model.rho,
    samples: model.samples,
    halfLifeDays: model.halfLifeDays,
    asOfWib: nowWibLabel(),
    method: model.method,
    backtest,
    upcoming: upcomingEst,
    strengths,
  };
}

function estimatesMap(model: LeagueModelPayload | undefined): Record<string, PoissonEstimate> {
  const out: Record<string, PoissonEstimate> = {};
  for (const item of model?.upcoming ?? []) out[item.matchId] = slimEstimate(item.estimate);
  return out;
}

function estimateFromLogRow(r: import("./types").PredictionLogRow): PoissonEstimate {
  return {
    available: true,
    lambdaHome: 0,
    lambdaAway: 0,
    pHome: r.pHome,
    pDraw: r.pDraw,
    pAway: r.pAway,
    method: "Dixon-Coles",
    mode: r.status === "post" ? "post" : "pre",
    pick: r.oneXtwoPick,
    predScore: r.predScore,
    oneXtwoHasil: r.oneXtwoHasil,
    scoreHasil: r.scoreHasil,
  };
}

async function mergeLeagueEstimates(
  slug: string,
  fixtures: { recent: MatchSummary[]; upcoming: MatchSummary[] },
  base: Record<string, PoissonEstimate>
): Promise<Record<string, PoissonEstimate>> {
  const out = { ...base };
  try {
    const log = await loadPredictionLog(slug);
    if (log?.available) {
      for (const r of log.rows) {
        out[r.id] = estimateFromLogRow(r);
      }
    }
  } catch {
    // log may still be warming
  }
  return out;
}

async function loadLeagueUncached(slug: string): Promise<LeaguePayload | null> {
  const league = getLeague(slug);
  if (!league) return null;
  const fetchedAtWib = nowWibLabel();

  if (league.source === "sportsdb") {
    const [table, fixtures] = await Promise.all([
      fetchIndonesiaStandings(league),
      fetchIndonesiaFixtures(),
    ]);
    return {
      slug: league.slug,
      name: league.name,
      country: league.country,
      seasonName: league.seasonName,
      source: "TheSportsDB (kunci gratis 123)",
      sourceNote: "ESPN hanya punya klasemen final 2025/26 untuk liga ini, jadi musim 2026/27 memakai TheSportsDB.",
      fetchedAtWib,
      limited: true,
      limitedNote: `${table.limitedNote} ${fixtures.note}`,
      standings: table.standings,
      recent: fixtures.recent,
      upcoming: fixtures.upcoming,
      scorers: [],
      scorersNote: "Daftar pencetak gol Liga Super Indonesia tidak tersedia di kunci gratis TheSportsDB.",
    };
  }

  const [standings, fixtures, scorers] = await Promise.all([
    fetchEspnStandings(league),
    fetchEspnFixtures(league),
    fetchEspnScorers(league),
  ]);

  const history = await loadHistory(league.slug);
  const model = await buildLeagueModel(league.slug, fixtures.upcoming, league.espnSeason);
  return {
    slug: league.slug,
    name: league.name,
    country: league.country,
    seasonName: league.seasonName,
    source: `ESPN site API (tidak resmi, liga ${league.espnSlug})`,
    fetchedAtWib,
    standings: annotateStandings(standings, history),
    recent: fixtures.recent,
    upcoming: fixtures.upcoming,
    scorers: scorers.scorers,
    scorersNote: scorers.note,
    model,
    estimates: await mergeLeagueEstimates(league.slug, fixtures, estimatesMap(model)),
  };
}

async function loadMatchUncached(slug: string, eventId: string, fresh = false): Promise<MatchAnalysisPayload | null> {
  const league = getLeague(slug);
  if (!league) return null;
  const fetchedAtWib = nowWibLabel();

  if (league.source === "sportsdb") {
    const [table, fixtures] = await Promise.all([
      fetchIndonesiaStandings(league),
      fetchIndonesiaFixtures(),
    ]);
    const built = await buildIndonesiaMatch(eventId, table.standings, fixtures);
    if (!built.match || !built.home || !built.away) return null;
    const leagueAvg =
      table.standings.length > 0
        ? table.standings.reduce((s, r) => s + r.gf, 0) / table.standings.reduce((s, r) => s + r.played, 0)
        : null;
    const estimate = attachEstimateExtras(poissonEstimate(built.home, built.away, leagueAvg));
    const headToHead = { matches: built.h2h, note: built.note };
    return {
      slug: league.slug,
      leagueName: league.name,
      source: "TheSportsDB (kunci gratis 123)",
      fetchedAtWib,
      match: built.match,
      home: built.home,
      away: built.away,
      headToHead,
      estimate,
      scorers: { home: [], away: [] },
      limitedNote: built.note,
      recommendation: buildRecommendation(built.match, estimate, built.home, built.away, headToHead),
    };
  }

  const year = Number(league.espnSeason ?? "2026");
  const prevYears = [String(year - 1), String(year - 2)];

  const [summary, standings, scorers] = await Promise.all([
    fetchEspnSummary(league, eventId, { fresh }),
    fetchEspnStandings(league),
    fetchEspnScorers(league),
  ]);
  const found = summary.match ?? (await fetchEspnEvent(league, eventId));
  if (!found) return null;
  let match = found;

  const homeId = match.home.id;
  const awayId = match.away.id;
  const schedules = await Promise.all([
    fetchTeamSchedule(league, homeId),
    fetchTeamSchedule(league, awayId),
    ...prevYears.flatMap((y) => [
      fetchTeamSchedule(league, homeId, y).catch(() => []),
      fetchTeamSchedule(league, awayId, y).catch(() => []),
    ]),
  ]);
  const homeEvents = schedules[0];
  const awayEvents = schedules[1];
  const historic = schedules.slice(2).flat();

  const home = analyzeSchedule(match.home.id, match.home.name, homeEvents);
  const away = analyzeSchedule(match.away.id, match.away.name, awayEvents);
  const fromSchedules = headToHead(match.home.id, [...homeEvents, ...awayEvents, ...historic], match.away.id);
  const merged: HeadToHeadMatch[] = [];
  const seen = new Set<string>();
  for (const m of [...summary.series, ...fromSchedules]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    merged.push(m);
  }
  merged.sort((a, b) => (b.dateUtc || b.dateWib).localeCompare(a.dateUtc || a.dateWib));

  const leagueAvg = leagueGfAverage(standings);
  const homeScorers = scorers.scorers.filter(
    (s) => s.teamId === match.home.id || s.team.toLowerCase() === match.home.name.toLowerCase()
  );
  const awayScorers = scorers.scorers.filter(
    (s) => s.teamId === match.away.id || s.team.toLowerCase() === match.away.name.toLowerCase()
  );

  if (!match.home.logo) match = { ...match, home: { ...match.home, logo: espnCrest(match.home.id) } };
  if (!match.away.logo) match = { ...match, away: { ...match.away, logo: espnCrest(match.away.id) } };
  if (summary.events.length) match = { ...match, events: summary.events };

  const acrossSeasons = merged.some((m) => m.season && m.season !== homeEvents[0]?.season);
  let estimate = await estimateForEspnMatch(league.slug, match, league.espnSeason, home, away, leagueAvg);
  if (estimate?.available) {
    estimate = decorateEstimate(
      estimate,
      match.status === "post" ? toNum(match.home.score) : null,
      match.status === "post" ? toNum(match.away.score) : null
    );
  }
  estimate = attachEstimateExtras(estimate);
  const hist = toHistMatches(await loadHistory(league.slug).catch(() => []));
  const asOf = new Date(match.dateUtc);
  const headToHeadData = {
    matches: merged,
    summary: summary.seriesSummary,
    note:
      merged.length === 0
        ? "Tidak ada pertemuan di jadwal musim ini maupun dua musim sebelumnya yang tersedia."
        : acrossSeasons || summary.series.length
          ? "Head-to-head merangkum pertemuan yang ada di ringkasan ESPN dan jadwal dua musim sebelumnya, jika sumbernya menyediakan."
          : "Hanya pertemuan yang ada di jadwal tim ESPN.",
  };
  return {
    slug: league.slug,
    leagueName: league.name,
    source: `ESPN site API (tidak resmi, liga ${league.espnSlug})`,
    fetchedAtWib,
    match,
    home,
    away,
    headToHead: headToHeadData,
    estimate,
    scorers: { home: homeScorers, away: awayScorers },
    matchStats: summary.stats ?? undefined,
    contributions: hist.length
      ? {
          home: {
            teamId: match.home.id,
            teamName: match.home.name,
            matches: contributingMatches(hist, match.home.id, match.home.name, asOf, 8),
          },
          away: {
            teamId: match.away.id,
            teamName: match.away.name,
            matches: contributingMatches(hist, match.away.id, match.away.name, asOf, 8),
          },
          asOfWib: `${formatDateWib(match.dateUtc)}${match.timeValid && match.timeWib ? " " + match.timeWib + " WIB" : ""}`,
          note: "Delapan laga terakhir tiap tim yang masuk ke model sebelum kickoff, dengan bobot peluruhan waktu (paruh hidup 180 hari). Laga di jendela bentuk enam pertandingan terakhir bertanda bonus. Ini bahan baku estimasi, bukan saran taruhan.",
        }
      : undefined,
    lineups: summary.lineups,
    recommendation: buildRecommendation(match, estimate, home, away, headToHeadData),
  };
}

async function estimateForEspnMatch(
  slug: string,
  match: MatchSummary,
  espnSeason: string | undefined,
  home: import("./types").TeamAnalysis,
  away: import("./types").TeamAnalysis,
  leagueAvg: number | null
): Promise<PoissonEstimate> {
  try {
    const hist = toHistMatches(await loadHistory(slug));
    const kickoff = new Date(match.dateUtc);
    const model = fitModel(hist, kickoff);
    if (model) {
      const pre = predictMatch(model, match.home.id, match.away.id, { mode: "pre" });
      if (match.status === "in") {
        const remaining = remainingMinutesFromClock({
          status: match.status,
          clock: match.clock,
          period: match.period,
          detail: match.detail,
        });
        return applyInPlay(pre, toNum(match.home.score), toNum(match.away.score), remaining, "in");
      }
      if (match.status === "post") {
        return applyInPlay(pre, toNum(match.home.score), toNum(match.away.score), 0, "post");
      }
      return pre;
    }
  } catch {
    // fall through to the simpler Poisson
  }
  return poissonEstimate(home, away, leagueAvg);
}

export function requireLeague(slug: string): LeagueDef {
  const league = getLeague(slug);
  if (!league) throw new Error("Liga tidak ditemukan");
  return league;
}


function cardFromMatch(
  slug: string,
  leagueName: string,
  match: import("./types").MatchSummary,
  standings: StandingRow[],
  leagueAvg: number | null,
  modelFit?: ReturnType<typeof fitModel>
): LiveMatchCard {
  const home = standings.find((s) => s.teamId === match.home.id);
  const away = standings.find((s) => s.teamId === match.away.id);
  const pre = modelFit
    ? predictMatch(modelFit, match.home.id, match.away.id, { mode: "pre" })
    : poissonFromStandings(home, away, leagueAvg);
  const remaining = remainingMinutesFromClock({
    status: match.status,
    clock: match.clock,
    period: match.period,
    detail: match.detail,
  });
  const estimate =
    match.status === "in" || match.status === "post"
      ? applyInPlay(pre, toNum(match.home.score), toNum(match.away.score), remaining, match.status)
      : pre;
  return { slug, leagueName, match, estimate };
}

async function loadLiveUncached(): Promise<LivePayload> {
  const fetchedAtWib = nowWibLabel();
  const fetchedAtMs = Date.now();
  const espnLeagues = LEAGUES.filter((l) => l.source === "espn");
  const liveCards: LiveMatchCard[] = [];
  const upcomingCards: LiveMatchCard[] = [];

  const chunks = await Promise.all(
    espnLeagues.map(async (league) => {
      const [standings, liveBoard, fixtures] = await Promise.all([
        fetchEspnStandings(league).catch(() => [] as StandingRow[]),
        fetchLiveScoreboard(league).catch(() => [] as import("./types").MatchSummary[]),
        fetchEspnFixtures(league).catch(() => ({ recent: [], upcoming: [] })),
      ]);
      const avg = leagueGfAverage(standings);
      const hist = toHistMatches(await loadHistory(league.slug).catch(() => []));
      const modelFit = hist.length >= 40 ? fitModel(hist, new Date()) : null;
      return { league, standings, liveBoard, fixtures, avg, modelFit };
    })
  );

  for (const { league, standings, liveBoard, fixtures, avg, modelFit } of chunks) {
    for (const m of liveBoard.filter((e) => e.status === "in")) {
      liveCards.push(cardFromMatch(league.slug, league.name, m, standings, avg, modelFit));
    }
    const seen = new Set(liveCards.map((c) => c.match.id));
    for (const m of fixtures.upcoming.filter((e) => e.status === "pre")) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      upcomingCards.push(cardFromMatch(league.slug, league.name, m, standings, avg, modelFit));
    }
  }

  try {
    const idn = LEAGUES.find((l) => l.slug === "liga-super-indonesia");
    if (idn) {
      const [table, fixtures] = await Promise.all([
        fetchIndonesiaStandings(idn),
        fetchIndonesiaFixtures(),
      ]);
      const gp = table.standings.reduce((s, r) => s + r.played, 0);
      const gf = table.standings.reduce((s, r) => s + r.gf, 0);
      const avg = gp > 0 ? gf / gp : null;
      for (const m of fixtures.upcoming.filter((e) => e.status === "pre" || e.status === "in")) {
        if (m.status === "in") {
          liveCards.push(cardFromMatch(idn.slug, idn.name, m, table.standings, avg));
        } else {
          upcomingCards.push(cardFromMatch(idn.slug, idn.name, m, table.standings, avg));
        }
      }
    }
  } catch {
    // Indonesia feed is optional on the live page.
  }

  liveCards.sort((a, b) => a.match.dateUtc.localeCompare(b.match.dateUtc));
  upcomingCards.sort((a, b) => a.match.dateUtc.localeCompare(b.match.dateUtc));

  let note: string | undefined;
  if (liveCards.length === 0) {
    note =
      "Tidak ada pertandingan yang sedang berlangsung di sumber data saat ini. Liga Eropa sedang jeda internasional pertengahan November 2026. Di bawah ini hitung mundur kickoff berikutnya plus estimasi pra-laga.";
  }

  return {
    fetchedAtWib,
    fetchedAtMs,
    pollSeconds: livePollSeconds(
      liveCards.length > 0,
      upcomingCards.some((c) => isLiveOrImminent(c.match))
    ),
    live: liveCards,
    upcoming: upcomingCards.slice(0, 12),
    note,
  };
}

function historyFromEvents(year: string, label: string, teamId: string, events: import("./types").MatchSummary[]): SeasonHistory {
  const matches = [...events].sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  return { year, label, matches, analysis: seasonAggregate(teamId, matches) };
}

async function loadTeamUncached(slug: string, teamId: string): Promise<TeamPagePayload | null> {
  const league = getLeague(slug);
  if (!league) return null;
  const fetchedAtWib = nowWibLabel();

  if (league.source === "sportsdb") {
    const [table, fixtures] = await Promise.all([
      fetchIndonesiaStandings(league),
      fetchIndonesiaFixtures(),
    ]);
    const row = table.standings.find((s) => s.teamId === teamId);
    const all = [...fixtures.recent, ...fixtures.upcoming].filter(
      (e) => e.home.id === teamId || e.away.id === teamId
    );
    if (!row && all.length === 0) return null;
    const teamName =
      row?.team ||
      (all[0]?.home.id === teamId ? all[0]?.home.name : all[0]?.away.name) ||
      "Tim";
    const current = historyFromEvents(league.seasonName, `Musim ${league.seasonName}`, teamId, all);
    return {
      slug: league.slug,
      leagueName: league.name,
      source: "TheSportsDB (kunci gratis 123)",
      fetchedAtWib,
      team: { id: teamId, name: teamName, logo: row?.logo },
      current,
      previous: [],
      limitedNote:
        "Riwayat Liga Super Indonesia di kunci gratis TheSportsDB sangat terbatas: hanya jadwal/hasil yang tampil di umpan liga, dan klasemen hanya lima besar. Musim lalu tidak tersedia di sini.",
    };
  }

  const year = Number(league.espnSeason ?? "2026");
  const prevYears = [year - 1, year - 2].map(String);
  const [profile, currentEvents, ...prevSchedules] = await Promise.all([
    fetchEspnTeam(league, teamId),
    fetchTeamSchedule(league, teamId),
    ...prevYears.map((y) => fetchTeamSchedule(league, teamId, y).catch(() => [])),
  ]);
  if (!profile && currentEvents.length === 0 && prevSchedules.every((s) => s.length === 0)) {
    return null;
  }
  const name =
    profile?.name ||
    (currentEvents[0]?.home.id === teamId ? currentEvents[0]?.home.name : currentEvents[0]?.away.name) ||
    "Tim";
  const currentLabel = currentEvents[0]?.season || `Musim ${year}`;
  const current = historyFromEvents(String(year), currentLabel, teamId, currentEvents);
  const previous: SeasonHistory[] = prevSchedules
    .map((events, i) => {
      if (!events.length) return null;
      const label = events[0]?.season || `Musim ${prevYears[i]}`;
      return historyFromEvents(prevYears[i], label, teamId, events);
    })
    .filter((s): s is SeasonHistory => !!s);

  return {
    slug: league.slug,
    leagueName: league.name,
    source: `ESPN site API (tidak resmi, liga ${league.espnSlug})`,
    fetchedAtWib,
    team: profile ?? {
      id: teamId,
      name: name || "Tim",
      logo: espnCrest(teamId),
    },
    current,
    previous,
  };
}

function tickerText(m: MatchSummary, leagueName: string): string {
  const t = m.timeValid && m.timeWib ? `${m.timeWib} WIB` : "";
  if (m.status === "post") {
    return `${leagueName} · ${m.home.name} ${m.home.score ?? "–"}–${m.away.score ?? "–"} ${m.away.name} · ${m.dateWib}`;
  }
  if (m.status === "in") {
    return `LIVE ${leagueName} · ${m.home.name} ${m.home.score ?? "–"}–${m.away.score ?? "–"} ${m.away.name} ${m.clock || ""}`;
  }
  return `${leagueName} · ${m.home.name} vs ${m.away.name} · ${m.dateWib}${t ? " " + t : ""}`;
}

async function loadTickerUncached(): Promise<{ fetchedAtWib: string; items: TickerItem[] }> {
  const items: TickerItem[] = [];
  await Promise.all(
    LEAGUES.map(async (league) => {
      try {
        if (league.source === "espn") {
          const fixtures = await fetchEspnFixtures(league);
          const live = await fetchLiveScoreboard(league).catch(() => [] as MatchSummary[]);
          for (const m of [...live.filter((e) => e.status === "in"), ...fixtures.recent.slice(0, 8), ...fixtures.upcoming.slice(0, 8)]) {
            items.push({
              slug: league.slug,
              league: league.name,
              matchId: m.id,
              text: tickerText(m, league.name),
              status: m.status,
              dateUtc: m.dateUtc,
            });
          }
        } else {
          const fixtures = await fetchIndonesiaFixtures();
          for (const m of [...fixtures.recent, ...fixtures.upcoming]) {
            items.push({
              slug: league.slug,
              league: league.name,
              matchId: m.id,
              text: tickerText(m, league.name),
              status: m.status,
              dateUtc: m.dateUtc,
            });
          }
        }
      } catch {
        // skip a league that fails
      }
    })
  );
  const seen = new Set<string>();
  const unique: TickerItem[] = [];
  for (const it of items) {
    if (seen.has(it.matchId)) continue;
    seen.add(it.matchId);
    unique.push(it);
  }
  unique.sort((a, b) => {
    const rank = (s: TickerItem["status"]) => (s === "in" ? 0 : s === "pre" ? 1 : 2);
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return a.dateUtc.localeCompare(b.dateUtc);
  });
  return { fetchedAtWib: nowWibLabel(), items: unique.slice(0, 40) };
}

const TEAM_CODES: Record<string, string[]> = {
  "359": ["ARS", "ARSENAL"],
  "382": ["MCI", "CITY", "MANCITY"],
  "360": ["MUN", "UNITED", "MANUTD"],
  "364": ["LIV", "LIVERPOOL"],
  "367": ["CHE", "CHELSEA"],
  "363": ["TOT", "SPURS"],
  "371": ["NEW", "NUFC"],
  "368": ["ARSENAL"],
  "375": ["EVE", "EVERTON"],
  "384": ["CRY", "PALACE"],
  "380": ["WHU", "WESTHAM"],
  "376": ["BHA", "BRIGHTON"],
  "347": ["AVL", "VILLA"],
  "383": ["WOL", "WOLVES"],
  "379": ["FUL", "FULHAM"],
  "331": ["NFO", "FOREST", "NOTTINGHAM"],
};

function codesFor(id: string, name: string): string[] {
  const extra = TEAM_CODES[id] ?? [];
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/);
  const initials = words.map((w) => w[0]).join("");
  const compact = words.join("");
  const set = new Set<string>([...extra, initials, compact, name.toUpperCase(), id]);
  return [...set].filter(Boolean);
}

async function loadCommandIndexUncached(): Promise<{ teams: CommandTeam[] }> {
  const teams: CommandTeam[] = [];
  await Promise.all(
    LEAGUES.map(async (league) => {
      try {
        if (league.source === "espn") {
          const standings = await fetchEspnStandings(league);
          for (const r of standings) {
            teams.push({
              id: r.teamId,
              name: r.team,
              slug: league.slug,
              league: league.name,
              logo: r.logo,
              codes: codesFor(r.teamId, r.team),
            });
          }
        } else {
          const table = await fetchIndonesiaStandings(league);
          for (const r of table.standings) {
            teams.push({
              id: r.teamId,
              name: r.team,
              slug: league.slug,
              league: league.name,
              logo: r.logo,
              codes: codesFor(r.teamId, r.team),
            });
          }
        }
      } catch {
        // skip
      }
    })
  );
  return { teams };
}

export type HomeLeaguePanel = {
  slug: string;
  name: string;
  country: string;
  seasonName: string;
  source: string;
  limited?: boolean;
  standings: StandingRow[];
  recent: MatchSummary[];
  upcoming: MatchSummary[];
  estimates: Record<string, PoissonEstimate>;
  modelNote?: string;
  homeAdvantage?: number;
  samples?: number;
};

async function loadHomeMonitorUncached(): Promise<{ fetchedAtWib: string; leagues: HomeLeaguePanel[] }> {
  const leagues = await Promise.all(
    LEAGUES.map(async (league) => {
      try {
        if (league.source === "sportsdb") {
          const [table, fixtures] = await Promise.all([
            fetchIndonesiaStandings(league),
            fetchIndonesiaFixtures(),
          ]);
          return {
            slug: league.slug,
            name: league.name,
            country: league.country,
            seasonName: league.seasonName,
            source: "TheSportsDB",
            limited: true,
            standings: table.standings,
            recent: fixtures.recent,
            upcoming: fixtures.upcoming,
            estimates: {},
            modelNote: "Model historis belum dipasang karena umpan Liga Super Indonesia sangat terbatas.",
          } satisfies HomeLeaguePanel;
        }
        const [standings, fixtures, history] = await Promise.all([
          fetchEspnStandings(league),
          fetchEspnFixtures(league),
          loadHistory(league.slug),
        ]);
        const hist = toHistMatches(history);
        const modelFit = hist.length >= 40 ? fitModel(hist, new Date()) : null;
        const estimates: Record<string, PoissonEstimate> = {};
        if (modelFit) {
          for (const m of [...fixtures.upcoming, ...fixtures.recent]) {
            const est = slimEstimate(predictMatch(modelFit, m.home.id, m.away.id));
            estimates[m.id] =
              m.status === "post"
                ? decorateEstimate(est, toNum(m.home.score), toNum(m.away.score))
                : est;
          }
        }
        return {
          slug: league.slug,
          name: league.name,
          country: league.country,
          seasonName: league.seasonName,
          source: `ESPN ${league.espnSlug}`,
          standings: annotateStandings(standings, history),
          recent: fixtures.recent,
          upcoming: fixtures.upcoming,
          estimates,
          homeAdvantage: modelFit?.homeAdvantage,
          samples: modelFit?.samples,
        } satisfies HomeLeaguePanel;
      } catch (err) {
        return {
          slug: league.slug,
          name: league.name,
          country: league.country,
          seasonName: league.seasonName,
          source: league.source,
          standings: [],
          recent: [],
          upcoming: [],
          estimates: {},
          modelNote: err instanceof Error ? err.message : "Data liga tidak dapat dimuat.",
        } satisfies HomeLeaguePanel;
      }
    })
  );
  return { fetchedAtWib: nowWibLabel(), leagues };
}

function asHistStub(m: MatchSummary): HistMatch {
  return {
    id: m.id,
    dateUtc: m.dateUtc,
    dateWib: m.dateWib,
    season: m.season,
    homeId: m.home.id,
    awayId: m.away.id,
    homeName: m.home.name,
    awayName: m.away.name,
    homeGoals: 0,
    awayGoals: 0,
  };
}

async function loadPredictionLogUncached(slug: string): Promise<PredictionLogPayload | null> {
  const league = getLeague(slug);
  if (!league) return null;
  const fetchedAtWib = nowWibLabel();
  if (league.source !== "espn") {
    return {
      available: false,
      reason:
        "Log prediksi Liga Super Indonesia belum bisa disusun karena umpan TheSportsDB terlalu terbatas untuk model historis.",
      slug: league.slug,
      leagueName: league.name,
      fetchedAtWib,
      method: MODEL_METHOD,
      summary: { n: 0, tepat: 0, meleset: 0, accuracy: 0, waiting: 0, byLine: [], calibration: [] },
      rows: [],
    };
  }
  const [historyEvents, fixtures] = await Promise.all([
    loadHistory(slug),
    fetchEspnFixtures(league).catch(() => ({ recent: [], upcoming: [] as MatchSummary[] })),
  ]);
  const history = toHistMatches(historyEvents);
  const built = buildPredictionLog({
    history,
    upcoming: fixtures.upcoming.filter((m) => m.status === "pre").map(asHistStub),
    currentSeasonPrefix: currentSeasonPrefix(league.espnSeason),
    slug: league.slug,
    leagueName: league.name,
  });
  return {
    available: built.available,
    reason: built.reason,
    slug: league.slug,
    leagueName: league.name,
    fetchedAtWib,
    method: built.method,
    summary: built.summary,
    rows: built.rows,
  };
}

async function loadAllPredictionLogsUncached(): Promise<{
  fetchedAtWib: string;
  leagues: PredictionLogPayload[];
  combined: PredictionLogPayload;
}> {
  const espn = LEAGUES.filter((l) => l.source === "espn");
  const leagues = await Promise.all(
    espn.map(async (l) => {
      const log = await loadPredictionLog(l.slug);
      return (
        log ?? {
          available: false,
          reason: "Tidak dapat memuat log.",
          slug: l.slug,
          leagueName: l.name,
          fetchedAtWib: nowWibLabel(),
          method: MODEL_METHOD,
          summary: { n: 0, tepat: 0, meleset: 0, accuracy: 0, waiting: 0, byLine: [], calibration: [] },
          rows: [],
        }
      );
    })
  );
  const rows = leagues.flatMap((l) => l.rows);
  const finished = rows.filter((r) => r.hasil !== "MENUNGGU");
  const waiting = rows.filter((r) => r.hasil === "MENUNGGU");
  const byMap = new Map<string, { n: number; tepat: number }>();
  for (const r of finished) {
    const cur = byMap.get(r.totals.label) ?? { n: 0, tepat: 0 };
    cur.n += 1;
    if (r.hasil === "TEPAT") cur.tepat += 1;
    byMap.set(r.totals.label, cur);
  }
  const byLine = [...byMap.entries()]
    .map(([key, v]) => ({ key, n: v.n, tepat: v.tepat, accuracy: v.n ? v.tepat / v.n : 0 }))
    .sort((a, b) => b.n - a.n);
  const edges = [0, 0.5, 0.65, 0.75, 0.85, 1.0001];
  const calibration = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i];
    const to = edges[i + 1] === 1.0001 ? 1 : edges[i + 1];
    const inBin = finished.filter((r) => r.totals.p >= from && r.totals.p < (edges[i + 1] === 1.0001 ? 1.0001 : edges[i + 1]));
    if (!inBin.length) continue;
    calibration.push({
      from,
      to,
      count: inBin.length,
      avgPredicted: inBin.reduce((s, r) => s + r.totals.p, 0) / inBin.length,
      observed: inBin.filter((r) => r.hasil === "TEPAT").length / inBin.length,
    });
  }
  const tepat = finished.filter((r) => r.hasil === "TEPAT").length;
  const combined: PredictionLogPayload = {
    available: finished.length > 0 || waiting.length > 0,
    slug: "semua",
    leagueName: "Semua liga Eropa",
    fetchedAtWib: nowWibLabel(),
    method: leagues.find((l) => l.method)?.method || MODEL_METHOD,
    summary: {
      n: finished.length,
      tepat,
      meleset: finished.length - tepat,
      accuracy: finished.length ? tepat / finished.length : 0,
      waiting: waiting.length,
      byLine,
      calibration,
      oneXtwoTepat: finished.filter((r) => r.oneXtwoHasil === "TEPAT").length,
      oneXtwoAccuracy: finished.length ? finished.filter((r) => r.oneXtwoHasil === "TEPAT").length / finished.length : 0,
      scoreTepat: finished.filter((r) => r.scoreHasil === "TEPAT").length,
      scoreAccuracy: finished.length ? finished.filter((r) => r.scoreHasil === "TEPAT").length / finished.length : 0,
    },
    rows: [
      ...waiting.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc)),
      ...finished.sort((a, b) => b.dateUtc.localeCompare(a.dateUtc)),
    ],
  };
  return { fetchedAtWib: nowWibLabel(), leagues, combined };
}


const cachedPredictionLog = cached(loadPredictionLogUncached, "log-v3", 900, ["log"]);
const cachedAllLogs = cached(loadAllPredictionLogsUncached, "log-all-v3", 900, ["log"]);
const cachedLeague = cached(loadLeagueUncached, "league-v3", 900, ["league"]);
const cachedMatch = cached(loadMatchUncached, "match-v3", 600, ["match"]);
const cachedTeam = cached(loadTeamUncached, "team-v3", 900, ["team"]);
const cachedTicker = cached(loadTickerUncached, "ticker-v2", 20, ["ticker"]);
const cachedHome = cached(loadHomeMonitorUncached, "home-v3", 300, ["home"]);
const cachedLive = cached(loadLiveUncached, "live-v2", 10, ["live"]);
const cachedCommands = cached(loadCommandIndexUncached, "cmd-v1", 900, ["league"]);

export async function loadPredictionLog(slug: string) {
  return cachedPredictionLog(slug);
}
export async function loadAllPredictionLogs() {
  return cachedAllLogs();
}
export async function loadLeague(slug: string) {
  return cachedLeague(slug);
}
export async function loadMatch(slug: string, eventId: string) {
  const data = await cachedMatch(slug, eventId);
  if (data && isFreshWindow(data.match)) {
    return loadMatchUncached(slug, eventId, true);
  }
  return data;
}

export async function loadMatchLive(slug: string, eventId: string) {
  return loadMatchUncached(slug, eventId, true);
}

export async function loadTeam(slug: string, teamId: string) {
  return cachedTeam(slug, teamId);
}
export async function loadTicker() {
  return cachedTicker();
}
export async function loadHomeMonitor() {
  return cachedHome();
}
export async function loadLive() {
  return cachedLive();
}
export async function loadCommandIndex() {
  return cachedCommands();
}

/** Warm all expensive caches so the next visitor is served from cache. */
export async function warmupCaches(): Promise<{ ok: boolean; ms: number; notes: string[] }> {
  const t0 = Date.now();
  const notes: string[] = [];
  const espn = LEAGUES.filter((l) => l.source === "espn");
  for (const l of espn) {
    try {
      await loadHistory(l.slug);
      notes.push(`history:${l.slug}`);
    } catch (e) {
      notes.push(`history:${l.slug}:fail`);
    }
  }
  try {
    await loadAllPredictionLogs();
    notes.push("logs");
  } catch {
    notes.push("logs:fail");
  }
  try {
    await loadHomeMonitor();
    notes.push("home");
  } catch {
    notes.push("home:fail");
  }
  try {
    await loadTicker();
    notes.push("ticker");
  } catch {
    notes.push("ticker:fail");
  }
  for (const l of LEAGUES) {
    try {
      await loadLeague(l.slug);
      notes.push(`league:${l.slug}`);
    } catch {
      notes.push(`league:${l.slug}:fail`);
    }
  }
  try {
    await loadCommandIndex();
    notes.push("commands");
  } catch {
    notes.push("commands:fail");
  }
  try {
    await loadLive();
    notes.push("live");
  } catch {
    notes.push("live:fail");
  }
  return { ok: !notes.some((n) => n.endsWith(":fail")), ms: Date.now() - t0, notes };
}
