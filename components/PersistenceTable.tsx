"use client";

import { useMemo, useState } from "react";
import Sparkline from "@/components/Sparkline";
import type { TrendingItem } from "@/lib/types";

type SortKey = "count24h" | "count7d" | "count30d" | "weightedScore7d" | "bestPosition" | "lastSeen";

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

/**
 * Generic persistence table for trending items (NFTs or categories).
 * Coins use the dedicated /trending page (different schema, more fields).
 */
export default function PersistenceTable({
  items,
  itemLabel,
}: {
  items: Record<string, TrendingItem>;
  itemLabel: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("weightedScore7d");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const all: TrendingItem[] = Object.values(items);
    const filtered = filter
      ? all.filter((r) => (r.name ?? "").toLowerCase().includes(filter.toLowerCase()))
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
  }, [items, sortKey, sortDir, filter]);

  function toggle(k: SortKey) {
    if (sortKey === k) setSortDir((x) => (x === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "bestPosition" ? "asc" : "desc");
    }
  }

  const maxDaily = Math.max(1, ...rows.flatMap((r) => r.dailyCounts));

  const headerCls =
    "px-3 py-2 select-none whitespace-nowrap cursor-pointer hover:text-[var(--fg)] text-[var(--fg-dim)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <input
          type="text"
          placeholder={`Filter ${itemLabel}...`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-elev)] border border-[var(--border)] rounded text-sm w-full max-w-xs focus:outline-none focus:border-[var(--accent)]"
        />
        <div className="text-xs text-[var(--fg-dim)]">{rows.length} {itemLabel}</div>
      </div>
      <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-elev)] border-b border-[var(--border)]">
            <tr>
              <th className="px-3 py-2 text-left text-[var(--fg-dim)]">Name</th>
              <th onClick={() => toggle("weightedScore7d")} className={`${headerCls} text-right`}>
                Weighted 7d {sortKey === "weightedScore7d" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </th>
              <th onClick={() => toggle("count24h")} className={`${headerCls} text-right`}>
                24h hits {sortKey === "count24h" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </th>
              <th onClick={() => toggle("count7d")} className={`${headerCls} text-right`}>
                7d hits {sortKey === "count7d" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </th>
              <th onClick={() => toggle("count30d")} className={`${headerCls} text-right`}>
                30d hits {sortKey === "count30d" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </th>
              <th onClick={() => toggle("bestPosition")} className={`${headerCls} text-right`}>
                Best pos {sortKey === "bestPosition" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </th>
              <th onClick={() => toggle("lastSeen")} className={`${headerCls} text-right`}>
                Last seen {sortKey === "lastSeen" && <span className="text-[var(--accent)]">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </th>
              <th className="px-3 py-2 text-left text-[var(--fg-dim)]">30d activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id ?? r.name} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-elev)]">
                <td className="px-3 py-2 font-mono">{r.name ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{r.weightedScore7d || "—"}</td>
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
                <td colSpan={8} className="px-3 py-8 text-center text-[var(--fg-dim)]">
                  No data yet. Captures need to accumulate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
