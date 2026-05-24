"use client";
import RankTable from "@/components/RankTable";
import type { WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

export default function DeclinersPage() {
  const tables = d.tables;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Persistent decliners</h1>
        <p className="text-sm text-[var(--fg-dim)] max-w-2xl">
          Coins that have lost rank steadily across the full window. Useful as a negative screen and
          to spot projects that may be dead.
        </p>
      </div>
      <RankTable rows={tables.persistentDecliners} defaultSort="rank_delta" defaultDir="asc" />
    </div>
  );
}
