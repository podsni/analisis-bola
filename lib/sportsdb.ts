import type { LeagueDef } from "./leagues";
import type { MatchSummary, StandingRow, TeamAnalysis, TeamFormItem, TeamSplit } from "./types";
import { formatDateWib, formatTimeWib, parseUtc, toNum } from "./format";

const BASE = "https://www.thesportsdb.com/api/v1/json/123";
const REVALIDATE = 300;

async function tsdbFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`TheSportsDB ${res.status} untuk ${path}`);
  return res.json();
}

function mapTsdbEvent(ev: Record<string, unknown>): MatchSummary | null {
  const id = String(ev.idEvent ?? "");
  const date = ev.dateEvent as string | undefined;
  const time = (ev.strTime as string | undefined) || (ev.strTimestamp as string | undefined);
  if (!id || !date) return null;

  let iso: string;
  let timeValid = false;
  if (typeof ev.strTimestamp === "string" && ev.strTimestamp.trim()) {
    iso = ev.strTimestamp.includes("T") || ev.strTimestamp.includes(" ")
      ? ev.strTimestamp
      : ev.strTimestamp;
    // TheSportsDB timestamps without Z are UTC.
    const d = parseUtc(ev.strTimestamp);
    iso = d.toISOString();
    timeValid = ev.strTimestamp.includes(":") || ev.strTimestamp.includes("T");
  } else if (date && time && time !== "00:00:00" && time !== "00:00") {
    iso = parseUtc(`${date} ${time}`).toISOString();
    timeValid = true;
  } else {
    iso = `${date}T00:00:00Z`;
    timeValid = false;
  }

  const homeScore = ev.intHomeScore;
  const awayScore = ev.intAwayScore;
  const finished = homeScore != null && homeScore !== "" && awayScore != null && awayScore !== "";
  return {
    id,
    dateUtc: iso,
    dateWib: formatDateWib(iso),
    timeWib: timeValid ? formatTimeWib(iso) : null,
    timeValid,
    status: finished ? "post" : "pre",
    venue: (ev.strVenue as string | undefined) || undefined,
    home: {
      id: String(ev.idHomeTeam ?? ev.strHomeTeam ?? ""),
      name: String(ev.strHomeTeam ?? "Tuan rumah"),
      score: finished ? String(homeScore) : null,
    },
    away: {
      id: String(ev.idAwayTeam ?? ev.strAwayTeam ?? ""),
      name: String(ev.strAwayTeam ?? "Tamu"),
      score: finished ? String(awayScore) : null,
    },
  };
}

export async function fetchIndonesiaStandings(league: LeagueDef): Promise<{
  standings: StandingRow[];
  limitedNote: string;
}> {
  const data = (await tsdbFetch(
    `/lookuptable.php?l=${league.sportsDbLeagueId}&s=${league.sportsDbSeason}`
  )) as { table?: Array<Record<string, unknown>> };
  const table = data.table ?? [];
  const standings: StandingRow[] = table.map((r, i) => ({
    rank: toNum(r.intRank) || i + 1,
    teamId: String(r.idTeam ?? ""),
    team: String(r.strTeam ?? "Tidak diketahui"),
    logo: typeof r.strBadge === "string" ? r.strBadge : undefined,
    played: toNum(r.intPlayed),
    won: toNum(r.intWin),
    drawn: toNum(r.intDraw),
    lost: toNum(r.intLoss),
    gf: toNum(r.intGoalsFor),
    ga: toNum(r.intGoalsAgainst),
    gd: toNum(r.intGoalDifference) || toNum(r.intGoalsFor) - toNum(r.intGoalsAgainst),
    points: toNum(r.intPoints),
  }));
  return {
    standings,
    limitedNote:
      standings.length > 0
        ? `Kunci gratis TheSportsDB hanya menampilkan ${standings.length} baris klasemen teratas, bukan klasemen penuh. Jangan anggap ini daftar lengkap Liga Super Indonesia.`
        : "Klasemen Liga Super Indonesia tidak tersedia dari sumber gratis saat ini.",
  };
}

export async function fetchIndonesiaFixtures(): Promise<{
  recent: MatchSummary[];
  upcoming: MatchSummary[];
  note: string;
}> {
  const [nextData, lastData] = await Promise.all([
    tsdbFetch(`/eventsnextleague.php?id=4790`) as Promise<{ events?: Array<Record<string, unknown>> | null }>,
    tsdbFetch(`/eventspastleague.php?id=4790`) as Promise<{ events?: Array<Record<string, unknown>> | null }>,
  ]);
  const upcoming = (nextData.events ?? []).map(mapTsdbEvent).filter((e): e is MatchSummary => !!e);
  const recent = (lastData.events ?? []).map(mapTsdbEvent).filter((e): e is MatchSummary => !!e);
  return {
    recent,
    upcoming,
    note: "Kunci gratis TheSportsDB hanya memberi satu jadwal berikutnya dan satu hasil terbaru untuk liga ini. Daftar ini tidak lengkap.",
  };
}

function emptySplit(): TeamSplit {
  return { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gfAvg: null, gaAvg: null };
}

function fromStanding(row: StandingRow, name: string, id: string): TeamAnalysis {
  const overall: TeamSplit = {
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    gf: row.gf,
    ga: row.ga,
    gfAvg: row.played > 0 ? row.gf / row.played : null,
    gaAvg: row.played > 0 ? row.ga / row.played : null,
  };
  return {
    id,
    name,
    lastFive: [],
    overall,
    home: emptySplit(),
    away: emptySplit(),
    sampleNote:
      "TheSportsDB gratis tidak memberi rincian form lima pertandingan atau rekor kandang/tandang. Angka di sini diambil dari baris klasemen (jika tim termasuk lima besar yang ditampilkan).",
  };
}

export async function buildIndonesiaMatch(
  eventId: string,
  standings: StandingRow[],
  fixtures: { recent: MatchSummary[]; upcoming: MatchSummary[] }
): Promise<{
  match: MatchSummary | null;
  home: TeamAnalysis | null;
  away: TeamAnalysis | null;
  h2h: TeamFormItem[];
  note: string;
}> {
  const all = [...fixtures.recent, ...fixtures.upcoming];
  let match = all.find((e) => e.id === eventId) ?? null;
  if (!match) {
    try {
      const data = (await tsdbFetch(`/lookupevent.php?id=${eventId}`)) as {
        events?: Array<Record<string, unknown>> | null;
      };
      match = (data.events ?? []).map(mapTsdbEvent).find(Boolean) ?? null;
    } catch {
      match = null;
    }
  }
  if (!match) {
    return {
      match: null,
      home: null,
      away: null,
      h2h: [],
      note: "Pertandingan ini tidak ditemukan di data TheSportsDB yang tersedia.",
    };
  }

  const findRow = (id: string, name: string) =>
    standings.find((s) => s.teamId === id || s.team.toLowerCase() === name.toLowerCase());

  const homeRow = findRow(match.home.id, match.home.name);
  const awayRow = findRow(match.away.id, match.away.name);

  return {
    match,
    home: homeRow
      ? fromStanding(homeRow, match.home.name, match.home.id)
      : {
          id: match.home.id,
          name: match.home.name,
          lastFive: [],
          overall: emptySplit(),
          home: emptySplit(),
          away: emptySplit(),
          sampleNote:
            "Tim ini tidak termasuk lima besar yang ditampilkan TheSportsDB, jadi rata-rata gol musim ini tidak tersedia.",
        },
    away: awayRow
      ? fromStanding(awayRow, match.away.name, match.away.id)
      : {
          id: match.away.id,
          name: match.away.name,
          lastFive: [],
          overall: emptySplit(),
          home: emptySplit(),
          away: emptySplit(),
          sampleNote:
            "Tim ini tidak termasuk lima besar yang ditampilkan TheSportsDB, jadi rata-rata gol musim ini tidak tersedia.",
        },
    h2h: [],
    note: "Head-to-head dan form lima pertandingan tidak tersedia dari kunci gratis TheSportsDB untuk liga ini.",
  };
}
