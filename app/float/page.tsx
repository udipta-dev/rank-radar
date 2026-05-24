"use client";

import { useState } from "react";
import RankTable from "@/components/RankTable";
import type { WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

type Tab = "death-watch" | "survivors" | "overhang";

const tabs: { k: Tab; label: string; blurb: string }[] = [
  {
    k: "death-watch",
    label: "Death watch",
    blurb:
      "Already declining in rank AND have heavy unlock pressure (<40% of supply circulating). Per your thesis: low-float tokens die before they survive.",
  },
  {
    k: "survivors",
    label: "Survivors",
    blurb:
      "Climbed +15 ranks or more DESPITE having <50% float. Buyers absorbing unlocks and pushing rank up. Strongest survival signal.",
  },
  {
    k: "overhang",
    label: "Overhang risk (all)",
    blurb:
      "Coins with the lowest current float regardless of trajectory. Lower float = more supply to come = bigger potential dilution drag. Capped tokens only.",
  },
];

const lowFloatCols = [
  { key: "symbol" as const, label: "Symbol" },
  { key: "name" as const, label: "Name" },
  { key: "end_rank" as const, label: "Rank", numeric: true },
  { key: "rank_delta" as const, label: "Δ rank", numeric: true, formatType: "delta" as const },
  { key: "current_mc_fdv" as const, label: "Float %", numeric: true, formatType: "pct" as const },
  { key: "current_mcap_usd" as const, label: "MCAP", numeric: true, formatType: "mcap" as const },
  { key: "current_fdv_usd" as const, label: "FDV", numeric: true, formatType: "mcap" as const },
  { key: "snapshots" as const, label: "Weeks", numeric: true },
];

export default function FloatPage() {
  const [tab, setTab] = useState<Tab>("death-watch");
  const rows =
    tab === "death-watch"
      ? d.tables.lowFloatDecliners
      : tab === "survivors"
        ? d.tables.highConvictionClimbers
        : d.tables.overhangRisk;

  const defaultSort: keyof (typeof rows)[0] =
    tab === "death-watch" ? "rank_delta" : tab === "survivors" ? "rank_delta" : "current_mc_fdv";
  const defaultDir: "asc" | "desc" = tab === "overhang" || tab === "death-watch" ? "asc" : "desc";

  const meta = tabs.find((t) => t.k === tab)!;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Float / unlock risk</h1>
        <p className="text-sm text-[var(--fg-dim)] max-w-3xl">
          Float % = circulating supply / max supply = MCAP / FDV. Low float means most of the
          eventual supply hasn&apos;t hit the market yet. Coins with low float that can&apos;t
          absorb unlock pressure tend to fade hardest.
        </p>
      </div>

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
            {t.label} ({rows.length})
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--fg-dim)] max-w-3xl border-l-2 border-[var(--accent)] pl-3">
        {meta.blurb}
      </p>

      <RankTable
        rows={rows}
        columns={lowFloatCols}
        defaultSort={defaultSort as never}
        defaultDir={defaultDir}
      />
    </div>
  );
}
