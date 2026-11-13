import type { PoissonEstimate, StandingRow, TeamAnalysis } from "./types";

/** Faktor keunggulan tuan rumah yang dipakai model. Nilai 1,15 dekat dengan rata-rata historis liga-liga Eropa. */
export const HOME_ADVANTAGE = 1.15;

const METHOD_BASE =
  "Model Poisson yang disempurnakan: kekuatan serang dan bertahan diukur terhadap rata-rata gol liga per tim per pertandingan. Perkiraan gol tuan rumah = rata-rata liga × kekuatan serang tuan rumah × kelemahan bela tamu × faktor kandang 1,15. Perkiraan gol tamu = rata-rata liga × kekuatan serang tamu × kelemahan bela tuan rumah. Peluang dihitung dari kombinasi skor 0–10 gol. Ini estimasi statistik untuk analisis, bukan saran taruhan dan tidak dijamin akurat.";

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poissonP(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

export function probabilitiesFromLambdas(
  lambdaHome: number,
  lambdaAway: number,
  currentHome = 0,
  currentAway = 0
): { pHome: number; pDraw: number; pAway: number } {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  const max = 10;
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const p = poissonP(i, Math.max(0, lambdaHome)) * poissonP(j, Math.max(0, lambdaAway));
      const h = currentHome + i;
      const a = currentAway + j;
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  const total = pHome + pDraw + pAway || 1;
  return { pHome: pHome / total, pDraw: pDraw / total, pAway: pAway / total };
}

function emptyUnavailable(reason: string, method: string): PoissonEstimate {
  return {
    available: false,
    reason,
    lambdaHome: 0,
    lambdaAway: 0,
    pHome: 0,
    pDraw: 0,
    pAway: 0,
    method,
    homeAdvantage: HOME_ADVANTAGE,
  };
}

function lambdasFromRates(
  homeGf: number,
  homeGa: number,
  awayGf: number,
  awayGa: number,
  leagueGfAvg: number
): { lambdaHome: number; lambdaAway: number } {
  const attackHome = homeGf / leagueGfAvg;
  const defenseAway = awayGa / leagueGfAvg;
  const attackAway = awayGf / leagueGfAvg;
  const defenseHome = homeGa / leagueGfAvg;
  return {
    lambdaHome: leagueGfAvg * attackHome * defenseAway * HOME_ADVANTAGE,
    lambdaAway: leagueGfAvg * attackAway * defenseHome,
  };
}

export function poissonEstimate(
  home: TeamAnalysis,
  away: TeamAnalysis,
  leagueGfAvg: number | null
): PoissonEstimate {
  const minGames = 3;
  if (home.overall.played < minGames || away.overall.played < minGames) {
    return emptyUnavailable(
      "Estimasi belum dihitung karena salah satu tim belum punya cukup pertandingan selesai (minimal tiga) di data yang tersedia.",
      METHOD_BASE
    );
  }
  if (!leagueGfAvg || leagueGfAvg <= 0) {
    return emptyUnavailable("Rata-rata gol liga tidak tersedia, jadi estimasi tidak dihitung.", METHOD_BASE);
  }

  const useSplit = home.home.played >= minGames && away.away.played >= minGames;
  const homeGf = (useSplit ? home.home.gfAvg : home.overall.gfAvg) ?? 0;
  const homeGa = (useSplit ? home.home.gaAvg : home.overall.gaAvg) ?? 0;
  const awayGf = (useSplit ? away.away.gfAvg : away.overall.gfAvg) ?? 0;
  const awayGa = (useSplit ? away.away.gaAvg : away.overall.gaAvg) ?? 0;

  const { lambdaHome, lambdaAway } = lambdasFromRates(homeGf, homeGa, awayGf, awayGa, leagueGfAvg);
  const probs = probabilitiesFromLambdas(lambdaHome, lambdaAway);
  return {
    available: true,
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100,
    ...probs,
    method: useSplit
      ? METHOD_BASE + " Perhitungan memakai rata-rata kandang tuan rumah dan rata-rata tandang tamu."
      : METHOD_BASE +
        " Karena data kandang atau tandang kurang dari tiga pertandingan, perhitungan memakai rata-rata keseluruhan musim, tetap dengan faktor kandang 1,15.",
    mode: "pre",
    homeAdvantage: HOME_ADVANTAGE,
  };
}

export function poissonFromStandings(
  home: StandingRow | undefined,
  away: StandingRow | undefined,
  leagueGfAvg: number | null
): PoissonEstimate {
  if (!home || !away || home.played < 3 || away.played < 3) {
    return emptyUnavailable(
      "Estimasi belum dihitung karena salah satu tim tidak ada di klasemen yang tersedia, atau belum punya minimal tiga pertandingan.",
      METHOD_BASE
    );
  }
  if (!leagueGfAvg || leagueGfAvg <= 0) {
    return emptyUnavailable("Rata-rata gol liga tidak tersedia, jadi estimasi tidak dihitung.", METHOD_BASE);
  }
  const { lambdaHome, lambdaAway } = lambdasFromRates(
    home.gf / home.played,
    home.ga / home.played,
    away.gf / away.played,
    away.ga / away.played,
    leagueGfAvg
  );
  const probs = probabilitiesFromLambdas(lambdaHome, lambdaAway);
  return {
    available: true,
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100,
    ...probs,
    method:
      METHOD_BASE +
      " Di halaman langsung, kekuatan tim dihitung dari baris klasemen (rata-rata keseluruhan musim), karena data itu bisa diperbarui cepat.",
    mode: "pre",
    homeAdvantage: HOME_ADVANTAGE,
  };
}

export function remainingMinutesFromClock(opts: {
  status: "pre" | "in" | "post" | "unknown";
  clock?: string | null;
  period?: number;
  detail?: string;
}): number {
  if (opts.status === "pre" || opts.status === "unknown") return 90;
  if (opts.status === "post") return 0;
  const blob = `${opts.detail ?? ""} ${opts.clock ?? ""}`.toUpperCase();
  if (/\bHT\b|HALF/.test(blob)) return 45;

  const plus = opts.clock?.match(/(\d+)\s*'\s*\+\s*'?\s*(\d+)/);
  const simple = opts.clock?.match(/(\d+)\s*'/);
  let minute = plus ? Number(plus[1]) : simple ? Number(simple[1]) : NaN;
  if (!Number.isFinite(minute) && opts.period === 1) minute = 20;
  if (!Number.isFinite(minute) && opts.period === 2) minute = 70;
  if (!Number.isFinite(minute)) return 45;

  if ((opts.period ?? 0) <= 1 && minute <= 45) {
    // Sisa babak pertama plus seluruh babak kedua.
    if (minute >= 45 || plus) return 45 + 2;
    return 45 - minute + 45;
  }
  if (minute >= 90 || (plus && Number(plus[1]) >= 90)) return 2;
  return Math.max(1, 90 - minute);
}

export function inPlayEstimate(
  preMatch: PoissonEstimate,
  homeScore: number,
  awayScore: number,
  remainingMinutes: number,
  status: "pre" | "in" | "post" | "unknown"
): PoissonEstimate {
  if (status === "post") {
    const pHome = homeScore > awayScore ? 1 : 0;
    const pDraw = homeScore === awayScore ? 1 : 0;
    const pAway = homeScore < awayScore ? 1 : 0;
    return {
      available: true,
      lambdaHome: 0,
      lambdaAway: 0,
      pHome,
      pDraw,
      pAway,
      method: "Pertandingan sudah selesai. Angka ini hasil akhir, bukan estimasi.",
      mode: "post",
      remainingMinutes: 0,
      currentHome: homeScore,
      currentAway: awayScore,
      homeAdvantage: HOME_ADVANTAGE,
    };
  }
  if (!preMatch.available) {
    return { ...preMatch, mode: status === "in" ? "in" : "pre", currentHome: homeScore, currentAway: awayScore, remainingMinutes };
  }
  const frac = Math.max(0, Math.min(1, remainingMinutes / 90));
  const lambdaHome = preMatch.lambdaHome * frac;
  const lambdaAway = preMatch.lambdaAway * frac;
  const probs = probabilitiesFromLambdas(lambdaHome, lambdaAway, homeScore, awayScore);
  return {
    available: true,
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100,
    ...probs,
    method:
      preMatch.method +
      ` Saat pertandingan berlangsung, perkiraan gol sisa dikali sisa waktu regulasi (${remainingMinutes.toFixed(0)} dari 90 menit), lalu ditambah skor berjalan. Perpanjangan waktu dihitung singkat (sekitar 2 menit) jika jam sudah 45+ atau 90+. Ini tetap estimasi statistik, bukan saran taruhan.`,
    mode: "in",
    remainingMinutes,
    currentHome: homeScore,
    currentAway: awayScore,
    homeAdvantage: HOME_ADVANTAGE,
  };
}
