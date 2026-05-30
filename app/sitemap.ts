import type { MetadataRoute } from "next";
import { getData } from "@/lib/data";

const SITE_URL = "https://rank-radar-alpha.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const data = getData();
  const lastModified = data.metadata?.generatedAt
    ? new Date(data.metadata.generatedAt)
    : new Date();

  const mainRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL + "/", lastModified, changeFrequency: "daily", priority: 1.0 },
    { url: SITE_URL + "/movements", lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: SITE_URL + "/quiet", lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: SITE_URL + "/float", lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: SITE_URL + "/trending", lastModified, changeFrequency: "hourly", priority: 0.9 },
    { url: SITE_URL + "/narratives", lastModified, changeFrequency: "hourly", priority: 0.8 },
    { url: SITE_URL + "/nfts", lastModified, changeFrequency: "hourly", priority: 0.7 },
    { url: SITE_URL + "/charts", lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: SITE_URL + "/notes", lastModified, changeFrequency: "daily", priority: 0.7 },
  ];

  const coinRoutes: MetadataRoute.Sitemap = Object.keys(data.trajectories ?? {}).map(
    (symbol) => ({
      url: `${SITE_URL}/coin/${encodeURIComponent(symbol)}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }),
  );

  return [...mainRoutes, ...coinRoutes];
}
