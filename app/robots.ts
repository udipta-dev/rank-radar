import type { MetadataRoute } from "next";

const SITE_URL = "https://rank-radar-alpha.vercel.app";

// AI crawlers we explicitly allow. Names come from the official user-agent
// strings each company documents. Listed explicitly so future Next.js default
// changes or hosting-tier defaults can't accidentally block them.
const AI_BOTS = [
  "GPTBot",            // OpenAI training crawler
  "ChatGPT-User",      // OpenAI ChatGPT browse / plugin
  "OAI-SearchBot",     // OpenAI SearchGPT
  "ClaudeBot",         // Anthropic training crawler
  "anthropic-ai",      // Anthropic legacy ua
  "Claude-Web",        // Anthropic claude.ai browse
  "PerplexityBot",     // Perplexity retrieval
  "Perplexity-User",   // Perplexity user-triggered
  "Google-Extended",   // Google AI training (Gemini, Vertex)
  "Bytespider",        // ByteDance (Doubao, etc.)
  "Applebot-Extended", // Apple AI
  "DuckAssistBot",     // DuckDuckGo Assist
  "FacebookBot",       // Meta AI
  "Meta-ExternalAgent",
  "Diffbot",
  "Amazonbot",
  "cohere-ai",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // explicit allow for everything; the per-bot entries below are mostly
      // belt-and-suspenders since "*" already covers them
      { userAgent: "*", allow: "/" },
      ...AI_BOTS.map((ua) => ({ userAgent: ua, allow: "/" })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
