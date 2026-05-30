"use client";

import { useState } from "react";
import RankTable from "@/components/RankTable";
import InsightCard from "@/components/InsightCard";
import type { WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

type Tab = "overall" | "bear" | "decliners";

const tabs: { k: Tab; label: string; blurb: string }[] = [
  {
    k: "overall",
    label: "Climbers (full window)",
    blurb: "Biggest rank improvements from start of capture to today.",
  },
  {
    k: "bear",
    label: "Climbers (bear window)",
    blurb: "Biggest rank improvements during the auto-detected bear period — relative-strength screen.",
  },
  {
    k: "decliners",
    label: "Decliners",
    blurb: "Steady rank loss across the full window. Negative screen + dead-project detector.",
  },
];

export default function MovementsPage() {
  const [tab, setTab] = useState<Tab>("overall");
  const rows =
    tab === "overall"
      ? d.tables.climbersOverall
      : tab === "bear"
        ? d.tables.climbersBear
        : d.tables.persistentDecliners;
  const meta = tabs.find((t) => t.k === tab)!;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Movements</h1>
        <p className="text-sm text-[var(--fg-dim)]">
          Coins that have moved the most in rank. Negative Δ = rank got worse, positive = climbed.
        </p>
      </div>

      <InsightCard text={d.insights?.movements} generatedAt={d.metadata.generatedAt} />

      <div className="flex gap-2 border-b border-[var(--border)] pb-3 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-3 py-1.5 text-sm rounded border ${
              tab === t.k
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--fg-dim)] max-w-3xl border-l-2 border-[var(--accent)] pl-3">
        {meta.blurb}
      </p>

      <RankTable
        rows={rows}
        defaultSort="rank_delta"
        defaultDir={tab === "decliners" ? "asc" : "desc"}
      />
    </div>
  );
}
