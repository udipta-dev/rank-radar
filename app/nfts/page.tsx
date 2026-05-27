"use client";

import PersistenceTable from "@/components/PersistenceTable";
import type { WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

export default function NftsPage() {
  const sub = d.trending?.nfts;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Trending NFTs</h1>
        <p className="text-sm text-[var(--fg-dim)]">
          CoinGecko trending NFT collections, captured alongside coins every 30 min.
          Persistence = how often a collection appears on the trending list. Sustained
          presence = real blue-chip attention. Bursts = single-day pumps or paid promo.
        </p>
        <p className="text-xs text-[var(--fg-dim)] mt-1">
          {sub?.snapshotCount ?? 0} snapshots collected. List size: {sub?.listSize ?? 7} NFTs per snapshot.
        </p>
      </header>

      {sub?.latestNow && sub.latestNow.length > 0 && (
        <section className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
          <h2 className="font-bold mb-3">Trending right now</h2>
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
        <PersistenceTable items={sub?.perItem ?? {}} itemLabel="NFT collections" />
      </section>
    </div>
  );
}
