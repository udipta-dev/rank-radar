"use client";
import RankTable from "@/components/RankTable";
import type { WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

export default function QuietPage() {
  const tables = d.tables;
  const cols = [
    { key: "symbol" as const, label: "Symbol" },
    { key: "name" as const, label: "Name" },
    { key: "bear_delta" as const, label: "Bear Δ", numeric: true, formatType: "delta" as const },
    { key: "start_rank" as const, label: "Start rank", numeric: true },
    { key: "end_rank" as const, label: "End rank", numeric: true },
    { key: "best_rank" as const, label: "Best ever", numeric: true },
    { key: "gap_to_best" as const, label: "Gap to best", numeric: true },
    { key: "snapshots" as const, label: "Weeks", numeric: true },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Quiet accumulators</h1>
        <p className="text-sm text-[var(--fg-dim)] max-w-2xl">
          Coins that climbed during the bear window but whose current rank is still well below their
          historical best. The thesis: their re-rating hasn&apos;t played out yet.
        </p>
      </div>
      <RankTable rows={tables.quietAccumulators} columns={cols} defaultSort="bear_delta" defaultDir="desc" />
    </div>
  );
}
