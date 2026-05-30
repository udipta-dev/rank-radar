"""
Scrape Reddit cashtag mentions across 4 crypto subreddits.

Uses Reddit's public JSON endpoints. Reddit started blocking anonymous
data-center IPs (GitHub Actions, AWS, etc.) with 403 in late 2023.
If 403s persist, the upgrade path is OAuth:
  1. Register a "script" app at https://www.reddit.com/prefs/apps
  2. Add REDDIT_CLIENT_ID + REDDIT_SECRET as repo secrets
  3. This script will read them and use OAuth automatically
For v1 we ship anonymous-first, fall back to writing an empty snapshot
on 403, so the pipeline keeps running without error.

Output: data/reddit/YYYY-MM-DD.json  on the trending-data branch.
"""
from __future__ import annotations
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# allow this script to be invoked from anywhere (CI checks out main into
# a subdir, so __file__ points at main-checkout/scripts/...)
sys.path.insert(0, str(Path(__file__).parent))
from symbol_detect import extract_cashtags, load_symbol_universe  # noqa: E402

OUT_DIR = Path(os.environ.get("TRENDING_OUT_DIR_REDDIT") or os.environ.get(
    "TRENDING_OUT_DIR", str(Path(__file__).parent.parent / "data" / "trending")
)).parent / "reddit"
SUBREDDITS = ["CryptoCurrency", "CryptoMarkets", "SatoshiStreetBets", "altcoin"]
POSTS_PER_SUB = 50
TIMEOUT = 20
RETRIES = 2
UA = "web:rank-radar:v1.0 (by /u/udipta-dev)"
CLIENT_ID = os.environ.get("REDDIT_CLIENT_ID")
SECRET = os.environ.get("REDDIT_SECRET")


def get_oauth_token() -> str | None:
    """If OAuth creds are configured, fetch an app-only access token."""
    if not CLIENT_ID or not SECRET:
        return None
    try:
        r = requests.post(
            "https://www.reddit.com/api/v1/access_token",
            auth=(CLIENT_ID, SECRET),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": UA},
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            return r.json().get("access_token")
        print(f"  oauth token HTTP {r.status_code}: {r.text[:120]}")
    except Exception as e:
        print(f"  oauth token error {e}")
    return None


def fetch_sub(sub: str, token: str | None) -> list[dict]:
    """Pull /new from a subreddit. Returns the children list."""
    if token:
        url = f"https://oauth.reddit.com/r/{sub}/new?limit={POSTS_PER_SUB}"
        headers = {"User-Agent": UA, "Authorization": f"Bearer {token}"}
    else:
        url = f"https://www.reddit.com/r/{sub}/new.json?limit={POSTS_PER_SUB}"
        headers = {"User-Agent": UA}
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(url, headers=headers, timeout=TIMEOUT)
            if r.status_code == 200:
                return r.json().get("data", {}).get("children", []) or []
            print(f"  {sub}: HTTP {r.status_code}, attempt {attempt}")
            if r.status_code in (429, 503) and attempt < RETRIES:
                time.sleep(5 * attempt)
                continue
            return []
        except Exception as e:
            print(f"  {sub}: error {e}")
            if attempt < RETRIES:
                time.sleep(3 * attempt)
    return []


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    universe = load_symbol_universe()
    print(f"loaded {len(universe)} known symbols from web.json universe")

    token = get_oauth_token()
    if token:
        print("using OAuth (REDDIT_CLIENT_ID/SECRET set)")
    else:
        print("no Reddit OAuth creds, falling back to anonymous (likely 403 on CI IPs)")

    mentions: list[dict] = []
    posts_scanned = 0
    for sub in SUBREDDITS:
        children = fetch_sub(sub, token)
        posts_scanned += len(children)
        for child in children:
            post = child.get("data", {})
            title = post.get("title", "") or ""
            body = post.get("selftext", "") or ""
            text = title + "\n" + body
            symbols = extract_cashtags(text, universe=universe)
            for sym in symbols:
                snippet = title[:140] if title else body[:140]
                mentions.append({
                    "symbol": sym,
                    "subreddit": sub,
                    "post_id": post.get("id"),
                    "permalink": post.get("permalink"),
                    "snippet": snippet,
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
        "posts_scanned": posts_scanned,
        "subs": SUBREDDITS,
        "mentions": mentions,
    })
    out_path.write_text(json.dumps(doc))
    by_sym: dict[str, int] = {}
    for m in mentions:
        by_sym[m["symbol"]] = by_sym.get(m["symbol"], 0) + 1
    top = ", ".join(f"{s}:{n}" for s, n in sorted(by_sym.items(), key=lambda kv: -kv[1])[:5]) or "—"
    print(f"saved {out_path}  scanned={posts_scanned} mentions={len(mentions)} top: {top}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
