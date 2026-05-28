"""
Slim trending-only publish step. Runs every 30 min to keep the site fresh.

Reads existing data/web.json, recomputes ONLY the trending section from the
latest trending-data branch checkout, writes back. Does NOT touch the rank
analysis (that's the daily refresh's job — CMC data only changes daily).

This is what makes /trending feel alive between the once-daily heavyweight runs.
"""
from __future__ import annotations
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# reuse the heavy-lift function from the daily exporter
sys.path.insert(0, str(Path(__file__).parent))
from export_for_web import compute_trending  # noqa: E402

ROOT = Path(__file__).parent.parent
WEB_JSON = ROOT / "data" / "web.json"
TRENDING_DIR = Path(os.environ.get("TRENDING_DIR", str(ROOT / "data" / "trending")))


def main():
    if not WEB_JSON.exists():
        print(f"no web.json at {WEB_JSON}, aborting (run daily refresh first)")
        return 1
    doc = json.loads(WEB_JSON.read_text())

    print(f"refreshing trending section from {TRENDING_DIR}")
    fresh = compute_trending(TRENDING_DIR)
    doc["trending"] = fresh

    # bump the generated timestamp so the page footer reflects this refresh
    if isinstance(doc.get("metadata"), dict):
        doc["metadata"]["generatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    WEB_JSON.write_text(json.dumps(doc, default=str))
    print(f"  snapshots: {fresh.get('snapshotCount30d', 0)}")
    print(f"  coins: {len(fresh.get('perCoin', {}))}")
    print(f"  latestSnapshotTs: {fresh.get('latestSnapshotTs')}")
    print(f"wrote {WEB_JSON} ({WEB_JSON.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
