import Link from "next/link";
import { notFound } from "next/navigation";
import TrajectoryChart from "@/components/TrajectoryChart";
import { getData } from "@/lib/data";
import { fmtDate, fmtMcap } from "@/lib/format";

export function generateStaticParams() {
  const { trajectories } = getData();
  return Object.keys(trajectories).map((s) => ({ symbol: s }));
}

export default async function CoinPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = decodeURIComponent(symbol);
  const { trajectories, nameMap, metadata, tables } = getData();
  const traj = trajectories[sym];
  if (!traj) notFound();

  const name = nameMap[sym] ?? sym;
  const first = traj[0];
  const last = traj[traj.length - 1];
  const best = traj.reduce((m, p) => (p.rank < m.rank ? p : m), traj[0]);
  const worst = traj.reduce((m, p) => (p.rank > m.rank ? p : m), traj[0]);

  // membership in each table
  const buckets: { name: string; href: string }[] = [];
  if (tables.climbersOverall.find((r) => r.symbol === sym))
    buckets.push({ name: "Overall climber", href: "/climbers" });
  if (tables.climbersBear.find((r) => r.symbol === sym))
    buckets.push({ name: "Bear climber", href: "/climbers" });
  if (tables.quietAccumulators.find((r) => r.symbol === sym))
    buckets.push({ name: "Quiet accumulator", href: "/quiet" });
  if (tables.persistentDecliners.find((r) => r.symbol === sym))
    buckets.push({ name: "Persistent decliner", href: "/decliners" });
  if (tables.stableHolders.find((r) => r.symbol === sym))
    buckets.push({ name: "Stable holder", href: "/holders" });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-xs text-[var(--fg-dim)] hover:text-[var(--accent)]">
          ← back
        </Link>
        <h1 className="text-3xl font-bold mt-2">
          {sym} <span className="text-[var(--fg-dim)] text-lg font-normal">{name}</span>
        </h1>
        {buckets.length > 0 && (
          <div className="flex gap-2 mt-2">
            {buckets.map((b) => (
              <Link
                key={b.name}
                href={b.href}
                className="text-xs px-2 py-0.5 rounded-full border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
              >
                {b.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="First seen" value={fmtDate(first.date)} sub={`rank ${first.rank}`} />
        <Stat label="Best rank" value={String(best.rank)} sub={fmtDate(best.date)} />
        <Stat label="Worst rank" value={String(worst.rank)} sub={fmtDate(worst.date)} />
        <Stat label="Current rank" value={String(last.rank)} sub={fmtDate(last.date)} />
        <Stat
          label="Δ since first seen"
          value={
            first.rank - last.rank > 0 ? `+${first.rank - last.rank}` : String(first.rank - last.rank)
          }
          sub={`mcap ${fmtMcap(last.mcap)}`}
        />
      </div>

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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-3">
      <div className="text-xs text-[var(--fg-dim)]">{label}</div>
      <div className="text-xl font-mono">{value}</div>
      {sub && <div className="text-xs text-[var(--fg-dim)] mt-1">{sub}</div>}
    </div>
  );
}
