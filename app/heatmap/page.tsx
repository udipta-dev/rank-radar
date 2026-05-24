import { getData } from "@/lib/data";

export default function HeatmapPage() {
  const { metadata } = getData();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Rank heatmap (top 50 current)</h1>
        <p className="text-sm text-[var(--fg-dim)] max-w-2xl">
          Rows are today&apos;s top 50 by rank, columns are weekly snapshots from{" "}
          {metadata.firstDate} to {metadata.lastDate}. Green = better rank, red = worse,
          white = not in top 200. Click image to open full size.
        </p>
      </div>
      <a href="/chart_heatmap_top50.png" target="_blank" rel="noopener">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/chart_heatmap_top50.png"
          alt="Rank heatmap top 50"
          className="w-full rounded-lg bg-white border border-[var(--border)]"
        />
      </a>
    </div>
  );
}
