"""
Scrape CoinMarketCap historical weekly snapshots (top 200 by rank).

Output:
  raw/YYYYMMDD.json  - one file per snapshot, parsed from page's __NEXT_DATA__
  snapshots.parquet  - flat long table: one row per (date, coin)

Idempotent: existing raw files are skipped.
"""
from __future__ import annotations
import json
import re
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
PARQUET = DATA / "snapshots.parquet"

WEEKS_BACK = 104  # 2 years
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
SLEEP = 2.5  # be polite
RETRIES = 3

NEXT_DATA_RE = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', re.S)


def sundays(n: int) -> list[date]:
    today = date.today()
    # most recent Sunday on or before today (weekday: Mon=0..Sun=6)
    last_sun = today - timedelta(days=(today.weekday() + 1) % 7)
    return [last_sun - timedelta(weeks=i) for i in range(n)]


def fetch_snapshot(d: date) -> dict | None:
    url = f"https://coinmarketcap.com/historical/{d.strftime('%Y%m%d')}/"
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
            if r.status_code == 404:
                print(f"  [{d}] 404 (no snapshot for this date)")
                return None
            r.raise_for_status()
            m = NEXT_DATA_RE.search(r.text)
            if not m:
                raise ValueError("__NEXT_DATA__ not found")
            data = json.loads(m.group(1))
            init = json.loads(data["props"]["initialState"])
            rows = init["cryptocurrency"]["listingHistorical"]["data"]
            if not rows:
                raise ValueError("listingHistorical.data empty")
            return {"date": d.isoformat(), "url": url, "tokens": rows}
        except Exception as e:
            print(f"  [{d}] attempt {attempt} failed: {e}")
            if attempt < RETRIES:
                time.sleep(5 * attempt)
    return None


def flatten(snap: dict) -> list[dict]:
    out = []
    snap_date = snap["date"]
    for t in snap["tokens"]:
        usd = (t.get("quote") or {}).get("USD", {})
        out.append({
            "date": snap_date,
            "cmc_rank": t.get("cmcRank"),
            "id": t.get("id"),
            "symbol": t.get("symbol"),
            "name": t.get("name"),
            "slug": t.get("slug"),
            "price_usd": usd.get("price"),
            "market_cap_usd": usd.get("marketCap"),
            "volume_24h_usd": usd.get("volume24h"),
            "pct_change_24h": usd.get("percentChange24h"),
            "pct_change_7d": usd.get("percentChange7d"),
            "circulating_supply": t.get("circulatingSupply"),
            "total_supply": t.get("totalSupply"),
            "max_supply": t.get("maxSupply"),
            "num_market_pairs": t.get("numMarketPairs"),
            "date_added": t.get("dateAdded"),
            "tags": ",".join(t.get("tags") or []) or None,
        })
    return out


def main():
    RAW.mkdir(exist_ok=True)
    dates = sundays(WEEKS_BACK)
    print(f"Target: {len(dates)} weekly snapshots from {dates[-1]} to {dates[0]}")

    fetched, skipped, failed = 0, 0, 0
    for d in dates:
        path = RAW / f"{d.strftime('%Y%m%d')}.json"
        if path.exists():
            skipped += 1
            continue
        snap = fetch_snapshot(d)
        if snap is None:
            failed += 1
            continue
        path.write_text(json.dumps(snap))
        print(f"  [{d}] saved {len(snap['tokens'])} tokens")
        fetched += 1
        time.sleep(SLEEP)

    print(f"\nFetch summary: fetched={fetched} cached={skipped} failed={failed}")

    # Build parquet from all raw files
    all_rows = []
    for p in sorted(RAW.glob("*.json")):
        snap = json.loads(p.read_text())
        all_rows.extend(flatten(snap))

    if not all_rows:
        print("No data to write.")
        return

    df = pd.DataFrame(all_rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["date", "cmc_rank"]).reset_index(drop=True)
    df.to_parquet(PARQUET, index=False)
    print(f"Wrote {len(df):,} rows across {df['date'].nunique()} snapshots -> {PARQUET}")


if __name__ == "__main__":
    sys.exit(main())
