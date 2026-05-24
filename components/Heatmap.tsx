import Link from "next/link";

export default function Heatmap({
  symbols,
  dates,
  matrix,
  maxRank = 200,
}: {
  symbols: string[];
  dates: string[];
  matrix: (number | null)[][];
  maxRank?: number;
}) {
  function color(rank: number | null): string {
    if (rank == null) return "#1a1f25";
    const t = Math.min(1, Math.max(0, (rank - 1) / (maxRank - 1)));
    // green -> yellow -> red
    if (t < 0.5) {
      const k = t * 2;
      return `rgb(${Math.round(103 + (247 - 103) * k)}, ${Math.round(232 - (232 - 198) * k)}, ${Math.round(163 - (163 - 104) * k)})`;
    }
    const k = (t - 0.5) * 2;
    return `rgb(${Math.round(247 + (249 - 247) * k)}, ${Math.round(198 - (198 - 115) * k)}, ${Math.round(104 - (104 - 115) * k)})`;
  }

  // pick ~12 evenly spaced date ticks
  const tickCount = 12;
  const tickIdx = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i * (dates.length - 1)) / (tickCount - 1)),
  );

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--bg-elev)] px-2 py-1 text-left text-[var(--fg-dim)] border-r border-[var(--border)]">
              Coin
            </th>
            {dates.map((d, i) => (
              <th
                key={d}
                className="px-0 py-1 text-[var(--fg-dim)] font-normal"
                style={{ minWidth: 9 }}
              >
                {tickIdx.includes(i) ? <span className="text-[10px]">{d.slice(2, 7)}</span> : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map((sym, ri) => (
            <tr key={sym}>
              <td className="sticky left-0 z-10 bg-[var(--bg-elev)] px-2 py-0.5 font-mono border-r border-[var(--border)] whitespace-nowrap">
                <Link href={`/coin/${encodeURIComponent(sym)}`} className="hover:text-[var(--accent)]">
                  {sym}
                </Link>
              </td>
              {matrix[ri].map((rank, ci) => (
                <td
                  key={ci}
                  title={`${sym} @ ${dates[ci]}: rank ${rank ?? "—"}`}
                  style={{ background: color(rank), minWidth: 9, height: 14 }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
