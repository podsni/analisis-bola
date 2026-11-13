import { parseUtc, toNum } from "./format";
import type {
  BacktestResult,
  BacktestRow,
  CalibrationBin,
  FittedModel,
  HistMatch,
  LineBreakdown,
  MatchSummary,
  ModelContribution,
  PoissonEstimate,
  PredictionLogRow,
  PredictionLogSummary,
  ScoreCell,
  TeamStrength,
  TotalsPick,
} from "./types";

/** Paruh hidup peluruhan waktu: laga setahun lalu berbobot sekitar setengah laga kemarin. */
export const HALF_LIFE_DAYS = 180;
/** Laga dalam enam pertandingan terakhir tiap tim mendapat bobot tambahan (bentuk). */
export const FORM_WINDOW = 6;
export const FORM_BOOST = 1.3;
export const MAX_GOALS = 6;
const FIT_ITERS = 45;
const FIT_ITERS_SEEDED = 12;

/** Aturan seri yang dikalibrasi: pilih seri jika kedua tim berimbang dan p(seri) dekat peluang tertinggi. */
export const DRAW_EVEN_GAP = 0.11;
export const DRAW_CLOSE = 0.09;
export const DRAW_MIN = 0.22;

export const MODEL_METHOD =
  "Model Poisson berbobot dengan koreksi Dixon-Coles. Kekuatan serang dan bela tiap tim, plus keunggulan kandang per liga, dihitung dari seluruh hasil liga musim ini dan dua musim kalender sebelumnya (sumber ESPN). Bobot laga meluruh dengan paruh hidup 180 hari, dan enam laga terakhir tiap tim diberi bobot tambahan 1,3 kali agar bentuk terkini lebih terasa. Koreksi Dixon-Coles (parameter rho) menyesuaikan peluang skor rendah (0-0, 1-0, 0-1, 1-1) yang biasanya tidak independen. Perkiraan gol adalah lambda model, bukan xG resmi ESPN. Peluang dan skor paling mungkin dihitung dari matriks 0–6 gol, lalu dinormalisasi. Ini estimasi statistik untuk analisis, bukan saran taruhan, bukan pasaran, dan tidak dijamin akurat.";

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function poissonP(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function tau(x: number, y: number, lambdaH: number, lambdaA: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambdaH * lambdaA * rho;
  if (x === 0 && y === 1) return 1 + lambdaH * rho;
  if (x === 1 && y === 0) return 1 + lambdaA * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

function timeWeight(matchUtc: string, asOf: Date): number {
  const days = Math.max(0, (asOf.getTime() - parseUtc(matchUtc).getTime()) / 86_400_000);
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

export function toHistMatches(events: MatchSummary[]): HistMatch[] {
  const out: HistMatch[] = [];
  for (const e of events) {
    if (e.status !== "post") continue;
    const hg = toNum(e.home.score);
    const ag = toNum(e.away.score);
    if (!e.home.id || !e.away.id) continue;
    // Skip rows without a usable score (display "–" becomes 0, but missing score on a post match with empty string is 0-0; accept finite).
    out.push({
      id: e.id,
      dateUtc: e.dateUtc,
      dateWib: e.dateWib,
      season: e.season,
      homeId: e.home.id,
      awayId: e.away.id,
      homeName: e.home.name,
      awayName: e.away.name,
      homeGoals: hg,
      awayGoals: ag,
    });
  }
  out.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  return out;
}

function formBoostIds(matches: HistMatch[], asOfMs: number): Map<string, Set<string>> {
  const byTeam = new Map<string, HistMatch[]>();
  for (const m of matches) {
    if (parseUtc(m.dateUtc).getTime() >= asOfMs) continue;
    if (!byTeam.has(m.homeId)) byTeam.set(m.homeId, []);
    if (!byTeam.has(m.awayId)) byTeam.set(m.awayId, []);
    byTeam.get(m.homeId)!.push(m);
    byTeam.get(m.awayId)!.push(m);
  }
  const boost = new Map<string, Set<string>>();
  for (const [tid, list] of byTeam) {
    const last = list.slice(-FORM_WINDOW);
    const set = new Set(last.map((m) => m.id));
    boost.set(tid, set);
  }
  return boost;
}

function weightOf(m: HistMatch, asOf: Date, boost: Map<string, Set<string>>): number {
  let w = timeWeight(m.dateUtc, asOf);
  const formHome = boost.get(m.homeId)?.has(m.id);
  const formAway = boost.get(m.awayId)?.has(m.id);
  if (formHome && formAway) w *= FORM_BOOST * 1.15;
  else if (formHome || formAway) w *= FORM_BOOST;
  return w;
}

export function fitModel(history: HistMatch[], asOf: Date = new Date(), seed?: FittedModel | null): FittedModel | null {
  const asOfMs = asOf.getTime();
  const usable = history.filter((m) => parseUtc(m.dateUtc).getTime() < asOfMs);
  if (usable.length < 40) return null;

  const names = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const m of usable) {
    names.set(m.homeId, m.homeName);
    names.set(m.awayId, m.awayName);
    counts.set(m.homeId, (counts.get(m.homeId) ?? 0) + 1);
    counts.set(m.awayId, (counts.get(m.awayId) ?? 0) + 1);
  }
  const ids = [...names.keys()];
  const boost = formBoostIds(usable, asOfMs);
  const weighted: { m: HistMatch; w: number }[] = usable.map((m) => ({ m, w: weightOf(m, asOf, boost) }));

  const att: Record<string, number> = {};
  const def: Record<string, number> = {};
  for (const id of ids) {
    att[id] = seed?.teams[id]?.attack ?? 1;
    def[id] = seed?.teams[id]?.defense ?? 1;
  }
  let gamma = seed?.homeAdvantage ?? 1.3;
  let mu = seed?.mu ?? 1.15;
  const iters = seed ? FIT_ITERS_SEEDED : FIT_ITERS;

  for (let iter = 0; iter < iters; iter++) {
    const attNum: Record<string, number> = {};
    const attDen: Record<string, number> = {};
    const defNum: Record<string, number> = {};
    const defDen: Record<string, number> = {};
    for (const id of ids) {
      attNum[id] = 0;
      attDen[id] = 0;
      defNum[id] = 0;
      defDen[id] = 0;
    }
    for (const { m, w } of weighted) {
      if (w <= 0) continue;
      // λ_h = μ * att_h * def_a * γ    λ_a = μ * att_a * def_h
      attNum[m.homeId] += w * m.homeGoals;
      attDen[m.homeId] += w * mu * def[m.awayId] * gamma;
      defNum[m.awayId] += w * m.homeGoals;
      defDen[m.awayId] += w * mu * att[m.homeId] * gamma;

      attNum[m.awayId] += w * m.awayGoals;
      attDen[m.awayId] += w * mu * def[m.homeId];
      defNum[m.homeId] += w * m.awayGoals;
      defDen[m.homeId] += w * mu * att[m.awayId];
    }
    for (const id of ids) {
      if (attDen[id] > 0) att[id] = attNum[id] / attDen[id];
      if (defDen[id] > 0) def[id] = defNum[id] / defDen[id];
      att[id] = Math.min(3.5, Math.max(0.25, att[id] || 1));
      def[id] = Math.min(3.5, Math.max(0.25, def[id] || 1));
    }
    const meanAtt = ids.reduce((s, id) => s + att[id], 0) / ids.length;
    const meanDef = ids.reduce((s, id) => s + def[id], 0) / ids.length;
    if (meanAtt > 0) for (const id of ids) att[id] /= meanAtt;
    if (meanDef > 0) for (const id of ids) def[id] /= meanDef;

    let hg = 0;
    let hexp = 0;
    let ag = 0;
    let aexp = 0;
    for (const { m, w } of weighted) {
      if (w <= 0) continue;
      hg += w * m.homeGoals;
      hexp += w * att[m.homeId] * def[m.awayId];
      ag += w * m.awayGoals;
      aexp += w * att[m.awayId] * def[m.homeId];
    }
    if (aexp > 0) mu = ag / aexp;
    if (hexp > 0 && mu > 0) gamma = hg / (hexp * mu);
    mu = Math.min(2.8, Math.max(0.6, mu || 1.15));
    gamma = Math.min(2.0, Math.max(1.0, gamma || 1.3));
  }

  // Estimate rho on a grid after attack/defense have settled.
  let bestRho = -0.1;
  let bestLl = -Infinity;
  for (let rho = -0.25; rho <= 0.12; rho = Math.round((rho + 0.01) * 100) / 100) {
    let ll = 0;
    for (const { m, w } of weighted) {
      if (w <= 0) continue;
      const lh = mu * att[m.homeId] * def[m.awayId] * gamma;
      const la = mu * att[m.awayId] * def[m.homeId];
      const p = scoreProbability(m.homeGoals, m.awayGoals, lh, la, rho);
      ll += w * Math.log(Math.max(p, 1e-12));
    }
    if (ll > bestLl) {
      bestLl = ll;
      bestRho = rho;
    }
  }

  const teams: Record<string, TeamStrength> = {};
  for (const id of ids) {
    teams[id] = {
      id,
      name: names.get(id) || id,
      attack: Math.round(att[id] * 1000) / 1000,
      defense: Math.round(def[id] * 1000) / 1000,
      matches: counts.get(id) ?? 0,
    };
  }

  return {
    teams,
    homeAdvantage: Math.round(gamma * 1000) / 1000,
    mu: Math.round(mu * 1000) / 1000,
    rho: Math.round(bestRho * 1000) / 1000,
    halfLifeDays: HALF_LIFE_DAYS,
    samples: usable.length,
    asOfUtc: asOf.toISOString(),
    method: MODEL_METHOD,
  };
}

export function lambdasFor(model: FittedModel, homeId: string, awayId: string): { lambdaHome: number; lambdaAway: number } {
  const home = model.teams[homeId];
  const away = model.teams[awayId];
  const attH = home?.attack ?? 1;
  const defH = home?.defense ?? 1;
  const attA = away?.attack ?? 1;
  const defA = away?.defense ?? 1;
  return {
    lambdaHome: model.mu * attH * defA * model.homeAdvantage,
    lambdaAway: model.mu * attA * defH,
  };
}

export function scoreProbability(
  x: number,
  y: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number
): number {
  const t = tau(x, y, lambdaHome, lambdaAway, rho);
  const raw = Math.max(0, t) * poissonP(x, Math.max(0, lambdaHome)) * poissonP(y, Math.max(0, lambdaAway));
  return raw;
}

export function scoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
  currentHome = 0,
  currentAway = 0,
  max = MAX_GOALS
): { cells: ScoreCell[]; pHome: number; pDraw: number; pAway: number; top: ScoreCell[] } {
  const cells: ScoreCell[] = [];
  let total = 0;
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const p = scoreProbability(i, j, lambdaHome, lambdaAway, rho);
      const cell: ScoreCell = {
        home: currentHome + i,
        away: currentAway + j,
        remainingHome: i,
        remainingAway: j,
        p,
      };
      cells.push(cell);
      total += p;
    }
  }
  if (total <= 0) total = 1;
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (const c of cells) {
    c.p /= total;
    if (c.home > c.away) pHome += c.p;
    else if (c.home === c.away) pDraw += c.p;
    else pAway += c.p;
  }
  const norm = pHome + pDraw + pAway || 1;
  const top = [...cells].sort((a, b) => b.p - a.p).slice(0, 8);
  return { cells, pHome: pHome / norm, pDraw: pDraw / norm, pAway: pAway / norm, top };
}

function confidenceNote(model: FittedModel, homeId: string, awayId: string, estimate: PoissonEstimate): string {
  const h = model.teams[homeId];
  const a = model.teams[awayId];
  const nH = h?.matches ?? 0;
  const nA = a?.matches ?? 0;
  const bits: string[] = [];
  if (nH < 8 || nA < 8) {
    bits.push(
      `Kepercayaan lebih rendah karena salah satu tim baru punya ${Math.min(nH, nA)} laga dalam sampel (minimal nyaman sekitar 8).`
    );
  } else if (nH < 20 || nA < 20) {
    bits.push(`Sampel sedang: ${nH} laga untuk tuan rumah dan ${nA} untuk tamu dalam riwayat yang dipakai.`);
  } else {
    bits.push(`Sampel cukup: ${nH} laga tuan rumah dan ${nA} laga tamu masuk hitungan, dengan peluruhan waktu 180 hari.`);
  }
  const spread = Math.max(estimate.pHome, estimate.pDraw, estimate.pAway) - Math.min(estimate.pHome, estimate.pDraw, estimate.pAway);
  if (spread < 0.12 || Math.max(estimate.pHome, estimate.pDraw, estimate.pAway) < 0.4) {
    bits.push("Peluang model berdekatan, jadi hasilnya terbuka menurut data historis.");
  } else if (Math.max(estimate.pHome, estimate.pDraw, estimate.pAway) >= 0.55) {
    bits.push("Model melihat salah satu hasil lebih menonjol, tetapi ini tetap perkiraan, bukan kepastian.");
  }
  if (!h || !a) {
    bits.push("Salah satu tim minim jejak di liga ini (misalnya baru promosi), jadi kekuatannya mendekati rata-rata liga.");
  }
  bits.push("Angka ini estimasi statistik, bukan saran taruhan.");
  return bits.join(" ");
}

export function predictMatch(
  model: FittedModel,
  homeId: string,
  awayId: string,
  opts?: { currentHome?: number; currentAway?: number; mode?: "pre" | "in" | "post" }
): PoissonEstimate {
  const { lambdaHome, lambdaAway } = lambdasFor(model, homeId, awayId);
  const currentHome = opts?.currentHome ?? 0;
  const currentAway = opts?.currentAway ?? 0;
  const remainingH = opts?.mode === "in" ? lambdaHome : lambdaHome;
  const matrix = scoreMatrix(remainingH, lambdaAway, model.rho, currentHome, currentAway);
  const availHome = !!model.teams[homeId];
  const availAway = !!model.teams[awayId];
  const available = true;
  const estimate: PoissonEstimate = {
    available,
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100,
    pHome: matrix.pHome,
    pDraw: matrix.pDraw,
    pAway: matrix.pAway,
    method: model.method,
    mode: opts?.mode ?? "pre",
    homeAdvantage: model.homeAdvantage,
    rho: model.rho,
    mu: model.mu,
    scoreMatrix: matrix.cells,
    topScores: matrix.top,
    sampleHome: model.teams[homeId]?.matches ?? 0,
    sampleAway: model.teams[awayId]?.matches ?? 0,
    confidence: "",
  };
  if (!availHome && !availAway) {
    estimate.confidence =
      "Kedua tim belum punya cukup jejak di riwayat liga yang diunduh, jadi model memakai rata-rata liga. Ini estimasi statistik, bukan saran taruhan.";
  } else {
    estimate.confidence = confidenceNote(model, homeId, awayId, estimate);
  }
  return decorateEstimate(estimate);
}

export function applyInPlay(
  pre: PoissonEstimate,
  homeScore: number,
  awayScore: number,
  remainingMinutes: number,
  status: "pre" | "in" | "post" | "unknown"
): PoissonEstimate {
  if (status === "post") {
    // Keep the pre-match (or last) model distribution for analysis; do not collapse to 100%.
    return {
      ...pre,
      mode: "post",
      currentHome: homeScore,
      currentAway: awayScore,
      remainingMinutes: 0,
      method:
        (pre.method || MODEL_METHOD) +
        " Angka peluang dan skor paling mungkin di halaman laga selesai adalah estimasi pra-laga (hanya data sebelum kickoff), dibanding dengan hasil aktual. Ini bukan saran taruhan.",
    };
  }
  if (!pre.available) {
    return { ...pre, mode: status === "in" ? "in" : "pre", currentHome: homeScore, currentAway: awayScore, remainingMinutes };
  }
  const frac = Math.max(0, Math.min(1, remainingMinutes / 90));
  const lambdaHome = pre.lambdaHome * frac;
  const lambdaAway = pre.lambdaAway * frac;
  const rho = pre.rho ?? 0;
  const matrix = scoreMatrix(lambdaHome, lambdaAway, rho, homeScore, awayScore);
  return decorateEstimate({
    ...pre,
    available: true,
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100,
    pHome: matrix.pHome,
    pDraw: matrix.pDraw,
    pAway: matrix.pAway,
    scoreMatrix: matrix.cells,
    topScores: matrix.top,
    method:
      pre.method +
      ` Saat pertandingan berjalan, perkiraan gol sisa dikali sisa waktu regulasi (${remainingMinutes.toFixed(0)} dari 90 menit), lalu ditambah skor berjalan. Ini tetap estimasi statistik, bukan saran taruhan.`,
    mode: "in",
    remainingMinutes,
    currentHome: homeScore,
    currentAway: awayScore,
  });
}

function outcome(h: number, a: number): "H" | "D" | "A" {
  if (h > a) return "H";
  if (h === a) return "D";
  return "A";
}

export function pickOutcomeArgmax(pH: number, pD: number, pA: number): "H" | "D" | "A" {
  if (pH >= pD && pH >= pA) return "H";
  if (pA >= pH && pA >= pD) return "A";
  return "D";
}

export function pickOutcome(pH: number, pD: number, pA: number): "H" | "D" | "A" {
  const max = Math.max(pH, pD, pA);
  const gap = Math.abs(pH - pA);
  if (pD >= DRAW_MIN && max - pD <= DRAW_CLOSE && gap <= DRAW_EVEN_GAP) return "D";
  return pickOutcomeArgmax(pH, pD, pA);
}

function predicted(pH: number, pD: number, pA: number): "H" | "D" | "A" {
  return pickOutcome(pH, pD, pA);
}

export function predScoreOf(estimate: PoissonEstimate): string | undefined {
  const top = estimate.topScores?.[0];
  if (!top) return estimate.predScore;
  return `${top.home}–${top.away}`;
}

export function slimEstimate(est: PoissonEstimate): PoissonEstimate {
  const pick = est.pick ?? pickOutcome(est.pHome, est.pDraw, est.pAway);
  const predScore = est.predScore ?? predScoreOf(est);
  return {
    available: est.available,
    reason: est.reason,
    lambdaHome: est.lambdaHome,
    lambdaAway: est.lambdaAway,
    pHome: est.pHome,
    pDraw: est.pDraw,
    pAway: est.pAway,
    method: "Dixon-Coles",
    mode: est.mode,
    pick,
    predScore,
    oneXtwoHasil: est.oneXtwoHasil,
    scoreHasil: est.scoreHasil,
    topScores: est.topScores?.slice(0, 1),
  };
}

export function decorateEstimate(estimate: PoissonEstimate, homeGoals?: number | null, awayGoals?: number | null): PoissonEstimate {
  const pick = pickOutcome(estimate.pHome, estimate.pDraw, estimate.pAway);
  const predScore = predScoreOf(estimate);
  let oneXtwoHasil: "TEPAT" | "MELESET" | undefined;
  let scoreHasil: "TEPAT" | "MELESET" | undefined;
  if (homeGoals != null && awayGoals != null) {
    const actual = outcome(homeGoals, awayGoals);
    oneXtwoHasil = actual === pick ? "TEPAT" : "MELESET";
    scoreHasil = predScore === `${homeGoals}–${awayGoals}` ? "TEPAT" : "MELESET";
  }
  return { ...estimate, pick, predScore, oneXtwoHasil, scoreHasil };
}

export function contributingMatches(
  history: HistMatch[],
  teamId: string,
  teamName: string,
  asOf: Date,
  limit = 8
): ModelContribution[] {
  const asOfMs = asOf.getTime();
  const usable = history.filter(
    (m) => parseUtc(m.dateUtc).getTime() < asOfMs && (m.homeId === teamId || m.awayId === teamId)
  );
  const boost = formBoostIds(
    history.filter((m) => parseUtc(m.dateUtc).getTime() < asOfMs),
    asOfMs
  );
  return usable
    .map((m) => {
      const isHome = m.homeId === teamId;
      const scored = isHome ? m.homeGoals : m.awayGoals;
      const conceded = isHome ? m.awayGoals : m.homeGoals;
      const result: "W" | "D" | "L" = scored > conceded ? "W" : scored === conceded ? "D" : "L";
      return {
        id: m.id,
        dateWib: m.dateWib,
        dateUtc: m.dateUtc,
        opponent: isHome ? m.awayName : m.homeName,
        homeAway: (isHome ? "home" : "away") as "home" | "away",
        score: `${m.homeGoals}–${m.awayGoals}`,
        result,
        weight: Math.round(weightOf(m, asOf, boost) * 1000) / 1000,
        formBoost: !!boost.get(teamId)?.has(m.id),
      };
    })
    .sort((a, b) => b.dateUtc.localeCompare(a.dateUtc))
    .slice(0, limit);
}

function brierOf(pH: number, pD: number, pA: number, actual: "H" | "D" | "A"): number {
  const oH = actual === "H" ? 1 : 0;
  const oD = actual === "D" ? 1 : 0;
  const oA = actual === "A" ? 1 : 0;
  return (pH - oH) ** 2 + (pD - oD) ** 2 + (pA - oA) ** 2;
}

export function backtestCurrentSeason(
  history: HistMatch[],
  currentSeasonPrefix: string
): BacktestResult {
  const method =
    "Uji balik: setiap laga selesai musim berjalan diperkirakan ulang hanya dengan data sebelum kickoff (dua musim sebelumnya plus laga musim ini yang sudah lewat). Metrik: akurasi 1/X/2 (aturan seri dikalibrasi: pilih seri jika peluang seri sekurang-kurangnya 22%, jarak ke peluang tertinggi paling 9 poin, dan selisih tuan rumah vs tamu paling 11 poin), akurasi skor tepat, skor Brier, dan kalibrasi. Ini mengukur keandalan model statistik, bukan saran taruhan.";

  const current = history.filter((m) => {
    if (m.season && currentSeasonPrefix && m.season.startsWith(currentSeasonPrefix)) return true;
    return false;
  });
  // Fallback if season labels missing: take matches on/after Aug 1 of espn year.
  let targets = current;
  if (targets.length < 5) {
    // Use the latest season cluster: after the median of last 40% dates? Better: matches in the most recent August-onward window.
    const years = history
      .map((m) => parseUtc(m.dateUtc).getUTCFullYear())
      .sort((a, b) => a - b);
    const year = years[years.length - 1] ?? 2026;
    // Season year Y runs Aug Y to May Y+1; current espnSeason 2026 means Aug 2026+.
    // If we have 2026-27 matches starting Aug 2026, filter date >= Aug 1 of max year if month>=8 else max year-1.
    const last = history[history.length - 1];
    const lastD = last ? parseUtc(last.dateUtc) : new Date();
    const startYear = lastD.getUTCMonth() >= 6 ? lastD.getUTCFullYear() : lastD.getUTCFullYear() - 1;
    const start = Date.UTC(startYear, 6, 15); // mid-July of season start year
    targets = history.filter((m) => parseUtc(m.dateUtc).getTime() >= start);
  }

  if (targets.length < 3) {
    return {
      available: false,
      reason: "Belum cukup laga selesai musim ini untuk uji balik yang bermakna (minimal tiga).",
      n: 0,
      accuracy: 0,
      brier: 0,
      logLoss: 0,
      correct: 0,
      exactCorrect: 0,
      exactAccuracy: 0,
      predictedDraws: 0,
      byOutcome: {
        H: { n: 0, correct: 0 },
        D: { n: 0, correct: 0 },
        A: { n: 0, correct: 0 },
      },
      calibration: [],
      rows: [],
      method,
    };
  }

  const rows: BacktestRow[] = [];
  const ordered = [...targets].sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  let seed: FittedModel | null = null;
  let seedAsOf = -1;
  for (const m of ordered) {
    const kickoff = parseUtc(m.dateUtc);
    const t0 = kickoff.getTime();
    const model: FittedModel | null = seedAsOf === t0 && seed ? seed : fitModel(history, kickoff, seed);
    seed = model;
    seedAsOf = t0;
    if (!model) continue;
    const est = predictMatch(model, m.homeId, m.awayId, { mode: "pre" });
    if (!est.available) continue;
    const actual = outcome(m.homeGoals, m.awayGoals);
    const pred = predicted(est.pHome, est.pDraw, est.pAway);
    const br = brierOf(est.pHome, est.pDraw, est.pAway, actual);
    const pActual = actual === "H" ? est.pHome : actual === "D" ? est.pDraw : est.pAway;
    const predScore = predScoreOf(est);
    const scoreLine = `${m.homeGoals}–${m.awayGoals}`;
    rows.push({
      id: m.id,
      dateWib: m.dateWib,
      dateUtc: m.dateUtc,
      home: m.homeName,
      away: m.awayName,
      homeId: m.homeId,
      awayId: m.awayId,
      score: scoreLine,
      actual,
      predicted: pred,
      correct: pred === actual,
      pHome: est.pHome,
      pDraw: est.pDraw,
      pAway: est.pAway,
      lambdaHome: est.lambdaHome,
      lambdaAway: est.lambdaAway,
      brier: br,
      logLoss: -Math.log(Math.max(pActual, 1e-12)),
      predScore,
      scoreCorrect: predScore === scoreLine,
    });
  }

  if (!rows.length) {
    return {
      available: false,
      reason: "Model tidak bisa diuji pada laga musim ini karena riwayat sebelum kickoff masih terlalu pendek.",
      n: 0,
      accuracy: 0,
      brier: 0,
      logLoss: 0,
      correct: 0,
      exactCorrect: 0,
      exactAccuracy: 0,
      predictedDraws: 0,
      byOutcome: { H: { n: 0, correct: 0 }, D: { n: 0, correct: 0 }, A: { n: 0, correct: 0 } },
      calibration: [],
      rows: [],
      method,
    };
  }

  const correct = rows.filter((r) => r.correct).length;
  const brier = rows.reduce((s, r) => s + r.brier, 0) / rows.length;
  const logLoss = rows.reduce((s, r) => s + r.logLoss, 0) / rows.length;
  const byOutcome: BacktestResult["byOutcome"] = {
    H: { n: 0, correct: 0 },
    D: { n: 0, correct: 0 },
    A: { n: 0, correct: 0 },
  };
  for (const r of rows) {
    byOutcome[r.actual].n += 1;
    if (r.correct) byOutcome[r.actual].correct += 1;
  }

  const edges = [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0001];
  const calibration: CalibrationBin[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i];
    const to = edges[i + 1];
    const inBin = rows.filter((r) => r.pHome >= from && r.pHome < to);
    if (!inBin.length) continue;
    const avgPredicted = inBin.reduce((s, r) => s + r.pHome, 0) / inBin.length;
    const observed = inBin.filter((r) => r.actual === "H").length / inBin.length;
    calibration.push({
      from,
      to: edges[i + 1] === 1.0001 ? 1 : to,
      count: inBin.length,
      avgPredicted,
      observed,
    });
  }

  const exactCorrect = rows.filter((r) => r.scoreCorrect).length;
  const predictedDraws = rows.filter((r) => r.predicted === "D").length;
  return {
    available: true,
    n: rows.length,
    accuracy: correct / rows.length,
    brier,
    logLoss,
    correct,
    exactCorrect,
    exactAccuracy: exactCorrect / rows.length,
    predictedDraws,
    byOutcome,
    calibration,
    rows,
    method,
  };
}

export function emptyEstimate(reason: string): PoissonEstimate {
  return {
    available: false,
    reason,
    lambdaHome: 0,
    lambdaAway: 0,
    pHome: 0,
    pDraw: 0,
    pAway: 0,
    method: MODEL_METHOD,
  };
}

export const TOTAL_LINES = [1.5, 2.5, 3.5, 4.5] as const;
export const PREFERRED_MIN_P = 0.65;

export function oneXtwoLabel(pick: "H" | "D" | "A", home: string, away: string): string {
  if (pick === "H") return `Menang ${home}`;
  if (pick === "A") return `Menang ${away}`;
  return "Seri";
}

export function formatLine(side: "Atas" | "Bawah", line: number): string {
  return `${side} ${line.toFixed(1).replace(".", ",")}`;
}

export function totalsOptions(cells: ScoreCell[]): { side: "Atas" | "Bawah"; line: number; p: number }[] {
  const out: { side: "Atas" | "Bawah"; line: number; p: number }[] = [];
  for (const line of TOTAL_LINES) {
    let over = 0;
    let under = 0;
    for (const c of cells) {
      if (c.home + c.away > line) over += c.p;
      else under += c.p;
    }
    out.push({ side: "Atas", line, p: over }, { side: "Bawah", line, p: under });
  }
  return out;
}

export function pickTotalsLine(estimate: PoissonEstimate): TotalsPick {
  const cells =
    estimate.scoreMatrix && estimate.scoreMatrix.length
      ? estimate.scoreMatrix
      : scoreMatrix(estimate.lambdaHome, estimate.lambdaAway, estimate.rho ?? 0).cells;
  const options = totalsOptions(cells);
  const preferred = options.filter((o) => o.p >= PREFERRED_MIN_P);
  // Jika ada garis berpeluang ≥ 65%, pilih yang paling ketat (peluang paling dekat ke 65%),
  // supaya log tidak selalu jatuh ke klaim longgar seperti Bawah 4,5.
  const best = preferred.length
    ? [...preferred].sort((a, b) => a.p - b.p || a.line - b.line)[0]
    : [...options].sort((a, b) => b.p - a.p || a.line - b.line)[0] ?? { side: "Atas" as const, line: 2.5, p: 0 };
  return {
    side: best.side,
    line: best.line,
    p: best.p,
    label: formatLine(best.side, best.line),
    belowThreshold: best.p < PREFERRED_MIN_P,
  };
}

function totalsHit(side: "Atas" | "Bawah", line: number, totalGoals: number): boolean {
  return side === "Atas" ? totalGoals > line : totalGoals < line;
}

export function currentSeasonMatches(history: HistMatch[], currentSeasonPrefix: string): HistMatch[] {
  const current = history.filter((m) => !!(m.season && currentSeasonPrefix && m.season.startsWith(currentSeasonPrefix)));
  if (current.length >= 5) return current;
  const last = history[history.length - 1];
  const lastD = last ? parseUtc(last.dateUtc) : new Date();
  const startYear = lastD.getUTCMonth() >= 6 ? lastD.getUTCFullYear() : lastD.getUTCFullYear() - 1;
  const start = Date.UTC(startYear, 6, 15);
  return history.filter((m) => parseUtc(m.dateUtc).getTime() >= start);
}

function emptyLogSummary(): PredictionLogSummary {
  return { n: 0, tepat: 0, meleset: 0, accuracy: 0, waiting: 0, byLine: [], calibration: [], oneXtwoTepat: 0, oneXtwoAccuracy: 0, scoreTepat: 0, scoreAccuracy: 0 };
}

function summarizeLog(finished: PredictionLogRow[], waiting: number): PredictionLogSummary {
  const n = finished.length;
  const tepat = finished.filter((r) => r.hasil === "TEPAT").length;
  const meleset = finished.filter((r) => r.hasil === "MELESET").length;
  const byMap = new Map<string, { n: number; tepat: number }>();
  for (const r of finished) {
    const key = r.totals.label;
    const cur = byMap.get(key) ?? { n: 0, tepat: 0 };
    cur.n += 1;
    if (r.hasil === "TEPAT") cur.tepat += 1;
    byMap.set(key, cur);
  }
  const byLine: LineBreakdown[] = [...byMap.entries()]
    .map(([key, v]) => ({ key, n: v.n, tepat: v.tepat, accuracy: v.n ? v.tepat / v.n : 0 }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));

  const edges = [0, 0.5, 0.65, 0.75, 0.85, 1.0001];
  const calibration: CalibrationBin[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i];
    const to = edges[i + 1];
    const inBin = finished.filter((r) => r.totals.p >= from && r.totals.p < to);
    if (!inBin.length) continue;
    calibration.push({
      from,
      to: edges[i + 1] === 1.0001 ? 1 : to,
      count: inBin.length,
      avgPredicted: inBin.reduce((s, r) => s + r.totals.p, 0) / inBin.length,
      observed: inBin.filter((r) => r.hasil === "TEPAT").length / inBin.length,
    });
  }

  const oneXtwoTepat = finished.filter((r) => r.oneXtwoHasil === "TEPAT").length;
  const scoreTepat = finished.filter((r) => r.scoreHasil === "TEPAT").length;
  return {
    n,
    tepat,
    meleset,
    accuracy: n ? tepat / n : 0,
    waiting,
    byLine,
    calibration,
    oneXtwoTepat,
    oneXtwoAccuracy: n ? oneXtwoTepat / n : 0,
    scoreTepat,
    scoreAccuracy: n ? scoreTepat / n : 0,
  };
}

function rowFromEstimate(
  opts: {
    id: string;
    slug: string;
    leagueName: string;
    dateWib: string;
    dateUtc: string;
    timeWib?: string | null;
    home: string;
    away: string;
    homeId: string;
    awayId: string;
    status: "post" | "pre" | "in";
    homeGoals?: number | null;
    awayGoals?: number | null;
  },
  estimate: PoissonEstimate
): PredictionLogRow {
  const totals = pickTotalsLine(estimate);
  const one = predicted(estimate.pHome, estimate.pDraw, estimate.pAway);
  const oneP = one === "H" ? estimate.pHome : one === "D" ? estimate.pDraw : estimate.pAway;
  const oneLabel = oneXtwoLabel(one, opts.home, opts.away);
  const predScore = predScoreOf(estimate);
  let hasil: PredictionLogRow["hasil"] = "MENUNGGU";
  let oneXtwoHasil: "TEPAT" | "MELESET" | undefined;
  let scoreHasil: "TEPAT" | "MELESET" | undefined;
  let score: string | null = null;
  let totalGoals: number | null = null;
  if (opts.status === "post" && opts.homeGoals != null && opts.awayGoals != null) {
    score = `${opts.homeGoals}–${opts.awayGoals}`;
    totalGoals = opts.homeGoals + opts.awayGoals;
    hasil = totalsHit(totals.side, totals.line, totalGoals) ? "TEPAT" : "MELESET";
    const actual = outcome(opts.homeGoals, opts.awayGoals);
    oneXtwoHasil = actual === one ? "TEPAT" : "MELESET";
    scoreHasil = predScore === score ? "TEPAT" : "MELESET";
  }
  const confidence = totals.belowThreshold ? " (peluang di bawah 65%)" : "";
  return {
    id: opts.id,
    slug: opts.slug,
    leagueName: opts.leagueName,
    dateWib: opts.dateWib,
    dateUtc: opts.dateUtc,
    timeWib: opts.timeWib,
    home: opts.home,
    away: opts.away,
    homeId: opts.homeId,
    awayId: opts.awayId,
    score,
    totalGoals,
    status: opts.status,
    hasil,
    totals,
    oneXtwoPick: one,
    oneXtwoLabel: oneLabel,
    oneXtwoP: oneP,
    oneXtwoHasil,
    predScore,
    scoreHasil,
    pHome: estimate.pHome,
    pDraw: estimate.pDraw,
    pAway: estimate.pAway,
    predictionText: `${opts.home} vs ${opts.away} (${totals.label})${confidence} · 1X2: ${oneLabel}${predScore ? ` · skor ${predScore}` : ""}`,
  };
}

const LOG_METHOD =
  "Log prediksi memakai model Poisson berbobot Dixon-Coles. Untuk laga selesai, estimasi dihitung ulang hanya dengan data sebelum kickoff. Untuk laga mendatang, dipakai model terkini. Prediksi utama adalah garis total gol Atas/Bawah 1,5–4,5. Jika ada garis berpeluang sekurang-kurangnya 65%, yang dipilih adalah klaim paling ketat yang masih lolos ambang itu. Jika tidak ada yang sampai 65%, dipilih peluang tertinggi. 1X2 memakai aturan seri yang dikalibrasi (pilih seri jika peluang seri cukup dekat dengan peluang tertinggi dan kedua tim berimbang) plus skor paling mungkin. Hasil TEPAT/MELESET di kolom utama merujuk pada garis total gol; 1X2 dan skor tepat dinilai terpisah. Ini estimasi statistik untuk analisis, bukan saran taruhan, bukan pasaran, dan tidak terkait uang atau hadiah.";

export function buildPredictionLog(opts: {
  history: HistMatch[];
  upcoming?: HistMatch[];
  currentSeasonPrefix: string;
  slug: string;
  leagueName: string;
}): { available: boolean; reason?: string; summary: PredictionLogSummary; rows: PredictionLogRow[]; method: string } {
  const finishedTargets = currentSeasonMatches(opts.history, opts.currentSeasonPrefix);
  const nowMs = Date.now();
  const finished: PredictionLogRow[] = [];
  const premature: HistMatch[] = [];
  const orderedFinished = [...finishedTargets].sort((a, b) => a.dateUtc.localeCompare(b.dateUtc));
  let seed: FittedModel | null = null;
  let seedAsOf = -1;
  for (const m of orderedFinished) {
    if (parseUtc(m.dateUtc).getTime() > nowMs) {
      premature.push(m);
      continue;
    }
    const kickoff = parseUtc(m.dateUtc);
    const t0 = kickoff.getTime();
    const model: FittedModel | null = seedAsOf === t0 && seed ? seed : fitModel(opts.history, kickoff, seed);
    seed = model;
    seedAsOf = t0;
    if (!model) continue;
    const est = predictMatch(model, m.homeId, m.awayId, { mode: "pre" });
    if (!est.available) continue;
    finished.push(
      rowFromEstimate(
        {
          id: m.id,
          slug: opts.slug,
          leagueName: opts.leagueName,
          dateWib: m.dateWib,
          dateUtc: m.dateUtc,
          home: m.homeName,
          away: m.awayName,
          homeId: m.homeId,
          awayId: m.awayId,
          status: "post",
          homeGoals: m.homeGoals,
          awayGoals: m.awayGoals,
        },
        est
      )
    );
  }

  const waiting: PredictionLogRow[] = [];
  const upcomingIds = new Set((opts.upcoming ?? []).map((m) => m.id));
  const upcoming = [
    ...(opts.upcoming ?? []),
    ...premature.filter((m) => !upcomingIds.has(m.id)),
  ];
  if (upcoming.length) {
    const nowModel = fitModel(opts.history, new Date());
    if (nowModel) {
      for (const m of upcoming) {
        const est = predictMatch(nowModel, m.homeId, m.awayId, { mode: "pre" });
        if (!est.available) continue;
        waiting.push(
          rowFromEstimate(
            {
              id: m.id,
              slug: opts.slug,
              leagueName: opts.leagueName,
              dateWib: m.dateWib,
              dateUtc: m.dateUtc,
              home: m.homeName,
              away: m.awayName,
              homeId: m.homeId,
              awayId: m.awayId,
              status: "pre",
            },
            est
          )
        );
      }
    }
  }

  if (!finished.length && !waiting.length) {
    return {
      available: false,
      reason: "Belum ada laga musim ini yang bisa dimasukkan ke log prediksi.",
      summary: emptyLogSummary(),
      rows: [],
      method: LOG_METHOD,
    };
  }

  const rows = [...waiting.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc)), ...finished.sort((a, b) => b.dateUtc.localeCompare(a.dateUtc))];
  return {
    available: true,
    summary: summarizeLog(finished, waiting.length),
    rows,
    method: LOG_METHOD,
  };
}
