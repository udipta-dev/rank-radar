"use client";

import { useState } from "react";
import TrajectoryChart from "@/components/TrajectoryChart";
import RankHistogram from "@/components/RankHistogram";
import CoverageChart from "@/components/CoverageChart";
import type { WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Charts</h1>
        <p className="text-sm text-[var(--fg-dim)]">
          Interactive views of the rank dataset. Click any legend pill to hide/show that line, hover
          for exact values, drag to range-select.
        </p>
      </header>

      <Section
        title="Rank trajectories — top 20 climbers"
        blurb="Each line is one coin's CMC rank over time. Y-axis is inverted so up = better rank. Toggle the mode to see overall climbers (full window) vs bear-period climbers."
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
        blurb="How many coins climbed vs declined, and by how much. Green = climbed (positive Δ rank), red = declined. Hover any bar to see sample symbols in that bucket."
      >
        <RankHistogram rows={[
          ...d.tables.climbersOverall,
          ...d.tables.persistentDecliners,
          ...d.tables.stableHolders,
        ]} />
      </Section>

      <Section
        title="Capture coverage + total top-200 mcap"
        blurb="Top line: coins per snapshot (the post-filter universe). Bottom line: sum of top-200 market cap in trillions (used to detect the bear window). The dip at the start of 2026 is the bear we surfaced."
      >
        <CoverageChart rows={d.coverage} />
      </Section>
    </div>
  );
}
