export type ClimberRow = {
  symbol: string;
  name: string;
  first_date: string;
  last_date: string;
  snapshots: number;
  start_rank: number;
  end_rank: number;
  best_rank: number;
  worst_rank: number;
  avg_mcap_usd: number;
  rank_delta: number;
  // FDV / float fields (present on all rows after analyze.py upgrade)
  current_mcap_usd?: number;
  current_fdv_usd?: number;
  current_mc_fdv?: number;
  max_supply?: number | null;
  circulating_supply?: number | null;
  is_capped?: boolean;
  dilution_multiple?: number;
  // staleness (coin hasn't been in top 200 within ~14d of latest snapshot)
  days_since_last_seen?: number;
  is_stale?: boolean;
  // quiet accumulators extra
  bear_delta?: number;
  gap_to_best?: number;
  // stable holders extra
  rank_range?: number;
};

export type TrajectoryPoint = {
  date: string;
  rank: number;
  mcap: number | null;
  price: number | null;
};

export type CurrentMetrics = {
  mcap: number | null;
  fdv: number | null;
  mcFdv: number | null;
  price: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  isCapped: boolean;
};

export type Momentum = {
  currentRank: number;
  d1: number | null;
  d7: number | null;
  d30: number | null;
};

export type TrendingCoin = {
  id: string | null;
  symbol: string;
  name: string | null;
  count1h: number;
  count6h: number;
  count24h: number;
  count7d: number;
  count30d: number;
  weightedScore24h: number;
  weightedScore7d: number;
  weightedScore30d: number;
  lastSeen: string | null;
  firstSeen: string | null;
  dailyCounts: number[]; // 30 buckets, oldest -> newest
  bestPosition: number;  // lowest score seen (0 = top of trending list)
};

export type FadeAlert = {
  symbol: string;
  name: string | null;
  priorHits: number;
  recentHits: number;
  drop: number;
};

export type TrendingItem = {
  id: string | null;
  name: string | null;
  count24h: number;
  count7d: number;
  count30d: number;
  weightedScore24h: number;
  weightedScore7d: number;
  weightedScore30d: number;
  lastSeen: string | null;
  firstSeen: string | null;
  dailyCounts: number[];
  bestPosition: number;
};

export type TrendingSubData = {
  latestSnapshotTs: string | null;
  snapshotCount: number;
  listSize: number;
  latestNow: { id: string | null; name: string | null; score: number | null }[];
  perItem: Record<string, TrendingItem>;
};

export type CrossSourceWindows = { h1: number; h6: number; d1: number; d7: number };

export type CrossSourceCoin = {
  symbol: string;
  cg: CrossSourceWindows;
  cmc: CrossSourceWindows;
  farcaster: CrossSourceWindows;
  reddit: CrossSourceWindows;
  sourceCount24h: number;
  totalMentions24h: number;
};

export type CrossSourceBuzz = {
  perCoin: Record<string, CrossSourceCoin>;
  snapshotCountsBySource: { cg: number; cmc: number; farcaster: number; reddit: number };
  generatedAt: string;
};

export type TrendingData = {
  latestSnapshotTs: string | null;
  snapshotCount30d: number;
  trendingNow: { symbol: string; name: string | null; id: string | null; score: number | null }[];
  perCoin: Record<string, TrendingCoin>;
  heatmap: {
    symbols: string[];
    timestamps: string[];
    matrix: (number | null)[][];
  };
  newEntrants: string[];
  fadeAlerts: FadeAlert[];
  nfts: TrendingSubData;
  categories: TrendingSubData;
};

export type BearWindow = {
  peak: string;
  trough: string;
  drawdownPct: number;
  peakMcap: number;
  troughMcap: number;
};

export type Market = {
  totalMcapUsd: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  btcDominance: number | null;
  ethDominance: number | null;
  totalVolUsd: number | null;
  regime: "risk-off" | "risk-on" | "neutral" | "unknown";
  latestTs: string | null;
  sparkline: number[];
  snapshotCount: number;
};

export type WebData = {
  metadata: {
    generatedAt: string;
    firstDate: string;
    lastDate: string;
    snapshotCount: number;
    coinCount: number;
    bearWindow: BearWindow;
  };
  tables: {
    climbersOverall: ClimberRow[];
    climbersBear: ClimberRow[];
    quietAccumulators: ClimberRow[];
    persistentDecliners: ClimberRow[];
    stableHolders: ClimberRow[];
    overhangRisk: ClimberRow[];
    lowFloatDecliners: ClimberRow[];
    highConvictionClimbers: ClimberRow[];
  };
  trajectories: Record<string, TrajectoryPoint[]>;
  nameMap: Record<string, string>;
  currentMetrics: Record<string, CurrentMetrics>;
  momentum: Record<string, Momentum>;
  trending: TrendingData;
  crossSource?: CrossSourceBuzz;
  market?: Market;
  heatmap: {
    symbols: string[];
    dates: string[];
    matrix: (number | null)[][];
  };
  coverage: { date: string; coins: number; totalMcap: number }[];
  summaryMd: string;
  insights?: {
    home?: string;
    movements?: string;
    trending?: string;
    narratives?: string;
  };
  // UTC ISO timestamp per insight key, set when that note was actually generated
  insightsGeneratedAt?: Record<string, string>;
};
