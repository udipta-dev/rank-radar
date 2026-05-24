"use client";

import Link from "next/link";
import { useState } from "react";

const CELL = 14;
const SYMBOL_COL = 80;

// Saturated 3-stop palette: vivid emerald → amber → vivid crimson.
// Picked to "pop" rather than read pastel.
const STOPS = [
  [0, 255, 130],   // rank 1: vivid mint/emerald
  [251, 191, 36], // rank ~10 (mid of log scale): bright amber
  [239, 35, 60],   // rank 200: vivid crimson
];

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function colorForRank(rank: number | null, maxRank = 200): string {
  if (rank == null) return "#1a1f25";
  // Log scale: rank 1 = 0, rank maxRank = 1. Top ranks get most of the gradient
  // so BTC (rank 1) is visibly distinct from ETH and anything at rank 20+.
  const t = Math.min(1, Math.max(0, Math.log(rank) / Math.log(maxRank)));
  const seg = t < 0.5 ? 0 : 1;
  const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const a = STOPS[seg];
  const b = STOPS[seg + 1];
  return `rgb(${lerp(a[0], b[0], k)}, ${lerp(a[1], b[1], k)}, ${lerp(a[2], b[2], k)})`;
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
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const updatePointer = (e: React.PointerEvent) => {
    setPointer({ x: e.clientX, y: e.clientY });
  };

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
          <span className="text-[var(--fg-dim)]">1</span>
          <span
            className="inline-block h-3 w-40 rounded relative"
            style={{
              background: `linear-gradient(to right, ${[1, 2, 5, 10, 25, 50, 100, 200]
                .map((r, i, arr) => `${colorForRank(r)} ${(i / (arr.length - 1)) * 100}%`)
                .join(", ")})`,
            }}
          />
          <span className="text-[var(--fg-dim)]">10</span>
          <span className="text-[var(--fg-dim)]">·</span>
          <span className="text-[var(--fg-dim)]">50</span>
          <span className="text-[var(--fg-dim)]">·</span>
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

        {/* grid rows: each row is a single CSS gradient (smooth horizontally),
            with an invisible per-cell hover layer on top */}
        <div className="relative">
          {symbols.map((sym, ri) => {
            const row = matrix[ri];
            const n = row.length;
            // build gradient stops, one per column, at column-center positions
            const stops = row
              .map((rank, ci) => {
                const pct = ((ci + 0.5) / n) * 100;
                return `${colorForRank(rank)} ${pct}%`;
              })
              .join(", ");
            return (
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
                    zIndex: 2,
                  }}
                >
                  {sym}
                </Link>
                <div
                  className="relative"
                  style={{
                    width: n * CELL,
                    height: CELL,
                    background: `linear-gradient(to right, ${stops})`,
                  }}
                >
                  {/* hover detection layer */}
                  <div className="absolute inset-0 flex">
                    {row.map((_, ci) => (
                      <div
                        key={ci}
                        onPointerEnter={(e) => {
                          setHover({ row: ri, col: ci });
                          updatePointer(e);
                        }}
                        onPointerMove={(e) => {
                          setHover({ row: ri, col: ci });
                          updatePointer(e);
                        }}
                        onPointerLeave={() => {
                          setHover(null);
                          setPointer(null);
                        }}
                        style={{
                          width: CELL,
                          height: CELL,
                          cursor: "crosshair",
                          outline:
                            hover?.row === ri && hover?.col === ci
                              ? "1px solid rgba(255,255,255,0.9)"
                              : hover?.col === ci
                                ? "1px solid rgba(255,255,255,0.25)"
                                : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* cursor-following tooltip */}
      {hoverInfo && pointer && (
        <div
          className="fixed z-50 pointer-events-none rounded-md border border-[var(--border)] bg-black/90 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-sm"
          style={{
            left: pointer.x + 14,
            top: pointer.y + 14,
            transform:
              pointer.x > window.innerWidth - 220 ? "translateX(-100%) translateX(-28px)" : undefined,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[var(--accent)]">{hoverInfo.sym}</span>
            <span className="text-[var(--fg-dim)]">{hoverInfo.date}</span>
          </div>
          <div className="font-mono mt-0.5">
            rank {hoverInfo.rank == null ? "— (outside top 200)" : hoverInfo.rank}
          </div>
        </div>
      )}
    </div>
  );
}
