import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import Nav from "@/components/Nav";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "rank-radar — crypto rank, float and attention tracker",
  description:
    "Personal dashboard tracking CMC rank movements, FDV / float overhang, and CoinGecko trending persistence (coins, NFTs, narratives).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-[var(--fg-dim)] border-t border-[var(--border)] mt-12">
          Data from CoinMarketCap weekly historical snapshots and CoinGecko trending. Personal use only.
        </footer>
        {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      </body>
    </html>
  );
}
