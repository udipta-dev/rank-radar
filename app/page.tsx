import Link from "next/link";
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
  const { metadata: meta, tables, summaryMd } = getData();
  const bear = meta.bearWindow;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">rank-radar</h1>
        <p className="text-[var(--fg-dim)]">
          Tracking structural rank movement of top crypto assets to find quiet winners and dead weight.
        </p>
      </header>

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
          href="/climbers"
        />
        <TopList
          title="Top bear-period climbers"
          rows={tables.climbersBear}
          scoreKey="rank_delta"
          href="/climbers"
        />
      </section>

      {summaryMd && (
        <section className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-6">
          <h2 className="font-bold mb-3">Analyst notes</h2>
          <pre className="text-xs whitespace-pre-wrap leading-relaxed text-[var(--fg-dim)] font-mono">
            {summaryMd}
          </pre>
        </section>
      )}
    </div>
  );
}
