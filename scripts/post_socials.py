"""
Auto-post the day's freshest analyst insight to Farcaster and Bluesky.

Reads insights.home from data/web.json, picks the punchiest sentence,
appends the URL, posts to both platforms. Fails open on missing creds
or API errors. Pipeline never breaks on social failure.

Env vars (all optional, missing = skip that platform):
  NEYNAR_API_KEY        Farcaster post via Neynar
  NEYNAR_SIGNER_UUID    Farcaster signer UUID (one-time setup at neynar.com)
  BLUESKY_HANDLE        Bluesky handle (e.g. udipta.bsky.social)
  BLUESKY_APP_PASSWORD  Bluesky app password (settings → app passwords)
"""
from __future__ import annotations
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
WEB_JSON = ROOT / "data" / "web.json"
SITE_URL = "https://rank-radar-alpha.vercel.app"
TIMEOUT = 20


# --- pick the post text ------------------------------------------------------


def pick_hook(insight: str) -> str:
    """Pick the sharpest sentence from the home insight. Heuristic: prefer
    a sentence that mentions a specific coin and has opinionated punch.
    Fallback to first sentence."""
    if not insight:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", insight.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return ""

    # score sentences: contains a known-coin-ish ALLCAPS token + opinion words
    opinion = re.compile(
        r"\b(crushed|nuked|bleeding|ticking|king|beast|dead|rolled over|"
        r"stay clear|watch|huge|massive|real|fade|pump|degen|alpha)\b",
        re.I,
    )
    sym_pattern = re.compile(r"\b[A-Z]{2,8}\b")

    def score(s: str) -> int:
        syms = sym_pattern.findall(s)
        if not syms:
            return 0
        return len(syms) + (3 if opinion.search(s) else 0)

    ranked = sorted(sentences, key=lambda s: (-score(s), len(s)))
    pick = ranked[0]

    # length guard: keep <= 240 chars so we leave room for URL
    if len(pick) > 240:
        pick = pick[:237].rstrip() + "..."
    return pick


def build_post_text(insight: str) -> str:
    hook = pick_hook(insight)
    if not hook:
        return ""
    return f"{hook}\n\n{SITE_URL}"


# --- Farcaster post ----------------------------------------------------------


def post_farcaster(text: str) -> bool:
    api_key = os.environ.get("NEYNAR_API_KEY")
    signer = os.environ.get("NEYNAR_SIGNER_UUID")
    if not api_key or not signer:
        print("  farcaster: no NEYNAR creds, skipping")
        return False
    try:
        r = requests.post(
            "https://api.neynar.com/v2/farcaster/cast",
            headers={
                "accept": "application/json",
                "content-type": "application/json",
                "x-api-key": api_key,
            },
            json={"signer_uuid": signer, "text": text},
            timeout=TIMEOUT,
        )
        if r.status_code in (200, 201):
            print(f"  farcaster: posted ({r.status_code})")
            return True
        print(f"  farcaster: HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"  farcaster: error {e}")
    return False


# --- Bluesky post via AT Protocol --------------------------------------------


def post_bluesky(text: str) -> bool:
    handle = os.environ.get("BLUESKY_HANDLE")
    pw = os.environ.get("BLUESKY_APP_PASSWORD")
    if not handle or not pw:
        print("  bluesky: no creds, skipping")
        return False
    try:
        # 1. create session
        s = requests.post(
            "https://bsky.social/xrpc/com.atproto.server.createSession",
            json={"identifier": handle, "password": pw},
            timeout=TIMEOUT,
        )
        if s.status_code != 200:
            print(f"  bluesky: login failed HTTP {s.status_code}: {s.text[:200]}")
            return False
        sess = s.json()
        token = sess["accessJwt"]
        did = sess["did"]

        # 2. detect URL and build facets so it renders as a clickable link
        record: dict = {
            "$type": "app.bsky.feed.post",
            "text": text,
            "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "langs": ["en"],
        }
        # find the URL in text and build a byte-range facet
        m = re.search(r"https?://\S+", text)
        if m:
            url = m.group(0)
            # AT Protocol facet byteStart/byteEnd are byte offsets in UTF-8
            prefix_bytes = len(text[: m.start()].encode("utf-8"))
            url_bytes = len(url.encode("utf-8"))
            record["facets"] = [{
                "index": {"byteStart": prefix_bytes, "byteEnd": prefix_bytes + url_bytes},
                "features": [{"$type": "app.bsky.richtext.facet#link", "uri": url}],
            }]

        # 3. post
        r = requests.post(
            "https://bsky.social/xrpc/com.atproto.repo.createRecord",
            headers={"Authorization": f"Bearer {token}"},
            json={"repo": did, "collection": "app.bsky.feed.post", "record": record},
            timeout=TIMEOUT,
        )
        if r.status_code in (200, 201):
            print(f"  bluesky: posted ({r.status_code})")
            return True
        print(f"  bluesky: HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"  bluesky: error {e}")
    return False


# --- main --------------------------------------------------------------------


def main():
    if not WEB_JSON.exists():
        print("no web.json, aborting")
        return 1
    doc = json.loads(WEB_JSON.read_text())
    insight = (doc.get("insights") or {}).get("home", "") or ""
    text = build_post_text(insight)
    if not text:
        print("no insight to post, skipping all platforms")
        return 0

    print(f"posting hook: {text.splitlines()[0]}")
    ok_fc = post_farcaster(text)
    ok_bs = post_bluesky(text)
    print(f"done: farcaster={'ok' if ok_fc else 'skip'} bluesky={'ok' if ok_bs else 'skip'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
