import Link from "next/link";
import CoinSearch from "@/components/CoinSearch";
import MarketTable from "@/components/MarketTable";
import MarketStrip from "@/components/MarketStrip";
import InsightCard from "@/components/InsightCard";
import { getData } from "@/lib/data";
import { fmtMcap, fmtDelta, fmtDate } from "@/lib/format";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--fg-dim)] mb-1">{label}</div>
      <div className="text-2xl font-mono">{value}</div>
      {sub && <div className="text-xs text-[var(--fg-dim)] mt-1">{sub}</div>}
    </div>
  );
}

function TopList({
  title,
  rows,
  scoreKey,
  href,
}: {
  title: string;
  rows: {
    symbol: string;
    name: string;
    rank_delta?: number;
    bear_delta?: number;
    start_rank: number;
    end_rank: number;
  }[];
  scoreKey: "rank_delta" | "bear_delta";
  href: string;
}) {
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">{title}</h2>
        <Link href={href} className="text-xs text-[var(--accent)] hover:underline">
          See all →
        </Link>
      </div>
      <ol className="space-y-1.5">
        {rows.slice(0, 10).map((r, i) => (
          <li key={r.symbol} className="flex items-center text-sm gap-2">
            <span className="text-[var(--fg-dim)] w-5">{i + 1}.</span>
            <Link
              href={`/coin/${encodeURIComponent(r.symbol)}`}
              className="font-mono font-semibold w-16 hover:text-[var(--accent)]"
            >
              {r.symbol}
            </Link>
            <span className="flex-1 text-[var(--fg-dim)] truncate text-xs">{r.name}</span>
            <span className="font-mono text-xs text-[var(--fg-dim)] whitespace-nowrap">
              {r.start_rank} → {r.end_rank}
            </span>
            <span className="font-mono w-16 text-right text-[var(--accent)]">
              {fmtDelta(r[scoreKey])}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Home() {
  const { metadata: meta, tables, nameMap, currentMetrics, momentum, insights, market } = getData();
  const bear = meta.bearWindow;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">rank-radar</h1>
        <p className="text-[var(--fg-dim)] mb-4">
          Tracking structural rank movement of top crypto assets to find quiet winners and dead weight.
        </p>
        <CoinSearch nameMap={nameMap} />
      </header>

      <InsightCard text={insights?.home} generatedAt={meta.generatedAt} />

      <MarketStrip market={market} variant="block" />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Snapshots"
          value={String(meta.snapshotCount)}
          sub={`${meta.firstDate} → ${meta.lastDate}`}
        />
        <Stat label="Coins tracked" value={String(meta.coinCount)} sub="post noise filter" />
        <Stat
          label="Bear drawdown"
          value={`${bear.drawdownPct.toFixed(1)}%`}
          sub={`${fmtDate(bear.peak)} → ${fmtDate(bear.trough)}`}
        />
        <Stat
          label="Top-200 mcap"
          value={`${fmtMcap(bear.peakMcap)} → ${fmtMcap(bear.troughMcap)}`}
          sub="peak / trough"
        />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <TopList
          title="Top structural climbers (full window)"
          rows={tables.climbersOverall}
          scoreKey="rank_delta"
          href="/movements"
        />
        <TopList
          title="Top bear-period climbers"
          rows={tables.climbersBear}
          scoreKey="rank_delta"
          href="/movements"
        />
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-bold">Market overview</h2>
          <span className="text-xs text-[var(--fg-dim)]">
            Top 200 by current rank, with momentum. Click any column to sort.
          </span>
        </div>
        <MarketTable nameMap={nameMap} currentMetrics={currentMetrics} momentum={momentum} limit={200} />
      </section>
    </div>
  );
}
