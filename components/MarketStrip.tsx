import Sparkline from "@/components/Sparkline";
import { fmtMcap } from "@/lib/format";
import type { Market } from "@/lib/types";

function pct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// color a number by the sign of the move (down = red, up = green)
function signColor(v: number | null | undefined): string {
  if (v == null) return "var(--fg-dim)";
  return v < 0 ? "var(--danger)" : v > 0 ? "var(--accent)" : "var(--fg-dim)";
}

function regimeColor(regime: Market["regime"]): string {
  return regime === "risk-off"
    ? "var(--danger)"
    : regime === "risk-on"
      ? "var(--accent)"
      : "var(--fg-dim)";
}

function RegimeChip({ regime }: { regime: Market["regime"] }) {
  if (regime === "unknown") return null;
  const c = regimeColor(regime);
  return (
    <span
      className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border"
      style={{ color: c, borderColor: c }}
    >
      {regime}
    </span>
  );
}

function Win({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="text-center">
      <div className="text-xs text-[var(--fg-dim)]">{label}</div>
      <div className="font-mono text-sm" style={{ color: signColor(v) }}>
        {pct(v)}
      </div>
    </div>
  );
}

/**
 * Global crypto market regime, CoinGecko-style. Two variants:
 *   strip  — thin full-width bar under the nav (every page)
 *   block  — richer homepage card with windows + sparkline
 * Renders nothing until we have at least one captured snapshot.
 */
export default function MarketStrip({
  market,
  variant,
}: {
  market: Market | undefined;
  variant: "strip" | "block";
}) {
  const mcap = market?.totalMcapUsd;
  if (!market || mcap == null) return null;

  const c24 = market.change24hPct;
  const arrow = c24 == null ? "" : c24 < 0 ? "▼" : "▲";

  if (variant === "strip") {
    return (
      <div className="border-b border-[var(--border)] bg-[var(--bg-elev)]">
        <div className="mx-auto max-w-7xl px-4 py-1.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs">
          <span className="uppercase tracking-wide text-[var(--fg-dim)]">Crypto market</span>
          <span className="font-mono font-semibold">{fmtMcap(mcap)}</span>
          <span className="font-mono" style={{ color: signColor(c24) }}>
            {arrow} {pct(c24)} <span className="text-[var(--fg-dim)]">24h</span>
          </span>
          {market.btcDominance != null && (
            <span className="font-mono text-[var(--fg-dim)]">
              BTC dom {market.btcDominance.toFixed(0)}%
            </span>
          )}
          <RegimeChip regime={market.regime} />
        </div>
      </div>
    );
  }

  // block variant — baseline-shift the sparkline so small mcap moves are visible
  const spark = market.sparkline ?? [];
  const lo = spark.length ? Math.min(...spark) : 0;
  const sparkNorm = spark.map((v) => v - lo);
  const sparkColor = signColor(market.change7dPct ?? c24);

  return (
    <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">Market regime</h2>
        <RegimeChip regime={market.regime} />
      </div>
      <div className="flex items-end gap-5 flex-wrap">
        <div>
          <div className="text-xs text-[var(--fg-dim)] mb-0.5">Total crypto mcap</div>
          <div className="text-2xl font-mono">
            {fmtMcap(mcap)}{" "}
            <span className="text-base" style={{ color: signColor(c24) }}>
              {arrow} {pct(c24)}
            </span>
          </div>
        </div>
        <div className="flex gap-4">
          <Win label="24h" v={c24} />
          <Win label="7d" v={market.change7dPct} />
          <Win label="30d" v={market.change30dPct} />
        </div>
        {sparkNorm.length > 1 && (
          <div className="ml-auto">
            <div className="text-xs text-[var(--fg-dim)] mb-1">mcap, recent</div>
            <Sparkline values={sparkNorm} width={200} height={36} color={sparkColor} />
          </div>
        )}
      </div>
      <div className="text-xs text-[var(--fg-dim)] mt-3">
        {market.btcDominance != null && <>BTC dominance {market.btcDominance.toFixed(1)}%</>}
        {market.ethDominance != null && <> · ETH {market.ethDominance.toFixed(1)}%</>}
        {market.change7dPct == null && (
          <> · 7d/30d regime fills in as capture history accrues</>
        )}
      </div>
    </div>
  );
}
