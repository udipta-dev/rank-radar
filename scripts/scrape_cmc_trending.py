"""
Scrape CMC's trending tokens via their public data-api (same API the
trending page uses client-side). No API key needed.

CMC trending is included specifically because divergence from CG, Farcaster
and Reddit is itself a signal — CMC is the most-manipulated of the four.

Output: data/cmc_trending/YYYY-MM-DD.json on trending-data branch.
Each daily file accumulates 30-min snapshots.
"""
from __future__ import annotations
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

OUT_DIR = Path(os.environ.get(
    "TRENDING_OUT_DIR", str(Path(__file__).parent.parent / "data" / "trending")
)).parent / "cmc_trending"

# Public data-api endpoint. Returns top tokens sorted by trending_24h.
URL = (
    "https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing"
    "?limit=30&start=1&convertId=2781&sortBy=trending_24h"
)
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36"
TIMEOUT = 25
RETRIES = 2


def fetch():
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(URL, headers={"User-Agent": UA}, timeout=TIMEOUT)
            if r.status_code == 200:
                return r.json()
            print(f"  HTTP {r.status_code}, attempt {attempt}")
            if attempt < RETRIES:
                time.sleep(3 * attempt)
        except Exception as e:
            print(f"  error {e}")
            if attempt < RETRIES:
                time.sleep(3 * attempt)
    return None


def shape(rows: list[dict]) -> list[dict]:
    out = []
    for i, r in enumerate(rows):
        sym = (r.get("symbol") or "").upper()
        if not sym:
            continue
        out.append({
            "rank": i + 1,
            "symbol": sym,
            "name": r.get("name"),
            "cmc_rank": r.get("cmcRank"),
            "id": r.get("id"),
        })
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    payload = fetch()
    if not payload:
        print("could not fetch CMC trending payload, aborting")
        return 1
    rows = (payload.get("data") or {}).get("cryptoCurrencyList") or []
    shaped = shape(rows)
    if not shaped:
        print("no trending rows extracted from CMC payload")
        return 1

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
        "tokens": shaped,
    })
    out_path.write_text(json.dumps(doc))
    top3 = ", ".join(t["symbol"] for t in shaped[:3])
    print(f"saved {out_path}  tokens={len(shaped)} top3: {top3}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
