"use client";

import PersistenceTable from "@/components/PersistenceTable";
import type { WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

export default function NarrativesPage() {
  const sub = d.trending?.categories;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Trending narratives</h1>
        <p className="text-sm text-[var(--fg-dim)] max-w-3xl">
          CoinGecko trending categories (AI Agents, DePIN, RWA, etc.) captured every 30
          min. Tracks narrative rotation over time. A category persisting at the top for
          weeks = sustained market focus. A category appearing and vanishing in a day =
          news-driven blip.
        </p>
        <p className="text-xs text-[var(--fg-dim)] mt-1">
          {sub?.snapshotCount ?? 0} snapshots collected. List size: {sub?.listSize ?? 6} categories per snapshot.
        </p>
      </header>

      {sub?.latestNow && sub.latestNow.length > 0 && (
        <section className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
          <h2 className="font-bold mb-3">Hot right now</h2>
          <ol className="flex flex-wrap gap-2">
            {sub.latestNow.map((n, i) => (
              <li
                key={(n.id ?? "") + i}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-[var(--accent)] text-[var(--accent)] text-sm"
              >
                <span className="text-xs opacity-70">#{i + 1}</span>
                <span className="font-mono">{n.name}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <h2 className="font-bold mb-2">Persistence rankings</h2>
        <PersistenceTable items={sub?.perItem ?? {}} itemLabel="narratives" />
      </section>
    </div>
  );
}
