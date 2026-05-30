"""
Scrape Farcaster $cashtag mentions via Neynar's search API.

Strategy: for each top-tier symbol in our universe (top 100 by current
CMC rank), do a single Neynar cast search for "$SYMBOL" and count hits
in the last hour. Aggregate. v1 stays focused on top 100 to keep the
API budget tiny and the signal cleaner — meme-coin discussion below
that often spikes randomly.

Output: data/farcaster/YYYY-MM-DD.json on trending-data branch.

Env vars:
  NEYNAR_API_KEY   required; missing = skip gracefully
  TRENDING_OUT_DIR points at the trending-data data/trending dir; we
                   write to a sibling data/farcaster/
"""
from __future__ import annotations
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from symbol_detect import load_symbol_universe  # noqa: E402

OUT_DIR = Path(os.environ.get(
    "TRENDING_OUT_DIR", str(Path(__file__).parent.parent / "data" / "trending")
)).parent / "farcaster"
API_KEY = os.environ.get("NEYNAR_API_KEY")
ENDPOINT = "https://api.neynar.com/v2/farcaster/cast/search"
TIMEOUT = 20
RETRIES = 2
# narrower symbol set: top-100-ish coins by current rank, to keep API
# budget under control and signal high. Pulled from web.json's tables
# in main(). Hard cap at 120.
MAX_QUERIES = 120


def search_cashtag(symbol: str) -> list[dict]:
    """One Neynar search call. Returns list of casts (raw) — we only need IDs and hashes."""
    if not API_KEY:
        return []
    params = {"q": f"${symbol}", "limit": 25}
    headers = {"accept": "application/json", "x-api-key": API_KEY}
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(ENDPOINT, params=params, headers=headers, timeout=TIMEOUT)
            if r.status_code == 200:
                data = r.json()
                # Neynar shape: { result: { casts: [...] } }
                return data.get("result", {}).get("casts", []) or []
            print(f"  ${symbol}: HTTP {r.status_code} {r.text[:120]}")
            if r.status_code == 429 and attempt < RETRIES:
                time.sleep(2 * attempt)
                continue
            return []
        except Exception as e:
            print(f"  ${symbol}: error {e}")
            if attempt < RETRIES:
                time.sleep(2 * attempt)
    return []


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if not API_KEY:
        print("warning: NEYNAR_API_KEY not set, writing empty snapshot")

    now = datetime.now(timezone.utc)
    # cutoff to dedupe casts older than the last hour
    cutoff_ts = (now.timestamp() - 3600)

    # build the symbol list. read web.json for current top-N by rank.
    universe = load_symbol_universe()
    web_json = Path(__file__).parent.parent / "data" / "web.json"
    top_syms: list[str] = []
    if web_json.exists():
        try:
            doc = json.loads(web_json.read_text())
            momentum = doc.get("momentum") or {}
            ranked = sorted(
                ((s, m.get("currentRank")) for s, m in momentum.items() if m.get("currentRank")),
                key=lambda kv: kv[1],
            )
            top_syms = [s for s, _ in ranked[:MAX_QUERIES]]
        except Exception as e:
            print(f"could not read web.json: {e}")
    if not top_syms:
        # fallback to first slice of universe
        top_syms = list(universe)[:MAX_QUERIES]
    print(f"querying Neynar for {len(top_syms)} cashtags (top-ranked subset of universe)")

    mentions: list[dict] = []
    queried = 0
    for sym in top_syms:
        if not API_KEY:
            break
        casts = search_cashtag(sym)
        queried += 1
        for c in casts:
            ts_str = c.get("timestamp") or ""
            try:
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).timestamp()
            except Exception:
                ts = now.timestamp()
            if ts < cutoff_ts:
                continue
            mentions.append({
                "symbol": sym,
                "cast_hash": c.get("hash"),
                "author_fid": (c.get("author") or {}).get("fid"),
                "snippet": (c.get("text") or "")[:160],
            })

    today = now.date().isoformat()
    out_path = OUT_DIR / f"{today}.json"
    if out_path.exists():
        try:
            doc = json.loads(out_path.read_text())
        except Exception:
            doc = {"date": today, "snapshots": []}
    else:
        doc = {"date": today, "snapshots": []}

    doc["snapshots"].append({
        "ts": now.isoformat().replace("+00:00", "Z"),
        "queries": queried,
        "mentions": mentions,
    })
    out_path.write_text(json.dumps(doc))
    by_sym: dict[str, int] = {}
    for m in mentions:
        by_sym[m["symbol"]] = by_sym.get(m["symbol"], 0) + 1
    top = ", ".join(f"{s}:{n}" for s, n in sorted(by_sym.items(), key=lambda kv: -kv[1])[:5]) or "—"
    print(f"saved {out_path}  queries={queried} mentions={len(mentions)} top: {top}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
