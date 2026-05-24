import Heatmap from "@/components/Heatmap";
import { getData } from "@/lib/data";

export default function HeatmapPage() {
  const { heatmap } = getData();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Rank heatmap (top 50 current)</h1>
        <p className="text-sm text-[var(--fg-dim)]">
          Green = good rank, red = poor rank. Rows are sorted by today&apos;s rank, columns are time.
          Hover any cell for exact rank.
        </p>
      </div>
      <Heatmap symbols={heatmap.symbols} dates={heatmap.dates} matrix={heatmap.matrix} />
    </div>
  );
}
