import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "rank-radar",
  description: "Personal crypto rank-tracking dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-[var(--fg-dim)] border-t border-[var(--border)] mt-12">
          Data from CoinMarketCap weekly historical snapshots. Personal use only.
        </footer>
      </body>
    </html>
  );
}
