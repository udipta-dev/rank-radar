"""
Scrape CMC current top-200 listing (live, not historical) and save as a
daily snapshot. Run from cron once per day.

Output: data/daily/YYYY-MM-DD.json  (same schema as data/raw/*.json)

Idempotent within a day: if today's file exists, overwrite (newer data is
better since we run early UTC).
"""
from __future__ import annotations
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
DAILY = ROOT / "data" / "daily"
URL = "https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=1&limit=200&convertId=2781"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
RETRIES = 3


def fetch():
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(URL, headers={"User-Agent": UA}, timeout=30)
            r.raise_for_status()
            d = r.json()
            rows = d.get("data", {}).get("cryptoCurrencyList", [])
            if not rows:
                raise ValueError("empty cryptoCurrencyList")
            return rows
        except Exception as e:
            print(f"attempt {attempt} failed: {e}")
            if attempt < RETRIES:
                time.sleep(5 * attempt)
    raise RuntimeError("all retries failed")


def to_historical_shape(rows: list[dict]) -> list[dict]:
    """Convert /listing response into the same record shape as /historical pages.
    Skip rows without a real cmcRank — the listing endpoint sometimes prefixes
    index/derivative products (e.g. CMC20) with no rank."""
    out = []
    for r in rows:
        if r.get("cmcRank") is None:
            continue
        q = (r.get("quotes") or [{}])[0]
        out.append({
            "id": r.get("id"),
            "name": r.get("name"),
            "symbol": r.get("symbol"),
            "slug": r.get("slug"),
            "cmcRank": r.get("cmcRank"),
            "numMarketPairs": r.get("marketPairCount"),
            "circulatingSupply": r.get("circulatingSupply"),
            "totalSupply": r.get("totalSupply"),
            "maxSupply": r.get("maxSupply"),
            "lastUpdated": r.get("lastUpdated"),
            "dateAdded": r.get("dateAdded"),
            "tags": r.get("tags") or [],
            "quote": {
                "USD": {
                    "price": q.get("price"),
                    "volume24h": q.get("volume24h"),
                    "marketCap": q.get("marketCap"),
                    "percentChange1h": q.get("percentChange1h"),
                    "percentChange24h": q.get("percentChange24h"),
                    "percentChange7d": q.get("percentChange7d"),
                    "lastUpdated": q.get("lastUpdated"),
                },
            },
        })
    return out


def main():
    DAILY.mkdir(parents=True, exist_ok=True)
    rows = fetch()
    today = datetime.now(timezone.utc).date().isoformat()
    tokens = to_historical_shape(rows)
    snap = {
        "date": today,
        "url": URL,
        "source": "cmc-data-api-listing",
        "tokens": tokens,
    }
    path = DAILY / f"{today}.json"
    path.write_text(json.dumps(snap))
    top = tokens[0]
    print(f"saved {path}  ({len(tokens)} tokens, top rank {top['cmcRank']} = {top['symbol']})")


if __name__ == "__main__":
    sys.exit(main())
