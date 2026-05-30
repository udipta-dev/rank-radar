"""
Scrape Farcaster $cashtag mentions via Warpcast's public client search API.

Why Warpcast and not Neynar: Neynar's /v2/farcaster/cast/search endpoint
is paid-only. Warpcast's client.warpcast.com/v2/search-casts is the same
engine the official Warpcast app uses, no auth, no rate limit headaches.
If we ever want richer data, can swap back to Neynar with a paid key.

Output: data/farcaster/YYYY-MM-DD.json on trending-data branch.

No env vars required.
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

ENDPOINT = "https://client.warpcast.com/v2/search-casts"
UA = "rank-radar/1.0 (github.com/udipta-dev/rank-radar)"
TIMEOUT = 20
RETRIES = 2
# Hard cap on symbols searched per run. Top-N by current rank.
# Each $cashtag = one Warpcast search call.
MAX_QUERIES = 120
PER_QUERY_LIMIT = 25


def search_cashtag(symbol: str) -> list[dict]:
    """One Warpcast search call. Returns list of cast dicts."""
    params = {"q": f"${symbol}", "limit": PER_QUERY_LIMIT}
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(ENDPOINT, params=params, headers={"User-Agent": UA},
                             timeout=TIMEOUT)
            if r.status_code == 200:
                data = r.json()
                # Warpcast shape: { result: { casts: [...] } }
                result = data.get("result", {})
                return result.get("casts", []) or []
            print(f"  ${symbol}: HTTP {r.status_code} {r.text[:120]}")
            if r.status_code in (429, 503) and attempt < RETRIES:
                time.sleep(3 * attempt)
                continue
            return []
        except Exception as e:
            print(f"  ${symbol}: error {e}")
            if attempt < RETRIES:
                time.sleep(2 * attempt)
    return []


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    # casts older than 1 hour are dropped — we want fresh signal only
    cutoff_ts_ms = (now.timestamp() - 3600) * 1000

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
        top_syms = list(universe)[:MAX_QUERIES]
    print(f"querying Warpcast for {len(top_syms)} cashtags")

    mentions: list[dict] = []
    queried = 0
    for sym in top_syms:
        casts = search_cashtag(sym)
        queried += 1
        for c in casts:
            ts_ms = c.get("timestamp") or 0
            if ts_ms < cutoff_ts_ms:
                continue
            text = (c.get("text") or "").strip()
            mentions.append({
                "symbol": sym,
                "cast_hash": c.get("hash"),
                "author": (c.get("author") or {}).get("username"),
                "ts_ms": ts_ms,
                "snippet": text[:160],
                "reactions": (c.get("reactions") or {}).get("count", 0) if isinstance(c.get("reactions"), dict) else 0,
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
