"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function CoinSearch({
  nameMap,
}: {
  nameMap: Record<string, string>;
}) {
  const [q, setQ] = useState("");

  const all = useMemo(
    () =>
      Object.entries(nameMap)
        .map(([symbol, name]) => ({ symbol, name }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [nameMap],
  );

  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return all
      .filter(
        (c) =>
          c.symbol.toLowerCase().includes(ql) || c.name.toLowerCase().includes(ql),
      )
      .slice(0, 12);
  }, [q, all]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Look up any coin (PENGU, BTC, HYPE, ...)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full px-3 py-2 bg-[var(--bg-elev)] border border-[var(--border)] rounded text-sm focus:outline-none focus:border-[var(--accent)]"
      />
      {matches.length > 0 && (
        <ul className="absolute z-20 mt-1 left-0 right-0 max-h-72 overflow-y-auto bg-[var(--bg-elev)] border border-[var(--border)] rounded shadow-xl">
          {matches.map((m) => (
            <li key={m.symbol}>
              <Link
                href={`/coin/${encodeURIComponent(m.symbol)}`}
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--border)]"
              >
                <span className="font-mono font-semibold w-16 text-[var(--accent)]">
                  {m.symbol}
                </span>
                <span className="text-[var(--fg-dim)] truncate">{m.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="text-xs text-[var(--fg-dim)] mt-1">
        {all.length} coins available
      </div>
    </div>
  );
}
