"""
Shared helper: extract $cashtag mentions from social-media text.

V1 is cashtag-only. People often type bare BTC without the $, but
allowing bare uppercase is too noisy (BUT, ARE, NOW, etc.). We accept
the precision/recall trade per the plan.
"""
from __future__ import annotations
import re
from typing import Iterable

# $XXX where XXX is 2-10 uppercase letters/digits. The leading $ must
# be at a word boundary so we don't match "amount $5BTC" style noise
# inside other tokens.
CASHTAG_RE = re.compile(r"(?:(?<=^)|(?<=[\s\W]))\$([A-Z][A-Z0-9]{1,9})\b")


def extract_cashtags(text: str, universe: set[str] | None = None) -> list[str]:
    """Return unique cashtag symbols (uppercased, without $) found in text.
    If `universe` is given, only return symbols that are in it (typical use:
    intersect against our 367-coin allowlist so $RANDOMSCAM is dropped).
    """
    if not text:
        return []
    found = CASHTAG_RE.findall(text.upper())
    seen: list[str] = []
    seen_set: set[str] = set()
    for sym in found:
        if sym in seen_set:
            continue
        if universe is not None and sym not in universe:
            continue
        seen_set.add(sym)
        seen.append(sym)
    return seen


def load_symbol_universe(web_json_path: "str | None" = None) -> set[str]:
    """Load the set of known symbols from web.json's trajectories keys.
    Falls back to a tiny built-in set if file not found (for local testing)."""
    import json
    import os
    from pathlib import Path

    path = web_json_path or os.environ.get("WEB_JSON_PATH") or (
        Path(__file__).parent.parent / "data" / "web.json"
    )
    try:
        doc = json.loads(Path(path).read_text())
        return set((doc.get("trajectories") or {}).keys())
    except Exception:
        # fallback so the scrapers can still run in CI before web.json exists
        return {
            "BTC", "ETH", "USDT", "BNB", "SOL", "USDC", "XRP", "DOGE", "TRX",
            "TON", "ADA", "AVAX", "SHIB", "LINK", "BCH", "DOT", "NEAR", "LTC",
            "MATIC", "PEPE", "WIF", "BONK", "PENGU", "HYPE", "AAVE", "UNI",
        }


def batch_iter(items: Iterable, size: int):
    """Yield successive size-sized chunks from items."""
    batch: list = []
    for x in items:
        batch.append(x)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch
