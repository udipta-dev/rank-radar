import Link from "next/link";
import { notFound } from "next/navigation";
import TrajectoryChart from "@/components/TrajectoryChart";
import Sparkline from "@/components/Sparkline";
import { getData } from "@/lib/data";
import { fmtDate, fmtMcap, fmtPct } from "@/lib/format";

export function generateStaticParams() {
  const { trajectories } = getData();
  return Object.keys(trajectories).map((s) => ({ symbol: s }));
}

export default async function CoinPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);
  const { trajectories, nameMap, metadata, tables, currentMetrics, trending, crossSource } = getData();
  const trend = trending?.perCoin?.[sym];
  const cross = crossSource?.perCoin?.[sym];
  const traj = trajectories[sym];
  if (!traj) notFound();

  const name = nameMap[sym] ?? sym;
  const cur = currentMetrics[sym];
  const first = traj[0];
  const last = traj[traj.length - 1];
  const best = traj.reduce((m, p) => (p.rank < m.rank ? p : m), traj[0]);
  const worst = traj.reduce((m, p) => (p.rank > m.rank ? p : m), traj[0]);
  // staleness: coin's last data point vs latest snapshot in dataset
  const lastDateMs = new Date(last.date).getTime();
  const latestDateMs = new Date(metadata.lastDate).getTime();
  const daysStale = Math.round((latestDateMs - lastDateMs) / 86400000);
  const isStale = daysStale > 14;

  // membership in each table
  const buckets: { name: string; href: string; tone?: "good" | "bad" }[] = [];
  if (tables.climbersOverall.find((r) => r.symbol === sym))
    buckets.push({ name: "Overall climber", href: "/movements", tone: "good" });
  if (tables.climbersBear.find((r) => r.symbol === sym))
    buckets.push({ name: "Bear climber", href: "/movements", tone: "good" });
  if (tables.quietAccumulators.find((r) => r.symbol === sym))
    buckets.push({ name: "Quiet accumulator", href: "/quiet", tone: "good" });
  if (tables.highConvictionClimbers.find((r) => r.symbol === sym))
    buckets.push({ name: "Survivor (climbing despite unlocks)", href: "/float", tone: "good" });
  if (tables.persistentDecliners.find((r) => r.symbol === sym))
    buckets.push({ name: "Persistent decliner", href: "/movements", tone: "bad" });
  if (tables.lowFloatDecliners.find((r) => r.symbol === sym))
    buckets.push({ name: "Death watch (declining + low float)", href: "/float", tone: "bad" });
  if (tables.overhangRisk.find((r) => r.symbol === sym))
    buckets.push({ name: "Overhang risk (low float)", href: "/float", tone: "bad" });

  const coinSchema = {
    "@context": "https://schema.org",
    "@type": "Thing",
    name: `${sym} (${name})`,
    alternateName: sym,
    description:
      `${name} (${sym}) — rank trajectory, FDV / float overhang, and trending attention history. ` +
      `Currently ranked #${last.rank}. First seen ${first.date} at rank ${first.rank}. ` +
      `Best historical rank #${best.rank}.` +
      (isStale ? ` Currently flagged stale (delisted from top 200 ${daysStale} days ago).` : ""),
    url: `https://rank-radar-alpha.vercel.app/coin/${encodeURIComponent(sym)}`,
    sameAs: cur?.fdv
      ? [`https://www.coingecko.com/en/coins/${sym.toLowerCase()}`]
      : undefined,
  };

  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(coinSchema) }}
      />
      <div>
        <Link href="/" className="text-xs text-[var(--fg-dim)] hover:text-[var(--accent)]">
          ← back
        </Link>
        <h1 className="text-3xl font-bold mt-2">
          {sym} <span className="text-[var(--fg-dim)] text-lg font-normal">{name}</span>
        </h1>
        {buckets.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {buckets.map((b) => {
              const cls =
                b.tone === "good"
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : b.tone === "bad"
                    ? "border-[var(--danger)] text-[var(--danger)]"
                    : "border-[var(--border)] text-[var(--fg-dim)]";
              return (
                <Link
                  key={b.name}
                  href={b.href}
                  className={`text-xs px-2 py-0.5 rounded-full border ${cls} hover:opacity-80`}
                >
                  {b.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {isStale && (
        <div className="border-2 border-[var(--danger)] bg-[var(--danger)]/10 rounded-lg p-4 text-sm">
          <div className="font-bold text-[var(--danger)] mb-1">
            ⚠ Delisted from top 200 ({daysStale} days ago)
          </div>
          <div className="text-[var(--fg-dim)]">
            Last appearance in any snapshot: {last.date}. The numbers below reflect that
            last-known state, not current reality. Likely candidates: hack, depeg, project
            abandonment, or coordinated dump. Worth investigating what happened around {last.date}.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="First seen" value={fmtDate(first.date)} sub={`rank ${first.rank}`} />
        <Stat label="Best rank" value={String(best.rank)} sub={fmtDate(best.date)} />
        <Stat label="Worst rank" value={String(worst.rank)} sub={fmtDate(worst.date)} />
        <Stat label="Current rank" value={String(last.rank)} sub={fmtDate(last.date)} />
        <Stat
          label="Δ since first seen"
          value={
            first.rank - last.rank > 0 ? `+${first.rank - last.rank}` : String(first.rank - last.rank)
          }
          sub={`over ${traj.length} weeks`}
        />
        <Stat label="MCAP" value={fmtMcap(cur?.mcap)} />
        <Stat
          label="FDV"
          value={fmtMcap(cur?.fdv)}
          sub={cur?.isCapped ? "based on max_supply" : "uncapped (= MCAP)"}
        />
        <Stat
          label="Float %"
          value={fmtPct(cur?.mcFdv)}
          sub={
            cur?.isCapped
              ? cur?.mcFdv != null && cur.mcFdv < 0.3
                ? "heavy unlocks ahead"
                : cur?.mcFdv != null && cur.mcFdv < 0.6
                  ? "moderate unlocks ahead"
                  : "most supply in market"
              : "no hard cap"
          }
          color={
            cur?.isCapped && cur?.mcFdv != null
              ? cur.mcFdv < 0.3
                ? "var(--danger)"
                : cur.mcFdv < 0.6
                  ? "var(--warn)"
                  : "var(--accent)"
              : undefined
          }
        />
      </div>

      {trend && trend.count30d > 0 && (
        <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-bold">CoinGecko trending appearances</h2>
            <span className="text-xs text-[var(--fg-dim)]">
              best position seen: {trend.bestPosition < 999 ? `#${trend.bestPosition + 1}` : "—"} · last seen: {trend.lastSeen ? trend.lastSeen.slice(0, 16).replace("T", " ") + " UTC" : "—"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <div className="text-xs text-[var(--fg-dim)]">Last 24h</div>
              <div className="text-2xl font-mono">{trend.count24h}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--fg-dim)]">Last 7d</div>
              <div className="text-2xl font-mono">{trend.count7d}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--fg-dim)]">Last 30d</div>
              <div className="text-2xl font-mono">{trend.count30d}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--fg-dim)] mb-1">30-day activity (one bar per day)</div>
            <Sparkline values={trend.dailyCounts} width={520} height={40} />
          </div>
        </div>
      )}

      {cross && cross.totalMentions24h > 0 && (
        <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-bold">Mentions across sources (24h)</h2>
            <span className="text-xs text-[var(--fg-dim)]">
              {cross.sourceCount24h}/4 sources
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className="text-xs text-[var(--fg-dim)]">CoinGecko trending</div>
              <div className="text-2xl font-mono">{cross.cg.d1 || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--fg-dim)]">CMC trending</div>
              <div className="text-2xl font-mono">{cross.cmc.d1 || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--fg-dim)]">Farcaster $cashtag</div>
              <div className="text-2xl font-mono">{cross.farcaster.d1 || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--fg-dim)]">Reddit $cashtag</div>
              <div className="text-2xl font-mono">{cross.reddit.d1 || "—"}</div>
            </div>
          </div>
        </div>
      )}

      <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
        <h2 className="font-bold mb-3">Rank trajectory</h2>
        <TrajectoryChart series={[{ symbol: sym, data: traj }]} bearWindow={metadata.bearWindow} />
      </div>

      <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4">
        <h2 className="font-bold mb-3">Full week-by-week</h2>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm font-mono">
            <thead className="sticky top-0 bg-[var(--bg-elev)]">
              <tr className="text-[var(--fg-dim)] border-b border-[var(--border)]">
                <th className="text-left py-1">Date</th>
                <th className="text-right">Rank</th>
                <th className="text-right">Price</th>
                <th className="text-right">Mcap</th>
              </tr>
            </thead>
            <tbody>
              {[...traj].reverse().map((p) => (
                <tr key={p.date} className="border-b border-[var(--border)]">
                  <td className="py-1">{p.date}</td>
                  <td className="text-right">{p.rank}</td>
                  <td className="text-right">{fmtMcap(p.price)}</td>
                  <td className="text-right">{fmtMcap(p.mcap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-3">
      <div className="text-xs text-[var(--fg-dim)]">{label}</div>
      <div className="text-xl font-mono" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--fg-dim)] mt-1">{sub}</div>}
    </div>
  );
}
