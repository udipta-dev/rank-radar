import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import Nav from "@/components/Nav";
import MarketStrip from "@/components/MarketStrip";
import { getData } from "@/lib/data";
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

const SITE_URL = "https://rank-radar-alpha.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "rank-radar — crypto rank, float and attention tracker",
  description:
    "2 years of CMC rank history, FDV / float / unlock analysis, and CoinGecko trending persistence (coins, NFTs, narratives). Updated daily.",
  openGraph: {
    title: "rank-radar — crypto rank, float and attention tracker",
    description:
      "2 years of CMC rank history, FDV / float / unlock analysis, and CoinGecko trending persistence (coins, NFTs, narratives). Updated daily.",
    url: SITE_URL,
    siteName: "rank-radar",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "rank-radar heatmap" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "rank-radar",
    description:
      "2 years of CMC rank history + CoinGecko trending persistence. Updated daily.",
    images: ["/og.png"],
  },
};

const datasetSchema = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "rank-radar",
  description:
    "Two years of CoinMarketCap rank history across 367 coins, daily live snapshots, FDV and float overhang analysis, and CoinGecko trending persistence for coins, NFTs, and narrative categories. Updated daily.",
  url: SITE_URL,
  keywords: [
    "crypto",
    "cryptocurrency",
    "market cap rank",
    "FDV",
    "float",
    "unlock cliff",
    "CoinGecko trending",
    "narrative rotation",
    "rank radar",
  ],
  creator: {
    "@type": "Person",
    name: "Udipta",
  },
  license: "https://opensource.org/license/mit",
  isAccessibleForFree: true,
  variableMeasured: [
    "CMC market cap rank over time",
    "Market capitalization",
    "Fully diluted valuation",
    "Float percentage",
    "Trending list appearance count over 24h / 7d / 30d windows",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { market } = getData();
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <MarketStrip market={market} variant="strip" />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-[var(--fg-dim)] border-t border-[var(--border)] mt-12">
          Data from CoinMarketCap weekly historical snapshots and CoinGecko trending. Personal use only.
        </footer>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }}
        />
        {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      </body>
    </html>
  );
}
