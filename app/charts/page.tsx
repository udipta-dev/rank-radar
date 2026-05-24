import { getData } from "@/lib/data";

const charts = [
  {
    src: "/chart_climbers_overall.png",
    title: "Top 20 structural climbers (full window)",
    note: "Each line is one coin. Rank inverted: up = better. Coin labels in the legend.",
  },
  {
    src: "/chart_climbers_bear.png",
    title: "Top 20 bear-period climbers",
    note: "Coins that gained the most rank during the bear window.",
  },
  {
    src: "/chart_heatmap_top50.png",
    title: "Heatmap: top 50 by current rank",
    note: "Rows = today's top 50, columns = time. Green = better rank, red = worse, white = not in top 200.",
  },
  {
    src: "/chart_delta_histogram.png",
    title: "Distribution of rank deltas",
    note: "Histogram across all coins with sufficient history. Positive = climbed, negative = declined.",
  },
  {
    src: "/chart_coverage.png",
    title: "Capture coverage + total top-200 market cap",
    note: "Top panel: how many coins each snapshot. Bottom: sum of top-200 mcap (this is what we use to detect the bear window).",
  },
];

export default function ChartsPage() {
  const { metadata } = getData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Charts</h1>
        <p className="text-sm text-[var(--fg-dim)]">
          Generated from {metadata.snapshotCount} snapshots covering{" "}
          {metadata.firstDate} → {metadata.lastDate}.
        </p>
      </div>
      <div className="space-y-8">
        {charts.map((c) => (
          <figure
            key={c.src}
            className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-3"
          >
            <h2 className="font-bold mb-2">{c.title}</h2>
            <a href={c.src} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.src}
                alt={c.title}
                className="w-full rounded bg-white"
                loading="lazy"
              />
            </a>
            <figcaption className="text-xs text-[var(--fg-dim)] mt-2">{c.note}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
