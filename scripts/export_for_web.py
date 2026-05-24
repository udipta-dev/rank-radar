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

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
OUT = DATA / "out"
PUBLIC = ROOT / "public"
TARGET = DATA / "web.json"

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
