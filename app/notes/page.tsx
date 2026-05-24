import { getData } from "@/lib/data";
import { fmtDate } from "@/lib/format";

export default function NotesPage() {
  const { summaryMd, metadata } = getData();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Analyst notes</h1>
        <p className="text-sm text-[var(--fg-dim)]">
          Auto-generated picks from the most recent run.
          Last refresh: {fmtDate(metadata.generatedAt)}.
        </p>
      </div>
      {summaryMd ? (
        <div className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-6">
          <pre className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--fg)] font-mono">
            {summaryMd}
          </pre>
        </div>
      ) : (
        <p className="text-[var(--fg-dim)]">No summary generated yet.</p>
      )}
    </div>
  );
}
