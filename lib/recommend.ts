import type {
  HeadToHead,
  MatchRecommendation,
  MatchSummary,
  PoissonEstimate,
  ScoreCell,
  TeamAnalysis,
} from "./types";
import { pct } from "./format";

export type GoalRange = { key: string; label: string; from: number; to: number | null; p: number };

function cellsOf(estimate: PoissonEstimate): ScoreCell[] {
  if (estimate.scoreMatrix && estimate.scoreMatrix.length) return estimate.scoreMatrix;
  if (estimate.topScores && estimate.topScores.length) return estimate.topScores;
  return [];
}

export function pBttsOf(estimate: PoissonEstimate): number | undefined {
  const cells = cellsOf(estimate);
  if (!cells.length) return undefined;
  const p = cells.filter((c) => c.home > 0 && c.away > 0).reduce((s, c) => s + c.p, 0);
  return Math.round(p * 1000) / 1000;
}

export function goalRangesOf(estimate: PoissonEstimate): GoalRange[] {
  const cells = cellsOf(estimate);
  if (!cells.length) return [];
  const buckets: GoalRange[] = [
    { key: "0-1", label: "0–1 gol", from: 0, to: 1, p: 0 },
    { key: "2-3", label: "2–3 gol", from: 2, to: 3, p: 0 },
    { key: "4+", label: "4 gol atau lebih", from: 4, to: null, p: 0 },
  ];
  for (const c of cells) {
    const t = c.home + c.away;
    if (t <= 1) buckets[0].p += c.p;
    else if (t <= 3) buckets[1].p += c.p;
    else buckets[2].p += c.p;
  }
  return buckets.map((b) => ({ ...b, p: Math.round(b.p * 1000) / 1000 }));
}

export function confidenceLevel(
  estimate: PoissonEstimate,
  home: TeamAnalysis,
  away: TeamAnalysis
): "Tinggi" | "Sedang" | "Rendah" {
  const thin =
    (home.overall.played > 0 && home.overall.played < 6) ||
    (away.overall.played > 0 && away.overall.played < 6) ||
    (estimate.sampleHome != null && estimate.sampleHome < 8) ||
    (estimate.sampleAway != null && estimate.sampleAway < 8);
  const ranked = [estimate.pHome, estimate.pDraw, estimate.pAway].sort((a, b) => b - a);
  const maxP = ranked[0] ?? 0;
  const gap = maxP - (ranked[1] ?? 0);
  if (thin) return "Rendah";
  if (maxP >= 0.55 && gap >= 0.15) return "Tinggi";
  if (maxP >= 0.45 && gap >= 0.08) return "Sedang";
  return "Rendah";
}

function outcomePhrase(pick: "H" | "D" | "A" | undefined, home: string, away: string): string {
  if (pick === "H") return `kemenangan ${home}`;
  if (pick === "A") return `kemenangan ${away}`;
  if (pick === "D") return "hasil seri";
  return "hasil yang masih berimbang";
}

function formLine(split: TeamAnalysis["home"], label: string): string | null {
  if (!split.played) return null;
  const gf = split.gfAvg != null ? split.gfAvg.toFixed(2).replace(".", ",") : "—";
  const ga = split.gaAvg != null ? split.gaAvg.toFixed(2).replace(".", ",") : "—";
  return `di ${label} ${split.won} menang, ${split.drawn} seri, ${split.lost} kalah (rata-rata gol ${gf}, kebobolan ${ga})`;
}

export function buildRecommendation(
  match: MatchSummary,
  estimate: PoissonEstimate,
  home: TeamAnalysis,
  away: TeamAnalysis,
  headToHead: HeadToHead
): MatchRecommendation {
  const pick = estimate.pick;
  const p =
    pick === "H" ? estimate.pHome : pick === "A" ? estimate.pAway : pick === "D" ? estimate.pDraw : Math.max(estimate.pHome, estimate.pDraw, estimate.pAway);
  const confidence = estimate.available ? confidenceLevel(estimate, home, away) : "Rendah";
  const outcomeLabel = estimate.available
    ? `${outcomePhrase(pick, match.home.name, match.away.name)} (${pct(p)})`
    : "Estimasi belum tersedia";
  const ranges = goalRangesOf(estimate);
  const topRange = ranges.slice().sort((a, b) => b.p - a.p)[0];
  const btts = pBttsOf(estimate);
  const bttsLean: "ya" | "tidak" | "seimbang" | undefined =
    btts == null ? undefined : btts >= 0.55 ? "ya" : btts <= 0.45 ? "tidak" : "seimbang";

  const bullets: string[] = [];
  if (estimate.available) {
    bullets.push(
      `Hasil paling mungkin menurut model: ${outcomePhrase(pick, match.home.name, match.away.name)} dengan peluang ${pct(p)} dan keyakinan ${confidence.toLowerCase()}.`
    );
    if (estimate.predScore) {
      bullets.push(`Skor yang paling mungkin adalah ${estimate.predScore}.`);
    }
    if (topRange) {
      bullets.push(`Kisaran jumlah gol paling mungkin: ${topRange.label} (${pct(topRange.p)}).`);
    }
    if (btts != null) {
      bullets.push(
        bttsLean === "ya"
          ? `Peluang kedua tim mencetak gol sekitar ${pct(btts)} (lebih condong terjadi).`
          : bttsLean === "tidak"
            ? `Peluang kedua tim mencetak gol sekitar ${pct(btts)} (lebih condong tidak terjadi).`
            : `Peluang kedua tim mencetak gol sekitar ${pct(btts)}, masih berimbang.`
      );
    }
    if (match.status === "in") {
      bullets.push(
        `Estimasi sedang menyesuaikan skor berjalan ${match.home.score ?? "–"}–${match.away.score ?? "–"}${
          estimate.remainingMinutes != null ? ` dengan sisa waktu model sekitar ${Math.round(estimate.remainingMinutes)} menit` : ""
        }. Angka ini bisa berubah cepat.`
      );
    }
  } else {
    bullets.push(estimate.reason || "Model prediksi belum bisa dipasang untuk laga ini.");
  }

  const whyParts: string[] = [];
  if (estimate.available && pick === "H") {
    whyParts.push(
      `Model memberi keunggulan pada ${match.home.name} karena kombinasi kekuatan relatif dan faktor bermain di kandang${
        estimate.homeAdvantage ? ` (faktor ${String(estimate.homeAdvantage).replace(".", ",")})` : ""
      }.`
    );
  } else if (estimate.available && pick === "A") {
    whyParts.push(
      `Meski ada keunggulan kandang, model menilai ${match.away.name} lebih kuat secara relatif, jadi peluangnya mengarah ke kemenangan tandang.`
    );
  } else if (estimate.available && pick === "D") {
    whyParts.push(
      `Kekuatan kedua tim dinilai berdekatan, sehingga model menempatkan seri sebagai hasil yang paling masuk akal atau hampir setara dengan peluang tertinggi.`
    );
  }
  const homeForm = formLine(home.home, "kandang");
  const awayForm = formLine(away.away, "tandang");
  if (homeForm) whyParts.push(`Musim ini ${match.home.name} ${homeForm}.`);
  if (awayForm) whyParts.push(`${match.away.name} ${awayForm}.`);
  const recentHome = home.lastFive.slice(-3);
  if (recentHome.length) {
    const w = recentHome.filter((g) => g.result === "W").length;
    whyParts.push(
      `Tiga laga terakhir ${match.home.name}: ${recentHome.map((g) => (g.result === "W" ? "M" : g.result === "D" ? "S" : "K")).join("-")} (${w} menang).`
    );
  }
  const h2h = headToHead.matches.filter((m) => m.result);
  if (h2h.length >= 3) {
    const wins = h2h.filter((m) => m.result === "W").length;
    const losses = h2h.filter((m) => m.result === "L").length;
    whyParts.push(
      `Dalam ${h2h.length} pertemuan yang tercatat (dari sisi ${match.home.name}): ${wins} menang, ${h2h.length - wins - losses} seri, ${losses} kalah.`
    );
  }
  if (!whyParts.length) {
    whyParts.push("Penjelasan lebih rinci belum bisa disusun karena data form atau model masih terbatas.");
  }
  whyParts.push("Ini ringkasan estimasi statistik, bukan kepastian hasil.");

  const caveats: string[] = [];
  if (home.overall.played < 6 || away.overall.played < 6) {
    caveats.push("Sampel pertandingan selesai masih tipis, jadi estimasi bisa berubah cepat.");
  }
  if (confidence === "Rendah" && estimate.available) {
    caveats.push("Peluang ketiga hasil masih berdekatan, atau jejak data salah satu tim belum cukup dalam.");
  }
  if (match.status === "in") {
    caveats.push("Prediksi berjalan bersifat sementara dan mengikuti skor serta menit yang dikirim sumber data.");
  }
  if (!estimate.available) {
    caveats.push("Tanpa model yang terpasang, rekomendasi tidak dapat disusun secara penuh.");
  }

  const headline = estimate.available
    ? `Estimasi utama: ${outcomePhrase(pick, match.home.name, match.away.name)} · keyakinan ${confidence}`
    : "Estimasi belum tersedia";

  return {
    confidence,
    headline,
    outcomeLabel,
    outcomeP: p,
    predScore: estimate.predScore,
    goalRange: topRange
      ? { from: topRange.from, to: topRange.to, p: topRange.p, label: topRange.label }
      : undefined,
    btts: btts != null && bttsLean ? { p: btts, lean: bttsLean } : undefined,
    bullets,
    why: whyParts.join(" "),
    caveats,
    disclaimer:
      "Semua angka adalah estimasi statistik untuk analisis, bukan saran taruhan, bukan pasaran, dan tidak terkait uang atau hadiah.",
  };
}

export function attachEstimateExtras(estimate: PoissonEstimate): PoissonEstimate {
  const pBtts = pBttsOf(estimate);
  return { ...estimate, pBtts };
}
