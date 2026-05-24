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

export type BearWindow = {
  peak: string;
  trough: string;
  drawdownPct: number;
  peakMcap: number;
  troughMcap: number;
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
  heatmap: {
    symbols: string[];
    dates: string[];
    matrix: (number | null)[][];
  };
  coverage: { date: string; coins: number; totalMcap: number }[];
  summaryMd: string;
};
