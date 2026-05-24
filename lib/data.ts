import fs from "node:fs";
import path from "node:path";
import type { WebData } from "./types";

let cached: WebData | null = null;

export function getData(): WebData {
  if (cached) return cached;
  const p = path.join(process.cwd(), "data", "web.json");
  cached = JSON.parse(fs.readFileSync(p, "utf-8")) as WebData;
  return cached;
}
