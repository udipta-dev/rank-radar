"""
Convert analysis outputs into a single JSON file for the Next.js site.

Reads:  data/snapshots.parquet  +  data/out/*.csv  +  data/out/summary.md
Writes: data/web.json           (consumed by the Next.js build)

The web.json is a single document so the site can fetch once and render
everything without round-trips.
"""
from __future__ import annotations
import json
import math
from pathlib import Path

import pandas as pd

import os
from datetime import datetime, timezone, timedelta
from collections import defaultdict

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
OUT = DATA / "out"
PUBLIC = ROOT / "public"
TARGET = DATA / "web.json"
# TRENDING_DIR override lets CI point at the trending-data branch checkout
TRENDING_DIR = Path(os.environ.get("TRENDING_DIR", str(DATA / "trending")))

# Include trajectories for ALL coins in the post-filter universe so the site
# can render a /coin/[symbol] page for anything. ~366 coins × ~100 snapshots
# = ~2.5MB JSON, still cacheable.


def _clean(v):
    """JSON can't carry NaN/Inf. Coerce to None."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v


def df_to_records(df: pd.DataFrame) -> list[dict]:
    return [{k: _clean(v) for k, v in row.items()} for row in df.to_dict("records")]


def load_table(name: str) -> list[dict]:
    p = OUT / f"table_{name}.csv"
    if not p.exists():
        return []
    return df_to_records(pd.read_csv(p))


def detect_bear_window(df: pd.DataFrame) -> dict:
    per_snap = df.groupby("date")["market_cap_usd"].sum().sort_index()
    cummax = per_snap.cummax()
    drawdown = (per_snap - cummax) / cummax
    trough_idx = drawdown.idxmin()
    peak_idx = per_snap.loc[:trough_idx].idxmax()
    return {
        "peak": peak_idx.isoformat() if hasattr(peak_idx, "isoformat") else str(peak_idx),
        "trough": trough_idx.isoformat() if hasattr(trough_idx, "isoformat") else str(trough_idx),
        "drawdownPct": round(float(drawdown[trough_idx]) * 100, 2),
        "peakMcap": float(per_snap[peak_idx]),
        "troughMcap": float(per_snap[trough_idx]),
    }


def compute_trending(trending_dir: Path, now: datetime | None = None) -> dict:
    """Read all trending snapshots from trending_dir/*.json (one file per day,
    each with a list of 15-min snapshots) and compute per-coin appearance metrics:
    counts over 24h / 7d / 30d windows, first / last seen, best position score,
    daily breakdown (30 buckets) for sparkline rendering."""
    if now is None:
        now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=30)
    if not trending_dir.exists():
        print(f"  no trending data dir at {trending_dir}, skipping")
        return {"trendingNow": [], "perCoin": {}, "latestSnapshotTs": None, "snapshotCount30d": 0}

    snaps: list[tuple[datetime, list[dict]]] = []
    for f in sorted(trending_dir.glob("*.json")):
        try:
            doc = json.loads(f.read_text())
        except Exception as e:
            print(f"  skipping malformed {f.name}: {e}")
            continue
        for snap in doc.get("snapshots", []):
            try:
                ts = datetime.fromisoformat(snap["ts"].replace("Z", "+00:00"))
            except Exception:
                continue
            if ts < cutoff:
                continue
            snaps.append((ts, snap.get("coins", [])))
    snaps.sort(key=lambda x: x[0])
    if not snaps:
        return {"trendingNow": [], "perCoin": {}, "latestSnapshotTs": None, "snapshotCount30d": 0}

    latest_ts, latest_coins = snaps[-1]
    today = now.date()

    per_coin: dict[str, dict] = defaultdict(lambda: {
        "id": None, "symbol": None, "name": None,
        "count24h": 0, "count7d": 0, "count30d": 0,
        "lastSeen": None, "firstSeen": None,
        "dailyCounts": [0] * 30,
        "bestPosition": 999,
    })

    for ts, coins in snaps:
        days_ago = (today - ts.date()).days
        secs_ago = (now - ts).total_seconds()
        within_1h = secs_ago <= 3600
        within_6h = secs_ago <= 6 * 3600
        within_24h = secs_ago <= 86400
        within_7d = secs_ago <= 7 * 86400
        for coin in coins:
            sym = coin.get("symbol")
            if not sym:
                continue
            c = per_coin[sym]
            c["id"] = coin.get("id")
            c["symbol"] = sym
            c["name"] = coin.get("name")
            c["count30d"] += 1
            score = coin.get("score") if isinstance(coin.get("score"), (int, float)) else None
            # weighted score: top of list (score=0) worth 15, bottom (score=14) worth 1
            weighted = (15 - int(score)) if score is not None else 1
            c["weightedScore30d"] = c.get("weightedScore30d", 0) + weighted
            if within_7d:
                c["count7d"] += 1
                c["weightedScore7d"] = c.get("weightedScore7d", 0) + weighted
            if within_24h:
                c["count24h"] += 1
                c["weightedScore24h"] = c.get("weightedScore24h", 0) + weighted
            if within_6h:
                c["count6h"] = c.get("count6h", 0) + 1
            if within_1h:
                c["count1h"] = c.get("count1h", 0) + 1
            ts_iso = ts.isoformat().replace("+00:00", "Z")
            if c["lastSeen"] is None or ts_iso > c["lastSeen"]:
                c["lastSeen"] = ts_iso
            if c["firstSeen"] is None or ts_iso < c["firstSeen"]:
                c["firstSeen"] = ts_iso
            if 0 <= days_ago < 30:
                c["dailyCounts"][29 - days_ago] += 1
            if score is not None and score < c["bestPosition"]:
                c["bestPosition"] = int(score)

    # ensure all counter fields exist on every coin
    for c in per_coin.values():
        c.setdefault("count1h", 0)
        c.setdefault("count6h", 0)
        c.setdefault("weightedScore24h", 0)
        c.setdefault("weightedScore7d", 0)
        c.setdefault("weightedScore30d", 0)

    # --- heatmap matrix: rows = coins ever trending, cols = each snapshot ts ---
    all_symbols = sorted(per_coin.keys(), key=lambda s: -per_coin[s]["count30d"])
    all_ts = [t.isoformat().replace("+00:00", "Z") for t, _ in snaps]
    sym_idx = {s: i for i, s in enumerate(all_symbols)}
    matrix: list[list[int | None]] = [[None] * len(snaps) for _ in all_symbols]
    for ci, (_, coins) in enumerate(snaps):
        for coin in coins:
            sym = coin.get("symbol")
            score = coin.get("score")
            if sym in sym_idx and isinstance(score, (int, float)):
                matrix[sym_idx[sym]][ci] = int(score)
    heatmap = {"symbols": all_symbols, "timestamps": all_ts, "matrix": matrix}

    # --- new entrants: trending NOW but not seen in any snapshot within the prior 48h ---
    current_syms = {c.get("symbol") for c in latest_coins if c.get("symbol")}
    cutoff_prior = latest_ts - timedelta(hours=48)
    seen_recent: set[str] = set()
    for ts, coins in snaps:
        if cutoff_prior <= ts < latest_ts:
            for coin in coins:
                if coin.get("symbol"):
                    seen_recent.add(coin["symbol"])
    new_entrants = sorted(current_syms - seen_recent)

    # --- fade alerts: had >=5 hits in last 7d (excl last 24h), <=1 hit in last 24h ---
    cutoff_24h = now - timedelta(hours=24)
    cutoff_7d = now - timedelta(days=7)
    prior_counts: dict[str, int] = defaultdict(int)
    recent_counts: dict[str, int] = defaultdict(int)
    for ts, coins in snaps:
        in_prior_7d = cutoff_7d <= ts < cutoff_24h
        in_recent_24h = ts >= cutoff_24h
        for coin in coins:
            sym = coin.get("symbol")
            if not sym:
                continue
            if in_prior_7d:
                prior_counts[sym] += 1
            if in_recent_24h:
                recent_counts[sym] += 1
    fade_alerts = sorted(
        [
            {
                "symbol": s,
                "name": per_coin[s].get("name"),
                "priorHits": prior_counts[s],
                "recentHits": recent_counts[s],
                "drop": prior_counts[s] - recent_counts[s],
            }
            for s in prior_counts
            if prior_counts[s] >= 5 and recent_counts[s] <= 1
        ],
        key=lambda r: -r["drop"],
    )[:20]

    # NFTs + categories persistence (same shape as coins, different fields)
    nft_data = _persistence_for("nfts", trending_dir, now)
    cat_data = _persistence_for("categories", trending_dir, now)

    return {
        "latestSnapshotTs": latest_ts.isoformat().replace("+00:00", "Z"),
        "snapshotCount30d": len(snaps),
        "trendingNow": [{"symbol": c.get("symbol"), "name": c.get("name"), "id": c.get("id"),
                          "score": c.get("score")} for c in latest_coins],
        "perCoin": dict(per_coin),
        "heatmap": heatmap,
        "newEntrants": new_entrants,
        "fadeAlerts": fade_alerts,
        "nfts": nft_data,
        "categories": cat_data,
    }


def _persistence_for(section: str, trending_dir: Path, now: datetime) -> dict:
    """Generic persistence aggregator for 'nfts' or 'categories'. Same metrics
    as coins (24h/7d/30d counts, weighted by position, last seen, etc.)."""
    if not trending_dir.exists():
        return {"latestNow": [], "perItem": {}, "snapshotCount": 0}
    cutoff = now - timedelta(days=30)
    snaps: list[tuple[datetime, list[dict]]] = []
    for f in sorted(trending_dir.glob("*.json")):
        try:
            doc = json.loads(f.read_text())
        except Exception:
            continue
        for snap in doc.get("snapshots", []):
            try:
                ts = datetime.fromisoformat(snap["ts"].replace("Z", "+00:00"))
            except Exception:
                continue
            if ts < cutoff:
                continue
            items = snap.get(section, [])
            if items:
                snaps.append((ts, items))
    snaps.sort(key=lambda x: x[0])
    if not snaps:
        return {"latestNow": [], "perItem": {}, "snapshotCount": 0}

    latest_ts, latest_items = snaps[-1]
    today = now.date()
    list_size = max((len(items) for _, items in snaps), default=1)

    per_item: dict[str, dict] = defaultdict(lambda: {
        "id": None, "name": None,
        "count24h": 0, "count7d": 0, "count30d": 0,
        "weightedScore24h": 0, "weightedScore7d": 0, "weightedScore30d": 0,
        "lastSeen": None, "firstSeen": None,
        "dailyCounts": [0] * 30,
        "bestPosition": 999,
    })

    for ts, items in snaps:
        days_ago = (today - ts.date()).days
        within_24h = (now - ts).total_seconds() <= 86400
        within_7d = (now - ts).total_seconds() <= 7 * 86400
        for item in items:
            key = item.get("id") or item.get("name")
            if not key:
                continue
            it = per_item[key]
            it["id"] = item.get("id")
            it["name"] = item.get("name")
            score = item.get("score")
            weighted = (list_size - int(score)) if isinstance(score, (int, float)) else 1
            it["count30d"] += 1
            it["weightedScore30d"] += weighted
            if within_7d:
                it["count7d"] += 1
                it["weightedScore7d"] += weighted
            if within_24h:
                it["count24h"] += 1
                it["weightedScore24h"] += weighted
            ts_iso = ts.isoformat().replace("+00:00", "Z")
            if it["lastSeen"] is None or ts_iso > it["lastSeen"]:
                it["lastSeen"] = ts_iso
            if it["firstSeen"] is None or ts_iso < it["firstSeen"]:
                it["firstSeen"] = ts_iso
            if 0 <= days_ago < 30:
                it["dailyCounts"][29 - days_ago] += 1
            if isinstance(score, (int, float)) and score < it["bestPosition"]:
                it["bestPosition"] = int(score)

    return {
        "latestSnapshotTs": latest_ts.isoformat().replace("+00:00", "Z"),
        "snapshotCount": len(snaps),
        "listSize": list_size,
        "latestNow": [
            {"id": x.get("id"), "name": x.get("name"), "score": x.get("score")}
            for x in latest_items
        ],
        "perItem": dict(per_item),
    }


def compute_momentum(cleaned: pd.DataFrame) -> dict:
    """For each coin in the latest snapshot, compute rank change vs ~1d, ~7d, ~30d ago.
    Positive delta = rank improved (number went down).
    Returns None for a window if we don't have a snapshot close enough to the target date."""
    latest_date = cleaned["date"].max()
    targets = [("d1", 1, 2), ("d7", 7, 4), ("d30", 30, 7)]  # (label, days, tolerance)
    momentum = {}
    for sym, g in cleaned.sort_values("date").groupby("symbol"):
        latest_row = g[g["date"] == latest_date]
        if latest_row.empty:
            continue
        cur = latest_row.iloc[0]
        if pd.isna(cur["cmc_rank"]):
            continue
        current_rank = int(cur["cmc_rank"])
        m: dict = {"currentRank": current_rank}
        for label, days, tol in targets:
            target = latest_date - pd.Timedelta(days=days)
            distances = (g["date"] - target).abs()
            if distances.empty:
                m[label] = None
                continue
            closest_idx = distances.idxmin()
            actual_gap_days = abs((g.loc[closest_idx, "date"] - target).days)
            if actual_gap_days > tol:
                m[label] = None
                continue
            prev_rank = g.loc[closest_idx, "cmc_rank"]
            if pd.isna(prev_rank):
                m[label] = None
                continue
            m[label] = int(prev_rank) - current_rank  # positive = climbed
        momentum[sym] = m
    return momentum


def main():
    cleaned = pd.read_parquet(OUT / "cleaned.parquet")
    cleaned["date"] = pd.to_datetime(cleaned["date"])

    tables = {
        "climbersOverall": load_table("climbers_overall"),
        "climbersBear": load_table("climbers_bear"),
        "quietAccumulators": load_table("quiet_accumulators"),
        "persistentDecliners": load_table("persistent_decliners"),
        "stableHolders": load_table("stable_holders"),
        "overhangRisk": load_table("overhang_risk"),
        "lowFloatDecliners": load_table("low_float_decliners"),
        "highConvictionClimbers": load_table("high_conviction_climbers"),
    }

    # include every coin so /coin/[symbol] works for anything we have data on
    latest = cleaned["date"].max()
    traj = cleaned.sort_values("date")
    trajectories = {}
    name_map = {}
    current_metrics = {}  # latest fdv/mc_fdv per coin
    for sym, g in traj.groupby("symbol"):
        pts = []
        for d, r, m, p in zip(g["date"], g["cmc_rank"], g["market_cap_usd"], g["price_usd"]):
            if pd.isna(r):
                continue
            pts.append({
                "date": d.isoformat()[:10],
                "rank": int(r),
                "mcap": float(m) if pd.notna(m) else None,
                "price": float(p) if pd.notna(p) else None,
            })
        if not pts:
            continue
        trajectories[sym] = pts
        name_map[sym] = g["name"].iloc[-1]
        last = g.iloc[-1]
        current_metrics[sym] = {
            "mcap": float(last["market_cap_usd"]) if pd.notna(last["market_cap_usd"]) else None,
            "fdv": float(last["fdv"]) if pd.notna(last["fdv"]) else None,
            "mcFdv": float(last["mc_fdv"]) if pd.notna(last["mc_fdv"]) else None,
            "price": float(last["price_usd"]) if pd.notna(last["price_usd"]) else None,
            "circulatingSupply": float(last["circulating_supply"]) if pd.notna(last["circulating_supply"]) else None,
            "maxSupply": float(last["max_supply"]) if pd.notna(last["max_supply"]) else None,
            "isCapped": bool(pd.notna(last["max_supply"])),
        }

    # heatmap matrix for top-50 current
    top_now = cleaned[cleaned["date"] == latest].nsmallest(50, "cmc_rank")["symbol"].tolist()
    heat = cleaned[cleaned["symbol"].isin(top_now)].pivot_table(
        index="symbol", columns="date", values="cmc_rank", aggfunc="first"
    ).reindex(top_now)
    heatmap = {
        "symbols": list(heat.index),
        "dates": [d.isoformat()[:10] for d in heat.columns],
        "matrix": [[None if pd.isna(v) else int(v) for v in row] for row in heat.values],
    }

    # per-snapshot totals for the coverage/mcap chart
    coverage = (
        cleaned.groupby("date").agg(coins=("symbol", "nunique"), totalMcap=("market_cap_usd", "sum"))
        .reset_index()
    )
    coverage_records = [
        {"date": d.isoformat()[:10], "coins": int(c), "totalMcap": float(m)}
        for d, c, m in zip(coverage["date"], coverage["coins"], coverage["totalMcap"])
    ]

    summary_md = (OUT / "summary.md").read_text() if (OUT / "summary.md").exists() else ""
    momentum = compute_momentum(cleaned)
    trending = compute_trending(TRENDING_DIR)
    print(f"  trending: {trending.get('snapshotCount30d', 0)} snapshots, "
          f"{len(trending.get('perCoin', {}))} unique coins")

    doc = {
        "metadata": {
            "generatedAt": pd.Timestamp.utcnow().isoformat(),
            "firstDate": cleaned["date"].min().isoformat()[:10],
            "lastDate": cleaned["date"].max().isoformat()[:10],
            "snapshotCount": int(cleaned["date"].nunique()),
            "coinCount": int(cleaned["symbol"].nunique()),
            "bearWindow": detect_bear_window(cleaned),
        },
        "tables": tables,
        "trajectories": trajectories,
        "nameMap": name_map,
        "currentMetrics": current_metrics,
        "momentum": momentum,
        "trending": trending,
        "heatmap": heatmap,
        "coverage": coverage_records,
        "summaryMd": summary_md,
    }

    TARGET.write_text(json.dumps(doc, default=str))
    size_kb = TARGET.stat().st_size / 1024
    print(f"wrote {TARGET}  ({size_kb:,.1f} KB)")
    print(f"  metadata: {doc['metadata']['snapshotCount']} snapshots, "
          f"{doc['metadata']['coinCount']} coins")
    print(f"  trajectories: {len(trajectories)} coins")
    print(f"  tables: {[(k, len(v)) for k,v in tables.items()]}")

    # mirror matplotlib charts into public/ so Next.js serves them
    import shutil
    PUBLIC.mkdir(exist_ok=True)
    copied = 0
    for png in OUT.glob("chart_*.png"):
        shutil.copy2(png, PUBLIC / png.name)
        copied += 1
    print(f"  copied {copied} chart PNGs to public/")


if __name__ == "__main__":
    main()
