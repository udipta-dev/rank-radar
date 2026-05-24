export function fmtMcap(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function fmtDelta(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n > 0) return `+${n}`;
  return String(n);
}

export function fmtDate(s: string): string {
  return s.slice(0, 10);
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtMultiple(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return `${n.toFixed(digits)}x`;
}
