import Heatmap from "@/components/Heatmap";
import { getData } from "@/lib/data";

export default function HeatmapPage() {
  const { heatmap, metadata } = getData();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Rank heatmap (top 50 current)</h1>
        <p className="text-sm text-[var(--fg-dim)] max-w-3xl">
          Rows are today&apos;s top 50 coins by rank, columns are weekly snapshots from{" "}
          {metadata.firstDate} to {metadata.lastDate}. Green = better rank, red = worse,
          dark grey = not in top 200 for that week. Hover any cell for the exact rank; click
          a symbol on the left to open its coin page.
        </p>
      </div>
      <Heatmap symbols={heatmap.symbols} dates={heatmap.dates} matrix={heatmap.matrix} />
    </div>
  );
}
