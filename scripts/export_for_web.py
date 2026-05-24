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
TARGET = DATA / "web.json"

# How many coins get full trajectory data attached. Picked from the union of
# top climbers + quiet accumulators + a few top-current-rank.
TRAJECTORY_LIMIT = 150


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


def main():
    cleaned = pd.read_parquet(OUT / "cleaned.parquet")
    cleaned["date"] = pd.to_datetime(cleaned["date"])

    tables = {
        "climbersOverall": load_table("climbers_overall"),
        "climbersBear": load_table("climbers_bear"),
        "quietAccumulators": load_table("quiet_accumulators"),
        "persistentDecliners": load_table("persistent_decliners"),
        "stableHolders": load_table("stable_holders"),
    }

    # build trajectory set: union of climbers/quiet/current-top
    syms = set()
    for tbl in ["climbersOverall", "climbersBear", "quietAccumulators"]:
        syms.update(r["symbol"] for r in tables[tbl][:50])
    latest = cleaned["date"].max()
    syms.update(cleaned[cleaned["date"] == latest].nsmallest(50, "cmc_rank")["symbol"])
    syms = list(syms)[:TRAJECTORY_LIMIT]

    traj = cleaned[cleaned["symbol"].isin(syms)].sort_values("date")
    trajectories = {}
    name_map = {}
    for sym, g in traj.groupby("symbol"):
        trajectories[sym] = [
            {
                "date": d.isoformat()[:10],
                "rank": int(r),
                "mcap": float(m) if pd.notna(m) else None,
                "price": float(p) if pd.notna(p) else None,
            }
            for d, r, m, p in zip(g["date"], g["cmc_rank"], g["market_cap_usd"], g["price_usd"])
        ]
        name_map[sym] = g["name"].iloc[-1]

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


if __name__ == "__main__":
    main()
