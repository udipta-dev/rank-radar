"use client";

import { useState } from "react";
import RankTable from "@/components/RankTable";
import type { WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

export default function ClimbersPage() {
  const [mode, setMode] = useState<"overall" | "bear">("overall");
  const rows = mode === "overall" ? d.tables.climbersOverall : d.tables.climbersBear;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Climbers</h1>
        <p className="text-sm text-[var(--fg-dim)]">
          Coins that improved their CMC rank the most. Negative Δ means rank got worse.
        </p>
      </div>

      <div className="flex gap-2 border-b border-[var(--border)] pb-3">
        {[
          { k: "overall", label: `Full window (${d.metadata.firstDate} → ${d.metadata.lastDate})` },
          { k: "bear", label: `Bear window (${d.metadata.bearWindow.peak.slice(0, 10)} → ${d.metadata.bearWindow.trough.slice(0, 10)})` },
        ].map((b) => (
          <button
            key={b.k}
            onClick={() => setMode(b.k as "overall" | "bear")}
            className={`px-3 py-1.5 text-sm rounded border ${
              mode === b.k
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <RankTable rows={rows} />
    </div>
  );
}
