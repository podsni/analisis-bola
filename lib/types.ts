export type StandingRow = {
  rank: number;
  teamId: string;
  team: string;
  logo?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  note?: string;
  form?: Array<"W" | "D" | "L">;
  spark?: number[];
};

export type MatchEvent = {
  minute: string;
  type: string;
  player?: string;
  teamId?: string;
  team?: string;
  scoring: boolean;
  text: string;
  period?: number;
};

export type MatchSummary = {
  id: string;
  dateUtc: string;
  dateWib: string;
  timeWib: string | null;
  timeValid: boolean;
  status: "pre" | "in" | "post" | "unknown";
  clock?: string | null;
  period?: number;
  detail?: string;
  venue?: string;
  season?: string;
  home: { id: string; name: string; score?: string | null; logo?: string };
  away: { id: string; name: string; score?: string | null; logo?: string };
  events?: MatchEvent[];
  halfTime?: { home: number; away: number } | null;
  secondHalf?: { home: number; away: number } | null;
};

export type Scorer = {
  rank: number;
  player: string;
  team: string;
  teamId?: string;
  goals: number;
  matches?: string;
  assists?: string;
};

export type TeamFormItem = {
  id: string;
  dateWib: string;
  opponent: string;
  homeAway: "home" | "away";
  scored: number;
  conceded: number;
  result: "W" | "D" | "L";
};

export type TeamSplit = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gfAvg: number | null;
  gaAvg: number | null;
};

export type TeamAnalysis = {
  id: string;
  name: string;
  lastFive: TeamFormItem[];
  overall: TeamSplit;
  home: TeamSplit;
  away: TeamSplit;
  sampleNote?: string;
  cleanSheets?: number;
  failedToScore?: number;
  cleanSheetRate?: number | null;
  failedToScoreRate?: number | null;
  homeCleanSheets?: number;
  awayCleanSheets?: number;
  homeFailedToScore?: number;
  awayFailedToScore?: number;
  goalsTrend?: GoalPoint[];
};

export type HeadToHeadMatch = TeamFormItem & {
  dateUtc?: string;
  season?: string;
  homeName?: string;
  awayName?: string;
  homeLogo?: string;
  awayLogo?: string;
};

export type HeadToHead = {
  matches: HeadToHeadMatch[];
  note: string;
  summary?: string;
};

export type TeamMatchStats = {
  teamId: string;
  team: string;
  shots?: number;
  shotsOnTarget?: number;
  possession?: number;
  yellow?: number;
  red?: number;
  corners?: number;
  passes?: number;
  passPct?: number;
  fouls?: number;
  offsides?: number;
  saves?: number;
  expectedGoals?: number | null;
  blockedShots?: number;
  tackles?: number;
  interceptions?: number;
  clearances?: number;
  crosses?: number;
};

export type GoalPoint = { dateWib: string; gf: number; ga: number; opponent: string };
export type PointsPoint = { dateWib: string; points: number; label: string };

export type SeasonAggregate = {
  overall: TeamSplit;
  home: TeamSplit;
  away: TeamSplit;
  lastFive: TeamFormItem[];
  cleanSheets: number;
  failedToScore: number;
  biggestWin?: TeamFormItem;
  biggestLoss?: TeamFormItem;
  pointsProgression: PointsPoint[];
  goalsTrend: GoalPoint[];
};

export type SeasonHistory = {
  year: string;
  label: string;
  matches: MatchSummary[];
  analysis: SeasonAggregate;
};

export type TeamInfo = {
  id: string;
  name: string;
  logo?: string;
  color?: string;
  alternateColor?: string;
  recordSummary?: string;
  standingSummary?: string;
};

export type TeamPagePayload = {
  slug: string;
  leagueName: string;
  source: string;
  fetchedAtWib: string;
  team: TeamInfo;
  current: SeasonHistory;
  previous: SeasonHistory[];
  limitedNote?: string;
};

export type ScoreCell = {
  home: number;
  away: number;
  remainingHome?: number;
  remainingAway?: number;
  p: number;
};

export type TeamStrength = {
  id: string;
  name: string;
  attack: number;
  defense: number;
  matches: number;
};

export type HistMatch = {
  id: string;
  dateUtc: string;
  dateWib: string;
  season?: string;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
};

export type FittedModel = {
  teams: Record<string, TeamStrength>;
  homeAdvantage: number;
  mu: number;
  rho: number;
  halfLifeDays: number;
  samples: number;
  asOfUtc?: string;
  method: string;
};

export type PoissonEstimate = {
  available: boolean;
  reason?: string;
  lambdaHome: number;
  lambdaAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  method: string;
  mode?: "pre" | "in" | "post";
  remainingMinutes?: number;
  currentHome?: number;
  currentAway?: number;
  homeAdvantage?: number;
  rho?: number;
  mu?: number;
  scoreMatrix?: ScoreCell[];
  topScores?: ScoreCell[];
  confidence?: string;
  sampleHome?: number;
  sampleAway?: number;
  pick?: "H" | "D" | "A";
  predScore?: string;
  oneXtwoHasil?: "TEPAT" | "MELESET";
  scoreHasil?: "TEPAT" | "MELESET";
  pBtts?: number;
};

export type ModelContribution = {
  id: string;
  dateWib: string;
  dateUtc: string;
  opponent: string;
  homeAway: "home" | "away";
  score: string;
  result: "W" | "D" | "L";
  weight: number;
  formBoost: boolean;
};

export type MatchContributions = {
  home: { teamId: string; teamName: string; matches: ModelContribution[] };
  away: { teamId: string; teamName: string; matches: ModelContribution[] };
  asOfWib: string;
  note: string;
};

export type CalibrationBin = {
  from: number;
  to: number;
  count: number;
  avgPredicted: number;
  observed: number;
};

export type BacktestRow = {
  id: string;
  dateWib: string;
  dateUtc: string;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  score: string;
  actual: "H" | "D" | "A";
  predicted: "H" | "D" | "A";
  correct: boolean;
  pHome: number;
  pDraw: number;
  pAway: number;
  lambdaHome: number;
  lambdaAway: number;
  brier: number;
  logLoss: number;
  predScore?: string;
  scoreCorrect?: boolean;
};

export type BacktestResult = {
  available: boolean;
  reason?: string;
  n: number;
  accuracy: number;
  brier: number;
  logLoss: number;
  correct: number;
  exactCorrect: number;
  exactAccuracy: number;
  predictedDraws: number;
  byOutcome: {
    H: { n: number; correct: number };
    D: { n: number; correct: number };
    A: { n: number; correct: number };
  };
  calibration: CalibrationBin[];
  rows: BacktestRow[];
  method: string;
};

export type LeagueModelPayload = {
  available: boolean;
  reason?: string;
  homeAdvantage?: number;
  mu?: number;
  rho?: number;
  samples?: number;
  halfLifeDays?: number;
  asOfWib?: string;
  method: string;
  backtest?: BacktestResult;
  upcoming?: { matchId: string; estimate: PoissonEstimate }[];
  strengths?: TeamStrength[];
};

export type TickerItem = {
  slug: string;
  league: string;
  matchId: string;
  text: string;
  status: "pre" | "in" | "post" | "unknown";
  dateUtc: string;
};

export type CommandTeam = {
  id: string;
  name: string;
  slug: string;
  league: string;
  logo?: string;
  codes: string[];
};

export type LeaguePayload = {
  slug: string;
  name: string;
  country: string;
  seasonName: string;
  source: string;
  sourceNote?: string;
  fetchedAtWib: string;
  limited?: boolean;
  limitedNote?: string;
  standings: StandingRow[];
  recent: MatchSummary[];
  upcoming: MatchSummary[];
  scorers: Scorer[];
  scorersNote?: string;
  model?: LeagueModelPayload;
  estimates?: Record<string, PoissonEstimate>;
};


export type LineupPlayer = {
  id: string;
  name: string;
  jersey?: string;
  position?: string;
  starter: boolean;
  formationPlace?: number;
  subbedIn?: boolean;
  subbedOut?: boolean;
};

export type TeamLineup = {
  teamId: string;
  team: string;
  formation?: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
};

export type MatchRecommendation = {
  confidence: "Tinggi" | "Sedang" | "Rendah";
  headline: string;
  outcomeLabel: string;
  outcomeP: number;
  predScore?: string;
  goalRange?: { from: number; to: number | null; p: number; label: string };
  btts?: { p: number; lean: "ya" | "tidak" | "seimbang" };
  bullets: string[];
  why: string;
  caveats: string[];
  disclaimer: string;
};

export type MatchAnalysisPayload = {
  slug: string;
  leagueName: string;
  source: string;
  fetchedAtWib: string;
  match: MatchSummary;
  home: TeamAnalysis;
  away: TeamAnalysis;
  headToHead: HeadToHead;
  estimate: PoissonEstimate;
  scorers: { home: Scorer[]; away: Scorer[] };
  limitedNote?: string;
  matchStats?: { home: TeamMatchStats; away: TeamMatchStats };
  contributions?: MatchContributions;
  lineups?: { home: TeamLineup; away: TeamLineup };
  recommendation?: MatchRecommendation;
};

export type LiveMatchCard = {
  slug: string;
  leagueName: string;
  match: MatchSummary;
  estimate: PoissonEstimate;
};

export type LivePayload = {
  fetchedAtWib: string;
  fetchedAtMs: number;
  pollSeconds: number;
  live: LiveMatchCard[];
  upcoming: LiveMatchCard[];
  note?: string;
};

export type TotalsSide = "Atas" | "Bawah";

export type TotalsPick = {
  side: TotalsSide;
  line: number;
  p: number;
  label: string;
  belowThreshold: boolean;
};

export type PredictionLogRow = {
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
  score: string | null;
  totalGoals: number | null;
  status: "post" | "pre" | "in";
  hasil: "TEPAT" | "MELESET" | "MENUNGGU";
  totals: TotalsPick;
  oneXtwoPick: "H" | "D" | "A";
  oneXtwoLabel: string;
  oneXtwoP: number;
  oneXtwoHasil?: "TEPAT" | "MELESET";
  predScore?: string;
  scoreHasil?: "TEPAT" | "MELESET";
  pHome: number;
  pDraw: number;
  pAway: number;
  predictionText: string;
};

export type LineBreakdown = {
  key: string;
  n: number;
  tepat: number;
  accuracy: number;
};

export type PredictionLogSummary = {
  n: number;
  tepat: number;
  meleset: number;
  accuracy: number;
  waiting: number;
  byLine: LineBreakdown[];
  calibration: CalibrationBin[];
  oneXtwoTepat?: number;
  oneXtwoAccuracy?: number;
  scoreTepat?: number;
  scoreAccuracy?: number;
};

export type PredictionLogPayload = {
  available: boolean;
  reason?: string;
  slug?: string;
  leagueName?: string;
  fetchedAtWib: string;
  method: string;
  summary: PredictionLogSummary;
  rows: PredictionLogRow[];
};
