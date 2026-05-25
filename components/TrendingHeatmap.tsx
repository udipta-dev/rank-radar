"use client";

import Link from "next/link";
import { useState } from "react";

const ROW_HEIGHT = 16;
const SYMBOL_COL = 80;

// position 0 (top of trending list) = brightest, 14 (bottom) = dimmer; null = empty
function colorForPosition(p: number | null): string {
  if (p == null) return "transparent";
  // 0..14 → green intensity
  const t = p / 14;
  const r = Math.round(0 + (251 - 0) * t);   // 0 → 251
  const g = Math.round(255 - (255 - 191) * t); // 255 → 191
  const b = Math.round(130 + (36 - 130) * t);  // 130 → 36
  return `rgb(${r}, ${g}, ${b})`;
}

export default function TrendingHeatmap({
  symbols,
  timestamps,
  matrix,
}: {
  symbols: string[];
  timestamps: string[];
  matrix: (number | null)[][];
}) {
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  if (symbols.length === 0 || timestamps.length === 0) {
    return (
      <div className="text-sm text-[var(--fg-dim)] p-4 border border-[var(--border)] rounded-lg">
        No trending snapshots yet. Heatmap fills in as captures accumulate (every 30 min).
      </div>
    );
  }

  const n = timestamps.length;
  // build per-row CSS gradient stops from the cells
  const rowGradient = (row: (number | null)[]) => {
    const stops = row.map((p, ci) => {
      const pct = ((ci + 0.5) / n) * 100;
      return `${colorForPosition(p)} ${pct}%`;
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
  };

  const hoverInfo =
    hover && hover.row >= 0 && hover.col >= 0
      ? {
          sym: symbols[hover.row],
          ts: timestamps[hover.col],
          pos: matrix[hover.row][hover.col],
        }
      : null;

  // x-axis ticks
  const tickCount = Math.min(8, n);
  const tickSet = new Set<number>(
    Array.from({ length: tickCount }, (_, i) =>
      Math.round((i * (n - 1)) / Math.max(1, tickCount - 1)),
    ),
  );

  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-elev)] p-3">
      <div className="flex items-center justify-between mb-2 text-xs flex-wrap gap-2">
        <div className="text-[var(--fg-dim)]">
          {symbols.length} coins ever trended × {n} snapshots. Brighter = closer to top of list.
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--fg-dim)]">#1</span>
          <span
            className="inline-block h-3 w-32 rounded"
            style={{
              background:
                "linear-gradient(to right, rgb(0,255,130), rgb(251,191,36))",
            }}
          />
          <span className="text-[var(--fg-dim)]">#15</span>
        </div>
      </div>

      <div className="relative">
        {/* date axis */}
        <div className="relative h-5 text-[10px] text-[var(--fg-dim)]" style={{ marginLeft: SYMBOL_COL }}>
          {timestamps.map((t, i) =>
            tickSet.has(i) ? (
              <span
                key={i}
                className="absolute whitespace-nowrap"
                style={{
                  left: `${(i / Math.max(1, n - 1)) * 100}%`,
                  transform:
                    i === 0 ? "translateX(0)" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                {t.slice(5, 16).replace("T", " ")}
              </span>
            ) : null,
          )}
        </div>

        {symbols.map((sym, ri) => {
          const dim = hover != null && hover.row !== ri;
          return (
            <div
              key={sym}
              className="flex items-center"
              style={{ height: ROW_HEIGHT, opacity: dim ? 0.2 : 1, transition: "opacity 120ms ease" }}
            >
              <Link
                href={`/coin/${encodeURIComponent(sym)}`}
                className="font-mono text-xs hover:text-[var(--accent)] whitespace-nowrap shrink-0"
                style={{ width: SYMBOL_COL, paddingRight: 8, textAlign: "right" }}
              >
                {sym}
              </Link>
              <div
                className="relative flex-1"
                style={{
                  height: ROW_HEIGHT,
                  background: rowGradient(matrix[ri]),
                }}
              >
                <div
                  className="absolute inset-0 grid"
                  style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
                >
                  {matrix[ri].map((_, ci) => (
                    <div
                      key={ci}
                      onPointerEnter={(e) => {
                        setHover({ row: ri, col: ci });
                        setPointer({ x: e.clientX, y: e.clientY });
                      }}
                      onPointerMove={(e) => {
                        setHover({ row: ri, col: ci });
                        setPointer({ x: e.clientX, y: e.clientY });
                      }}
                      onPointerLeave={() => {
                        setHover(null);
                        setPointer(null);
                      }}
                      style={{
                        cursor: "crosshair",
                        outline:
                          hover?.row === ri && hover?.col === ci
                            ? "1px solid rgba(255,255,255,0.9)"
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

      {hoverInfo && pointer && (
        <div
          className="fixed z-50 pointer-events-none rounded-md border border-[var(--border)] bg-black/90 px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: pointer.x + 14,
            top: pointer.y + 14,
            transform:
              pointer.x > window.innerWidth - 220 ? "translateX(-100%) translateX(-28px)" : undefined,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[var(--accent)]">{hoverInfo.sym}</span>
            <span className="text-[var(--fg-dim)]">{hoverInfo.ts.slice(5, 16).replace("T", " ")}</span>
          </div>
          <div className="font-mono mt-0.5">
            {hoverInfo.pos == null ? "not on list" : `position #${hoverInfo.pos + 1}`}
          </div>
        </div>
      )}
    </div>
  );
}
