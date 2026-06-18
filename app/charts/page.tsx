"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { TrendingCoin, WebData } from "@/lib/types";
import data from "@/data/web.json";

// Render the visualizations client-only (ssr: false). They draw thousands of
// SVG/heatmap nodes — the trending heatmap alone covers every coin × every
// 30-min snapshot and grows ~48 columns/day — and server-prerendering that DOM
// blew past Vercel's 19 MB ISR limit (FALLBACK_BODY_TOO_LARGE). These charts
// have no SEO value as server HTML and recharts wants the client anyway, so
// deferring them keeps the prerendered page a tiny shell that can't outgrow the
// limit again.
const ChartLoading = () => (
  <div className="h-64 grid place-items-center text-xs text-[var(--fg-dim)]">Loading chart…</div>
);
const TrajectoryChart = dynamic(() => import("@/components/TrajectoryChart"), { ssr: false, loading: ChartLoading });
const RankHistogram = dynamic(() => import("@/components/RankHistogram"), { ssr: false, loading: ChartLoading });
const CoverageChart = dynamic(() => import("@/components/CoverageChart"), { ssr: false, loading: ChartLoading });
const TrendingHeatmap = dynamic(() => import("@/components/TrendingHeatmap"), { ssr: false, loading: ChartLoading });
const DivergenceChart = dynamic(() => import("@/components/DivergenceChart"), { ssr: false, loading: ChartLoading });
const Heatmap = dynamic(() => import("@/components/Heatmap"), { ssr: false, loading: ChartLoading });

const d = data as unknown as WebData;

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
      <h2 className="font-bold mb-1">{title}</h2>
      <p className="text-xs text-[var(--fg-dim)] mb-3 max-w-3xl">{blurb}</p>
      {children}
    </section>
  );
}

export default function ChartsPage() {
  const [climberMode, setClimberMode] = useState<"overall" | "bear">("overall");
  const climberTable =
    climberMode === "overall" ? d.tables.climbersOverall : d.tables.climbersBear;
  const symbols = climberTable.slice(0, 20).map((r) => r.symbol);
  const series = symbols
    .filter((s) => d.trajectories[s])
    .map((s) => ({ symbol: s, data: d.trajectories[s] }));

  // weighted persistence leaderboard
  const persistenceRows = useMemo(() => {
    const all: TrendingCoin[] = Object.values(d.trending?.perCoin || {});
    return [...all].sort((a, b) => b.weightedScore7d - a.weightedScore7d).slice(0, 20);
  }, []);

  // divergence scatter
  const divergencePoints = useMemo(() => {
    const points: { symbol: string; name: string | null; rankDelta7d: number; trendingHits7d: number }[] = [];
    for (const [sym, mom] of Object.entries(d.momentum || {})) {
      if (mom.d7 == null) continue;
      const trend = d.trending?.perCoin?.[sym];
      points.push({
        symbol: sym,
        name: d.nameMap[sym] ?? null,
        rankDelta7d: mom.d7,
        trendingHits7d: trend?.count7d ?? 0,
      });
    }
    return points;
  }, []);

  const trending = d.trending;
  const newEntrants = trending?.newEntrants ?? [];
  const fadeAlerts = trending?.fadeAlerts ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Visualize</h1>
        <p className="text-sm text-[var(--fg-dim)]">
          Interactive views: structural rank trajectories, the rank heatmap, distribution
          shape, and attention dynamics from CoinGecko trending.
        </p>
      </header>

      <Section
        title="Rank heatmap (top 50 current)"
        blurb="Rows = today's top 50 by rank. Columns = weekly snapshots. Brighter green = better rank. Hover any row to focus it."
      >
        <Heatmap
          symbols={d.heatmap.symbols}
          dates={d.heatmap.dates}
          matrix={d.heatmap.matrix}
        />
      </Section>

      {/* ---- Rank section ---- */}
      <Section
        title="Rank trajectories — top 20 climbers"
        blurb="Each line is one coin's CMC rank over time. Y-axis inverted: up = better. Toggle to compare full-window vs bear-window climbers."
      >
        <div className="flex gap-2 mb-3">
          {[
            { k: "overall", label: "Full window" },
            { k: "bear", label: "Bear window only" },
          ].map((b) => (
            <button
              key={b.k}
              onClick={() => setClimberMode(b.k as "overall" | "bear")}
              className={`px-3 py-1 text-xs rounded border ${
                climberMode === b.k
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--fg-dim)]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <TrajectoryChart
          series={series}
          bearWindow={climberMode === "bear" ? d.metadata.bearWindow : undefined}
        />
      </Section>

      <Section
        title="Distribution of rank deltas"
        blurb="How many coins climbed vs declined. Green = climbed, red = declined. Hover any bar for sample symbols."
      >
        <RankHistogram
          rows={[
            ...d.tables.climbersOverall,
            ...d.tables.persistentDecliners,
            ...d.tables.stableHolders,
          ]}
        />
      </Section>

      <Section
        title="Capture coverage + total top-200 mcap"
        blurb="Top: coins per snapshot. Bottom: sum of top-200 mcap ($T). The dip identifies the bear window."
      >
        <CoverageChart rows={d.coverage} />
      </Section>

      {/* ---- Trending section ---- */}
      <div className="pt-4 border-t border-[var(--border)]">
        <h2 className="text-xl font-bold mb-1">Attention (CoinGecko trending)</h2>
        <p className="text-xs text-[var(--fg-dim)] mb-4">
          Captured every 30 min into the trending-data branch. Aggregates refresh once daily
          at 02:00 UTC. Persistence and fades become meaningful after ~7 days of data.
          Currently have {trending?.snapshotCount30d ?? 0} snapshots.
        </p>
      </div>

      <Section
        title="Trending heatmap"
        blurb="Rows = every coin that has ever been on the trending list. Columns = each captured snapshot. Brighter green = closer to #1 on the trending list. Solid horizontal bands = sustained attention. Vertical clusters = single-day pumps."
      >
        <TrendingHeatmap
          symbols={trending?.heatmap?.symbols ?? []}
          timestamps={trending?.heatmap?.timestamps ?? []}
          matrix={trending?.heatmap?.matrix ?? []}
        />
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section
          title="New entrants (last 48h)"
          blurb="Coins on the trending list right now that didn't appear in any snapshot in the prior 48h. Pre-pump candidates worth investigating."
        >
          {newEntrants.length === 0 ? (
            <div className="text-sm text-[var(--fg-dim)]">
              {trending?.snapshotCount30d
                ? "No new entrants — everyone currently trending has been on the list recently."
                : "Need more snapshots to detect new entrants."}
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {newEntrants.map((s) => (
                <li key={s}>
                  <Link
                    href={`/coin/${encodeURIComponent(s)}`}
                    className="inline-block px-2 py-1 rounded border border-[var(--accent)] text-[var(--accent)] text-sm font-mono hover:bg-[var(--accent)] hover:text-black"
                  >
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Fade alerts"
          blurb="Coins that had ≥5 trending hits over the prior 7d but ≤1 hit in the last 24h. Attention rolling over — often correlates with price tops."
        >
          {fadeAlerts.length === 0 ? (
            <div className="text-sm text-[var(--fg-dim)]">
              {trending?.snapshotCount30d > 50
                ? "No fades right now."
                : "Need ~7 days of data before fades become meaningful."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[var(--fg-dim)]">
                <tr>
                  <th className="text-left py-1">Symbol</th>
                  <th className="text-right">Prior 7d</th>
                  <th className="text-right">Last 24h</th>
                  <th className="text-right">Drop</th>
                </tr>
              </thead>
              <tbody>
                {fadeAlerts.map((r) => (
                  <tr key={r.symbol} className="border-t border-[var(--border)]">
                    <td className="py-1.5">
                      <Link
                        href={`/coin/${encodeURIComponent(r.symbol)}`}
                        className="font-mono font-semibold hover:text-[var(--accent)]"
                      >
                        {r.symbol}
                      </Link>
                    </td>
                    <td className="text-right font-mono">{r.priorHits}</td>
                    <td className="text-right font-mono">{r.recentHits}</td>
                    <td className="text-right font-mono text-[var(--danger)]">−{r.drop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section
        title="Weighted persistence leaderboard (7d)"
        blurb="Like the persistence table, but each hit is weighted by trending list position. A coin always at #1 scores 15× per hit, a coin always at #15 scores 1×. Better signal of true heat."
      >
        {persistenceRows.length === 0 ? (
          <div className="text-sm text-[var(--fg-dim)]">No trending data yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[var(--fg-dim)]">
              <tr>
                <th className="text-left py-1">Symbol</th>
                <th className="text-left">Name</th>
                <th className="text-right">Score 7d</th>
                <th className="text-right">Hits 7d</th>
                <th className="text-right">Best position</th>
              </tr>
            </thead>
            <tbody>
              {persistenceRows.map((r) => (
                <tr key={r.symbol} className="border-t border-[var(--border)]">
                  <td className="py-1.5">
                    <Link
                      href={`/coin/${encodeURIComponent(r.symbol)}`}
                      className="font-mono font-semibold hover:text-[var(--accent)]"
                    >
                      {r.symbol}
                    </Link>
                  </td>
                  <td className="text-[var(--fg-dim)] truncate max-w-xs">{r.name}</td>
                  <td className="text-right font-mono">{r.weightedScore7d}</td>
                  <td className="text-right font-mono">{r.count7d}</td>
                  <td className="text-right font-mono">
                    {r.bestPosition < 999 ? `#${r.bestPosition + 1}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Divergence quadrant: rank momentum vs trending attention"
        blurb="Every coin plotted by 7d rank Δ (X) vs 7d trending hits (Y). Top-right = real momentum (climbing AND noticed). Top-left = hype not converting. Bottom-right = quiet accumulators (the existing bucket, validated). Bottom = dead."
      >
        <DivergenceChart points={divergencePoints} />
      </Section>
    </div>
  );
}
