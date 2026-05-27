"""
Scrape CoinGecko /search/trending — all three sections: coins (15), NFTs (7),
categories (6). Appends one snapshot to data/trending/YYYY-MM-DD.json.

Cadence: cron every 30 min (CG only refreshes their list every ~10 min on their
side, so faster polling just gives duplicates).
"""
from __future__ import annotations
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
OUT_DIR = Path(os.environ.get("TRENDING_OUT_DIR", str(ROOT / "data" / "trending")))
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


def shape_coins(payload: dict) -> list[dict]:
    out = []
    for entry in payload.get("coins", []):
        item = entry.get("item", {})
        data = item.get("data", {}) or {}
        out.append({
            "id": item.get("id"),
            "symbol": (item.get("symbol") or "").upper(),
            "name": item.get("name"),
            "mcap_rank": item.get("market_cap_rank"),
            "score": item.get("score"),
            "price_usd": data.get("price"),
            "pct_24h": (data.get("price_change_percentage_24h") or {}).get("usd"),
        })
    return out


def shape_nfts(payload: dict) -> list[dict]:
    out = []
    for i, item in enumerate(payload.get("nfts", [])):
        data = item.get("data", {}) or {}
        out.append({
            "id": item.get("id"),
            "name": item.get("name"),
            "symbol": item.get("symbol"),
            "contract": item.get("nft_contract_id"),
            "score": i,  # ordinal position, NFTs don't carry their own score
            "native_currency": item.get("native_currency_symbol"),
            "floor_native": item.get("floor_price_in_native_currency"),
            "floor_usd": data.get("floor_price_in_usd_24h_percentage_change") and data.get("floor_price"),
            "floor_24h_pct_native": item.get("floor_price_24h_percentage_change"),
            "h24_volume": data.get("h24_volume"),
            "h24_avg_sale_price": data.get("h24_average_sale_price"),
        })
    return out


def shape_categories(payload: dict) -> list[dict]:
    out = []
    for i, item in enumerate(payload.get("categories", [])):
        data = item.get("data", {}) or {}
        out.append({
            "id": item.get("id"),
            "name": item.get("name"),
            "slug": item.get("slug"),
            "score": i,  # ordinal position
            "coins_count": item.get("coins_count"),
            "mcap_1h_change": item.get("market_cap_1h_change"),
            "mcap": data.get("market_cap"),
            "total_volume": data.get("total_volume"),
            "mcap_24h_change_usd": (data.get("market_cap_change_percentage_24h") or {}).get("usd"),
        })
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    payload = fetch()
    coins = shape_coins(payload)
    nfts = shape_nfts(payload)
    categories = shape_categories(payload)
    if not coins and not nfts and not categories:
        print("empty trending response, aborting")
        return 1

    today = now.date().isoformat()
    path = OUT_DIR / f"{today}.json"
    if path.exists():
        doc = json.loads(path.read_text())
        # migrate old shape if needed (had only "snapshots" with just coins)
        doc.setdefault("date", today)
        doc.setdefault("snapshots", [])
    else:
        doc = {"date": today, "snapshots": []}

    doc["snapshots"].append({
        "ts": now.isoformat().replace("+00:00", "Z"),
        "coins": coins,
        "nfts": nfts,
        "categories": categories,
    })
    path.write_text(json.dumps(doc))
    top_c = ", ".join(c["symbol"] for c in coins[:3])
    top_n = ", ".join(n["name"][:18] for n in nfts[:3])
    top_cat = ", ".join(c["name"][:18] for c in categories[:3])
    print(f"saved {path}  ({len(doc['snapshots'])} snapshots today)")
    print(f"  top coins: {top_c}")
    print(f"  top nfts:  {top_n}")
    print(f"  top cats:  {top_cat}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
