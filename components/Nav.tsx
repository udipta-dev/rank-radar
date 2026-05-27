"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/movements", label: "Movements" },
  { href: "/quiet", label: "Quiet Accumulators" },
  { href: "/float", label: "Float / Unlock" },
  { href: "/trending", label: "Trending" },
  { href: "/narratives", label: "Narratives" },
  { href: "/nfts", label: "NFTs" },
  { href: "/charts", label: "Visualize" },
  { href: "/notes", label: "Notes" },
];

const linkClass =
  "px-3 py-1.5 rounded text-sm text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--border)] transition-colors";

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg-elev)]">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="font-bold text-[var(--accent)] text-lg shrink-0">
          rank-radar
        </Link>

        <div className="hidden md:flex items-center gap-1 flex-wrap">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 rounded text-[var(--fg)] hover:bg-[var(--border)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[var(--border)]">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-[var(--fg)] border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--border)]"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
