import Link from "next/link";

const links = [
  { href: "/", label: "Market" },
  { href: "/climbers", label: "Climbers" },
  { href: "/quiet", label: "Quiet Accumulators" },
  { href: "/float", label: "Float / Unlock Risk" },
  { href: "/decliners", label: "Decliners" },
  { href: "/holders", label: "Stable Holders" },
  { href: "/heatmap", label: "Heatmap" },
  { href: "/trending", label: "Trending" },
  { href: "/charts", label: "Charts" },
  { href: "/notes", label: "Notes" },
];

export default function Nav() {
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg-elev)]">
      <div className="mx-auto max-w-7xl flex items-center gap-1 px-4 py-3 flex-wrap">
        <Link href="/" className="font-bold text-[var(--accent)] mr-4 text-lg">
          rank-radar
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-3 py-1.5 rounded text-sm text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--border)] transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
