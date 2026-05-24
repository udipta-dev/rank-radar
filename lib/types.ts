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
  };
  trajectories: Record<string, TrajectoryPoint[]>;
  nameMap: Record<string, string>;
  heatmap: {
    symbols: string[];
    dates: string[];
    matrix: (number | null)[][];
  };
  coverage: { date: string; coins: number; totalMcap: number }[];
  summaryMd: string;
};
