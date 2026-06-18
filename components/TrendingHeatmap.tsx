"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const ROW_HEIGHT = 16;
const SYMBOL_COL = 80;
// Cap rendered columns. 30-min captures accumulate without bound (1267+ and
// climbing ~48/day); the old per-cell hover overlay rendered one interactive
// node per cell (rows × cols), which exploded the DOM and blew past Vercel's
// 19 MB prerender limit. We downsample to at most this many columns so the
// heatmap stays readable and bounded no matter how much history accrues.
const MAX_COLS = 200;

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

// Bucket adjacent snapshots so we never render more than MAX_COLS columns.
// Each output cell keeps the best (lowest = closest to #1) position in its span,
// preserving the full time range at lower resolution rather than truncating it.
function downsample(
  timestamps: string[],
  matrix: (number | null)[][],
): { timestamps: string[]; matrix: (number | null)[][] } {
  const n = timestamps.length;
  if (n <= MAX_COLS) return { timestamps, matrix };
  const bucket = Math.ceil(n / MAX_COLS);
  const outN = Math.ceil(n / bucket);
  const ts: string[] = [];
  for (let b = 0; b < outN; b++) ts.push(timestamps[Math.min(n - 1, b * bucket)]);
  const mat = matrix.map((row) => {
    const out: (number | null)[] = [];
    for (let b = 0; b < outN; b++) {
      let best: number | null = null;
      const end = Math.min(n, (b + 1) * bucket);
      for (let i = b * bucket; i < end; i++) {
        const v = row[i];
        if (v != null && (best == null || v < best)) best = v;
      }
      out.push(best);
    }
    return out;
  });
  return { timestamps: ts, matrix: mat };
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

  // Downsample once per data change, not on every render.
  const { timestamps: ts, matrix: mat } = useMemo(
    () => downsample(timestamps, matrix),
    [timestamps, matrix],
  );

  if (symbols.length === 0 || ts.length === 0) {
    return (
      <div className="text-sm text-[var(--fg-dim)] p-4 border border-[var(--border)] rounded-lg">
        No trending snapshots yet. Heatmap fills in as captures accumulate (every 30 min).
      </div>
    );
  }

  const n = ts.length;
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
          ts: ts[hover.col],
          pos: mat[hover.row][hover.col],
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
          {symbols.length} coins ever trended × {timestamps.length} snapshots
          {timestamps.length > n ? ` (shown at ${n}-col resolution)` : ""}. Brighter = closer to top of list.
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
          {ts.map((t, i) =>
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
              {/* One pointer handler per row maps x → column, instead of one
                  interactive node per cell (which was O(rows × cols) DOM). */}
              <div
                className="relative flex-1"
                style={{ height: ROW_HEIGHT, background: rowGradient(mat[ri]), cursor: "crosshair" }}
                onPointerMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const frac = (e.clientX - rect.left) / rect.width;
                  const col = Math.min(n - 1, Math.max(0, Math.floor(frac * n)));
                  setHover({ row: ri, col });
                  setPointer({ x: e.clientX, y: e.clientY });
                }}
                onPointerLeave={() => {
                  setHover(null);
                  setPointer(null);
                }}
              >
                {hover?.row === ri && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: `${((hover.col + 0.5) / n) * 100}%`,
                      width: 1,
                      marginLeft: -0.5,
                      background: "rgba(255,255,255,0.9)",
                    }}
                  />
                )}
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
