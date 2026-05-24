"use client";
import RankTable from "@/components/RankTable";
import type { WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

export default function HoldersPage() {
  const tables = d.tables;
  const cols = [
    { key: "symbol" as const, label: "Symbol" },
    { key: "name" as const, label: "Name" },
    { key: "best_rank" as const, label: "Best rank", numeric: true },
    { key: "worst_rank" as const, label: "Worst rank", numeric: true },
    { key: "rank_range" as const, label: "Range", numeric: true },
    { key: "end_rank" as const, label: "Current rank", numeric: true },
    { key: "snapshots" as const, label: "Weeks", numeric: true },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Stable holders</h1>
        <p className="text-sm text-[var(--fg-dim)] max-w-2xl">
          Coins whose rank barely moved across the entire period. The established tier. Low rank
          range = consistent presence.
        </p>
      </div>
      <RankTable rows={tables.stableHolders} columns={cols} defaultSort="rank_range" defaultDir="asc" />
    </div>
  );
}
