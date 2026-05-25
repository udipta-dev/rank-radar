"""
Scrape CoinGecko /search/trending (top 15 most-searched coins right now).
Appends one snapshot to data/trending/YYYY-MM-DD.json.

Cadence: cron every 15 min on the `trending-data` branch.
Daily aggregation: main branch's analyze.py reads these files and computes
1d/7d/30d appearance counts per coin.
"""
from __future__ import annotations
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
OUT_DIR = ROOT / "data" / "trending"
URL = "https://api.coingecko.com/api/v3/search/trending"
UA = "rank-radar/1.0 (github.com/udipta-dev/rank-radar)"
RETRIES = 3


def fetch():
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(URL, headers={"User-Agent": UA}, timeout=20)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"attempt {attempt} failed: {e}")
            if attempt < RETRIES:
                time.sleep(5 * attempt)
    raise RuntimeError("all retries failed")


def shape(payload: dict) -> list[dict]:
    """Strip the response down to the minimum we need per coin."""
    out = []
    for entry in payload.get("coins", []):
        item = entry.get("item", {})
        data = item.get("data", {}) or {}
        out.append({
            "id": item.get("id"),
            "symbol": (item.get("symbol") or "").upper(),
            "name": item.get("name"),
            "mcap_rank": item.get("market_cap_rank"),
            "score": item.get("score"),  # 0 = top of list, 14 = bottom
            "price_usd": data.get("price"),
            "pct_24h": (data.get("price_change_percentage_24h") or {}).get("usd"),
        })
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    payload = fetch()
    coins = shape(payload)
    if not coins:
        print("empty trending list, aborting")
        return 1

    today = now.date().isoformat()
    path = OUT_DIR / f"{today}.json"
    if path.exists():
        doc = json.loads(path.read_text())
    else:
        doc = {"date": today, "snapshots": []}

    doc["snapshots"].append({
        "ts": now.isoformat().replace("+00:00", "Z"),
        "coins": coins,
    })
    path.write_text(json.dumps(doc))
    top3 = ", ".join(c["symbol"] for c in coins[:3])
    print(f"saved {path}  ({len(doc['snapshots'])} snapshots today, top3: {top3})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
