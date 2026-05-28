"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Sparkline from "@/components/Sparkline";
import type { TrendingCoin, WebData } from "@/lib/types";
import data from "@/data/web.json";

const d = data as unknown as WebData;

type SortKey = "count1h" | "count6h" | "count24h" | "count7d" | "count30d" | "lastSeen" | "bestPosition";

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TrendingPage() {
  const { trending } = d;
  const [sortKey, setSortKey] = useState<SortKey>("count7d");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const all: TrendingCoin[] = Object.values(trending.perCoin || {});
    const filtered = filter
      ? all.filter(
          (r) =>
            r.symbol.toLowerCase().includes(filter.toLowerCase()) ||
            (r.name ?? "").toLowerCase().includes(filter.toLowerCase()),
        )
      : all;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [trending, sortKey, sortDir, filter]);

  function toggle(k: SortKey) {
    if (sortKey === k) setSortDir((x) => (x === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "bestPosition" ? "asc" : "desc");
    }
  }

  const maxDaily = Math.max(1, ...rows.flatMap((r) => r.dailyCounts));

  const days = Math.min(30, Math.ceil(trending.snapshotCount30d / 96));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Trending</h1>
        <p className="text-sm text-[var(--fg-dim)]">
          CoinGecko trending list captured every 30 min, site refreshes every 30 min.
          Persistence = how many snapshots a coin has appeared on the list. Higher =
          more sustained attention. Spikes that vanish = pure hype / paid push, fade fast.
        </p>
        <p className="text-xs text-[var(--fg-dim)] mt-1">
          {trending.snapshotCount30d.toLocaleString()} snapshots collected over ~{days}d.
          Latest: {trending.latestSnapshotTs ? relTime(trending.latestSnapshotTs) : "never"}.
        </p>
      </header>

      {/* Right now */}
      {trending.trendingNow.length > 0 && (
        <section className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
          <h2 className="font-bold mb-3">
            Trending right now <span className="text-xs text-[var(--fg-dim)] font-normal">
              ({trending.latestSnapshotTs ? relTime(trending.latestSnapshotTs) : "—"})
            </span>
          </h2>
          <ol className="flex flex-wrap gap-2">
            {trending.trendingNow.map((c, i) => (
              <li key={c.symbol + i}>
                <Link
                  href={`/coin/${encodeURIComponent(c.symbol)}`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-[var(--accent)] text-[var(--accent)] text-sm hover:bg-[var(--accent)] hover:text-black"
                >
                  <span className="text-xs opacity-70">#{i + 1}</span>
                  <span className="font-mono font-semibold">{c.symbol}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Persistence table */}
      <section>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h2 className="font-bold">Persistence rankings</h2>
          <input
            type="text"
            placeholder="Filter by symbol or name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 bg-[var(--bg-elev)] border border-[var(--border)] rounded text-sm w-full max-w-xs focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-elev)] border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 text-left text-[var(--fg-dim)]">Symbol</th>
                <th className="px-3 py-2 text-left text-[var(--fg-dim)]">Name</th>
                <th
                  onClick={() => toggle("count1h")}
                  className="px-3 py-2 text-right text-[var(--fg-dim)] cursor-pointer hover:text-[var(--fg)] whitespace-nowrap"
                  title="Hits in the last hour (max 2 captures, fires every 30 min)"
                >
                  1h {sortKey === "count1h" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th
                  onClick={() => toggle("count6h")}
                  className="px-3 py-2 text-right text-[var(--fg-dim)] cursor-pointer hover:text-[var(--fg)] whitespace-nowrap"
                  title="Hits in the last 6 hours (max 12 captures)"
                >
                  6h {sortKey === "count6h" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th
                  onClick={() => toggle("count24h")}
                  className="px-3 py-2 text-right text-[var(--fg-dim)] cursor-pointer hover:text-[var(--fg)] whitespace-nowrap"
                >
                  24h hits {sortKey === "count24h" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th
                  onClick={() => toggle("count7d")}
                  className="px-3 py-2 text-right text-[var(--fg-dim)] cursor-pointer hover:text-[var(--fg)] whitespace-nowrap"
                >
                  7d hits {sortKey === "count7d" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th
                  onClick={() => toggle("count30d")}
                  className="px-3 py-2 text-right text-[var(--fg-dim)] cursor-pointer hover:text-[var(--fg)] whitespace-nowrap"
                >
                  30d hits {sortKey === "count30d" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th
                  onClick={() => toggle("bestPosition")}
                  className="px-3 py-2 text-right text-[var(--fg-dim)] cursor-pointer hover:text-[var(--fg)] whitespace-nowrap"
                >
                  Best pos {sortKey === "bestPosition" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th
                  onClick={() => toggle("lastSeen")}
                  className="px-3 py-2 text-right text-[var(--fg-dim)] cursor-pointer hover:text-[var(--fg)] whitespace-nowrap"
                >
                  Last seen {sortKey === "lastSeen" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
                <th className="px-3 py-2 text-left text-[var(--fg-dim)]">30d activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elev)]">
                  <td className="px-3 py-2">
                    <Link
                      href={`/coin/${encodeURIComponent(r.symbol)}`}
                      className="font-mono font-semibold hover:text-[var(--accent)]"
                    >
                      {r.symbol}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[var(--fg-dim)] truncate max-w-xs">{r.name ?? "—"}</td>
                  <td className={`px-3 py-2 text-right font-mono ${r.count1h > 0 ? "text-[var(--accent)]" : ""}`}>{r.count1h || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.count6h || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.count24h || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.count7d || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.count30d || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.bestPosition < 999 ? `#${r.bestPosition + 1}` : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{relTime(r.lastSeen)}</td>
                  <td className="px-3 py-2"><Sparkline values={r.dailyCounts} max={maxDaily} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[var(--fg-dim)]">
                    No trending data yet. The 30-min capture cron has to run for a while.
                    Persistence numbers will be meaningful after ~7 days of collection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
