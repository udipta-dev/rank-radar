"""
Scrape Reddit cashtag mentions via Scrapling's StealthyFetcher (Camoufox).

Reddit's JSON / RSS / search endpoints are all 403'd for anonymous and
data-center IPs in 2026. Even Scrapling's basic Fetcher (TLS spoofing)
gets blocked. Only the full StealthyFetcher (Camoufox) gets through,
and only on HTML pages, not JSON. So we fetch old.reddit.com HTML for
each crypto sub, parse post titles via CSS, and extract $cashtag mentions.

Output: data/reddit/YYYY-MM-DD.json on the trending-data branch.

Runtime cost per cron tick:
  ~3-5s per sub × 4 subs = ~15-20s extra (one-time browser launch dominates)
  Camoufox download ~500MB on first install; cached on the runner after.
"""
from __future__ import annotations
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from symbol_detect import extract_cashtags, load_symbol_universe  # noqa: E402

try:
    from scrapling.fetchers import StealthyFetcher
except Exception as _imp_err:
    print(f"scrapling import failed: {type(_imp_err).__name__}: {_imp_err}")
    StealthyFetcher = None

OUT_DIR = Path(os.environ.get(
    "TRENDING_OUT_DIR", str(Path(__file__).parent.parent / "data" / "trending")
)).parent / "reddit"
SUBREDDITS = ["CryptoCurrency", "CryptoMarkets", "SatoshiStreetBets", "altcoin"]
TIMEOUT_MS = 60000  # Playwright timeout is in ms
RETRIES = 2


def fetch_sub(sub: str) -> list[dict]:
    """Pull post titles from old.reddit.com/r/SUB/new/ via Camoufox.
    Returns a list of {title, link} dicts."""
    if StealthyFetcher is None:
        print(f"  {sub}: scrapling not installed, skipping")
        return []
    url = f"https://old.reddit.com/r/{sub}/new/"
    for attempt in range(1, RETRIES + 1):
        try:
            r = StealthyFetcher.fetch(url, timeout=TIMEOUT_MS, headless=True, humanize=False)
            if r.status != 200:
                print(f"  {sub}: HTTP {r.status}, attempt {attempt}")
                continue
            # old.reddit.com post titles are <a class="title">. Body text isn't
            # in the listing page (would require per-post fetch — too expensive
            # for the v1 cashtag-only signal target).
            titles = r.css("a.title::text").getall()
            links = r.css("a.title::attr(href)").getall()
            posts = [
                {"title": t.strip(), "link": l}
                for t, l in zip(titles, links)
                if t and t.strip()
            ]
            print(f"  {sub}: {len(posts)} posts pulled")
            return posts
        except Exception as e:
            print(f"  {sub}: attempt {attempt} error: {type(e).__name__}: {str(e)[:160]}")
    return []


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    if StealthyFetcher is None:
        print("scrapling not installed, writing empty snapshot")

    universe = load_symbol_universe()
    print(f"loaded {len(universe)} known symbols from web.json universe")

    mentions: list[dict] = []
    posts_scanned = 0
    for sub in SUBREDDITS:
        posts = fetch_sub(sub)
        posts_scanned += len(posts)
        for p in posts:
            title = p["title"]
            symbols = extract_cashtags(title, universe=universe)
            for sym in symbols:
                mentions.append({
                    "symbol": sym,
                    "subreddit": sub,
                    "permalink": p.get("link"),
                    "snippet": title[:160],
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
