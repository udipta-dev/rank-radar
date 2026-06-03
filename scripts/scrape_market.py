"""
Scrape global crypto market regime from CoinGecko /api/v3/global.

One snapshot per cron tick: total market cap (USD), CG's own 24h change %,
BTC + ETH dominance, and total 24h volume. Same free, keyless, UA-only call
as scrape_trending.py. This is the denominator for everything else on the
dashboard: rank is a *relative* measure, so a coin climbing rank while the
whole market dumps is showing genuine strength. The AI prompts and the
site banner read the regime computed from these snapshots.

Output: data/market/YYYY-MM-DD.json on the trending-data branch.
Cadence: rides trending-30min.yml (every 30 min). No env vars required.
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
# Mirror the trending scrapers: OUT_DIR is a sibling of the trending dir so the
# same TRENDING_OUT_DIR env (…/data/trending) drops market data in …/data/market.
OUT_DIR = Path(os.environ.get(
    "TRENDING_OUT_DIR", str(ROOT / "data" / "trending")
)).parent / "market"
URL = "https://api.coingecko.com/api/v3/global"
UA = "rank-radar/1.0 (github.com/udipta-dev/rank-radar)"
RETRIES = 3


def fetch() -> dict:
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


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    payload = fetch()
    data = payload.get("data") or {}

    total_mcap = (data.get("total_market_cap") or {}).get("usd")
    if total_mcap is None:
        print("no total_market_cap in response, aborting")
        return 1
    dominance = data.get("market_cap_percentage") or {}
    snapshot = {
        "ts": now.isoformat().replace("+00:00", "Z"),
        "total_mcap_usd": total_mcap,
        "change_24h_pct": data.get("market_cap_change_percentage_24h_usd"),
        "btc_dom": dominance.get("btc"),
        "eth_dom": dominance.get("eth"),
        "total_vol_usd": (data.get("total_volume") or {}).get("usd"),
        "active_cryptos": data.get("active_cryptocurrencies"),
    }

    today = now.date().isoformat()
    path = OUT_DIR / f"{today}.json"
    if path.exists():
        try:
            doc = json.loads(path.read_text())
        except Exception:
            doc = {"date": today, "snapshots": []}
        doc.setdefault("date", today)
        doc.setdefault("snapshots", [])
    else:
        doc = {"date": today, "snapshots": []}

    doc["snapshots"].append(snapshot)
    path.write_text(json.dumps(doc))
    chg = snapshot["change_24h_pct"]
    chg_s = f"{chg:+.2f}%" if isinstance(chg, (int, float)) else "n/a"
    print(f"saved {path}  ({len(doc['snapshots'])} snapshots today)")
    print(f"  total mcap ${total_mcap/1e12:.3f}T  24h {chg_s}  "
          f"BTC dom {snapshot['btc_dom']}  ETH dom {snapshot['eth_dom']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
