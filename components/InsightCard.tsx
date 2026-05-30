type Props = {
  text: string | undefined | null;
  generatedAt?: string;
};

/**
 * Renders an AI-generated analyst note. Conditionally rendered only if the
 * text string is non-empty, so missing/failed-generation insights silently
 * disappear from the page rather than showing an empty box.
 */
export default function InsightCard({ text, generatedAt }: Props) {
  if (!text || !text.trim()) return null;

  const stamp = generatedAt ? generatedAt.slice(0, 10) : "";

  return (
    <section
      aria-label="Analyst note"
      className="border border-[var(--border)] bg-[var(--bg-elev)] rounded-lg p-4 border-l-4 border-l-[var(--accent)]"
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-[var(--accent)] font-mono">
          Analyst note
        </span>
        {stamp && (
          <span className="text-xs text-[var(--fg-dim)] font-mono">{stamp}</span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-[var(--fg)] whitespace-pre-wrap">
        {text}
      </p>
    </section>
  );
}
