export type LeagueDef = {
  slug: string;
  name: string;
  country: string;
  seasonName: string;
  source: "espn" | "sportsdb";
  espnSlug?: string;
  espnSeason?: string;
  sportsDbLeagueId?: string;
  sportsDbSeason?: string;
};

export const LEAGUES: LeagueDef[] = [
  {
    slug: "premier-league",
    name: "Premier League",
    country: "Inggris",
    seasonName: "2026/27",
    source: "espn",
    espnSlug: "eng.1",
    espnSeason: "2026",
  },
  {
    slug: "la-liga",
    name: "La Liga",
    country: "Spanyol",
    seasonName: "2026/27",
    source: "espn",
    espnSlug: "esp.1",
    espnSeason: "2026",
  },
  {
    slug: "serie-a",
    name: "Serie A",
    country: "Italia",
    seasonName: "2026/27",
    source: "espn",
    espnSlug: "ita.1",
    espnSeason: "2026",
  },
  {
    slug: "liga-super-indonesia",
    name: "Liga Super Indonesia",
    country: "Indonesia",
    seasonName: "2026/27",
    source: "sportsdb",
    espnSlug: "idn.1",
    sportsDbLeagueId: "4790",
    sportsDbSeason: "2026-2027",
  },
];

export function getLeague(slug: string): LeagueDef | undefined {
  return LEAGUES.find((l) => l.slug === slug);
}
