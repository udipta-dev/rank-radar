"use client";

import Link from "next/link";
import { useState } from "react";

const CELL = 14;
const SYMBOL_COL = 80;

function colorForRank(rank: number | null, maxRank = 200): string {
  if (rank == null) return "#1a1f25";
  const t = Math.min(1, Math.max(0, (rank - 1) / (maxRank - 1)));
  if (t < 0.5) {
    const k = t * 2;
    return `rgb(${Math.round(103 + (247 - 103) * k)}, ${Math.round(232 - (232 - 198) * k)}, ${Math.round(163 - (163 - 104) * k)})`;
  }
  const k = (t - 0.5) * 2;
  return `rgb(${Math.round(247 + (249 - 247) * k)}, ${Math.round(198 - (198 - 115) * k)}, ${Math.round(104 - (104 - 115) * k)})`;
}

export default function Heatmap({
  symbols,
  dates,
  matrix,
}: {
  symbols: string[];
  dates: string[];
  matrix: (number | null)[][];
}) {
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);

  const tickCount = 10;
  const tickSet = new Set<number>(
    Array.from({ length: tickCount }, (_, i) => Math.round((i * (dates.length - 1)) / (tickCount - 1))),
  );

  const hoverInfo =
    hover && hover.row >= 0 && hover.col >= 0
      ? {
          sym: symbols[hover.row],
          date: dates[hover.col],
          rank: matrix[hover.row][hover.col],
        }
      : null;

  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-elev)] p-3">
      <div className="flex items-center justify-between mb-2 text-xs">
        <div className="text-[var(--fg-dim)]">
          {symbols.length} coins × {dates.length} snapshots. Hover any cell for details. Click row symbol to open the coin page.
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--fg-dim)]">rank 1</span>
          <span
            className="inline-block h-3 w-32 rounded"
            style={{
              background:
                "linear-gradient(to right, #67e8a3, #f7c668, #f97373)",
            }}
          />
          <span className="text-[var(--fg-dim)]">200</span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        {/* x axis date labels */}
        <div
          className="relative h-5 text-[10px] text-[var(--fg-dim)]"
          style={{ marginLeft: SYMBOL_COL, width: dates.length * CELL }}
        >
          {dates.map((d, i) =>
            tickSet.has(i) ? (
              <span
                key={i}
                className="absolute"
                style={{ left: i * CELL, transform: "translateX(-50%)" }}
              >
                {d.slice(2, 7)}
              </span>
            ) : null,
          )}
        </div>

        {/* grid rows */}
        <div className="relative">
          {symbols.map((sym, ri) => (
            <div key={sym} className="flex items-center" style={{ height: CELL }}>
              <Link
                href={`/coin/${encodeURIComponent(sym)}`}
                className="font-mono text-xs hover:text-[var(--accent)] whitespace-nowrap"
                style={{
                  width: SYMBOL_COL,
                  paddingRight: 8,
                  textAlign: "right",
                  position: "sticky",
                  left: 0,
                  background: "var(--bg-elev)",
                  zIndex: 1,
                }}
              >
                {sym}
              </Link>
              <div className="flex" style={{ height: CELL }}>
                {matrix[ri].map((rank, ci) => (
                  <div
                    key={ci}
                    onMouseEnter={() => setHover({ row: ri, col: ci })}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      width: CELL,
                      height: CELL,
                      background: colorForRank(rank),
                      cursor: "crosshair",
                      borderTop: ri === 0 ? "1px solid #232a32" : undefined,
                      borderLeft: ci === 0 ? "1px solid #232a32" : undefined,
                      borderRight: "1px solid rgba(11,13,16,0.2)",
                      borderBottom: "1px solid rgba(11,13,16,0.2)",
                      outline:
                        hover?.row === ri || hover?.col === ci
                          ? "1px solid rgba(255,255,255,0.4)"
                          : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* fixed-position hover card */}
      {hoverInfo && (
        <div className="mt-3 text-xs flex gap-4 items-center border-t border-[var(--border)] pt-2">
          <span className="font-mono font-bold text-[var(--accent)]">{hoverInfo.sym}</span>
          <span className="text-[var(--fg-dim)]">{hoverInfo.date}</span>
          <span className="font-mono">
            rank {hoverInfo.rank == null ? "— (outside top 200)" : hoverInfo.rank}
          </span>
        </div>
      )}
    </div>
  );
}
