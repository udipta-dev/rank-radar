"""
Analyze the CMC weekly historical snapshots.

Inputs:  snapshots.parquet  (from scrape_cmc_historical.py)
Outputs (in ./out/):
  cleaned.parquet                    long table, post-noise-filter
  table_climbers_overall.csv         top 50 by rank improvement over full window
  table_climbers_bear.csv            top 50 by rank improvement during worst bear stretch
  table_quiet_accumulators.csv       climbed in bear, still below best historical rank
  table_persistent_decliners.csv     steady rank loss
  table_stable_holders.csv           minimal rank movement
  chart_climbers_overall.png         rank trajectories, top 20 overall climbers
  chart_climbers_bear.png            rank trajectories, top 20 bear climbers
  chart_heatmap_top50.png            rank-over-time heatmap for top 50 current
  chart_delta_histogram.png          distribution of rank deltas
  chart_coverage.png                 tokens tracked per snapshot
  summary.md                         5-10 most interesting coins, with evidence
"""
from __future__ import annotations
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
RAW_WEEKLY = DATA / "raw"
RAW_DAILY = DATA / "daily"
PARQUET = DATA / "snapshots.parquet"
OUT = DATA / "out"
OUT.mkdir(exist_ok=True, parents=True)

# --- noise filter ----------------------------------------------------------
NOISE_TAGS = {
    "usd-stablecoin", "eur-stablecoin", "fiat-stablecoin",
    "asset-backed-stablecoin", "algorithmic-stablecoin",
    "tokenized-gold", "tokenized-commodities", "tokenized-stock",
}
MANUAL_DROP = {"WTHETA"}  # one wrapped token that slipped past cmcRank dedup


def _flatten_snapshot(snap: dict) -> list[dict]:
    """Convert a raw scraped snapshot dict into flat rows. Tolerates both the
    weekly historical shape and the daily live shape."""
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


def load() -> pd.DataFrame:
    """Build combined long table from weekly historical + daily live snapshots.
    Writes data/snapshots.parquet as a side effect for downstream tooling."""
    import json
    rows = []
    for d in sorted(RAW_WEEKLY.glob("*.json")):
        rows.extend(_flatten_snapshot(json.loads(d.read_text())))
    daily_count = 0
    if RAW_DAILY.exists():
        for d in sorted(RAW_DAILY.glob("*.json")):
            rows.extend(_flatten_snapshot(json.loads(d.read_text())))
            daily_count += 1
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    # if both a weekly and daily snapshot exist for the same calendar date, keep daily (more recent intra-day data)
    df = df.sort_values(["date", "cmc_rank"]).drop_duplicates(
        subset=["date", "symbol"], keep="last"
    ).reset_index(drop=True)
    df.to_parquet(PARQUET, index=False)
    print(f"  loaded {len(df):,} rows from {RAW_WEEKLY.name} ({len(list(RAW_WEEKLY.glob('*.json')))} weekly) "
          f"+ {daily_count} daily files; {df['date'].nunique()} unique dates")
    return df


def apply_noise_filter(df: pd.DataFrame) -> pd.DataFrame:
    """Drop a coin if a MAJORITY of its snapshots carry a noise tag, or it's
    in MANUAL_DROP. Per-row filtering would yank legit coins from parts of the
    timeline whenever CMC mistags them (e.g. LINK tagged 'tokenized-stock' for
    a stretch when Chainlink launched an RWA oracle product)."""
    def row_is_noise(tags_str):
        return bool(set((tags_str or "").split(",")) & NOISE_TAGS)
    df = df.copy()
    df["_row_noise"] = df["tags"].apply(row_is_noise)
    noise_rate = df.groupby("symbol")["_row_noise"].mean()
    bad_symbols = set(noise_rate[noise_rate >= 0.5].index) | MANUAL_DROP
    dropped = df[df["symbol"].isin(bad_symbols)][["symbol", "name"]].drop_duplicates().sort_values("symbol")
    print(f"  noise filter: dropping {len(dropped)} coins")
    print("  dropped symbols:", ", ".join(dropped["symbol"].tolist()))
    return df[~df["symbol"].isin(bad_symbols)].drop(columns=["_row_noise"])


# --- bear window from total mcap of top 200 -------------------------------
def find_bear_window(df: pd.DataFrame) -> tuple[pd.Timestamp, pd.Timestamp, pd.DataFrame]:
    per_snap = df.groupby("date")["market_cap_usd"].sum().sort_index()
    # find peak-to-trough drawdown across the series
    cummax = per_snap.cummax()
    drawdown = (per_snap - cummax) / cummax
    trough_idx = drawdown.idxmin()
    peak_idx = per_snap.loc[:trough_idx].idxmax()
    print(f"  bear window: peak={peak_idx.date()} (${per_snap[peak_idx]/1e12:.2f}T) -> "
          f"trough={trough_idx.date()} (${per_snap[trough_idx]/1e12:.2f}T) "
          f"= {drawdown[trough_idx]*100:.1f}% drawdown")
    return peak_idx, trough_idx, per_snap


# --- per-coin metrics over a window ---------------------------------------
def compute_float(df: pd.DataFrame) -> pd.DataFrame:
    """Add fdv and mc_fdv (= float pct) columns. FDV = price * max_supply where
    max_supply is set; otherwise FDV = market_cap (i.e. uncapped tokens are
    treated as fully diluted)."""
    df = df.copy()
    df["fdv"] = df["price_usd"] * df["max_supply"]
    df["fdv"] = df["fdv"].fillna(df["market_cap_usd"])  # uncapped: FDV = MCAP
    df["mc_fdv"] = df["market_cap_usd"] / df["fdv"]
    df["mc_fdv"] = df["mc_fdv"].clip(upper=1.0)  # numerical noise can push slightly above 1
    return df


def coin_metrics(df: pd.DataFrame, window: tuple[pd.Timestamp, pd.Timestamp] | None = None) -> pd.DataFrame:
    """Compute start/end/best/worst rank per coin over the given (date-inclusive) window.
    Also captures current FDV / MC-FDV ratio (= float %) from the most recent row in window.
    """
    sub = df if window is None else df[(df["date"] >= window[0]) & (df["date"] <= window[1])]
    grp = sub.sort_values("date").groupby("symbol")
    out = grp.agg(
        name=("name", "first"),
        first_date=("date", "min"),
        last_date=("date", "max"),
        snapshots=("date", "nunique"),
        start_rank=("cmc_rank", "first"),
        end_rank=("cmc_rank", "last"),
        best_rank=("cmc_rank", "min"),
        worst_rank=("cmc_rank", "max"),
        avg_mcap_usd=("market_cap_usd", "mean"),
        current_mcap_usd=("market_cap_usd", "last"),
        current_fdv_usd=("fdv", "last"),
        current_mc_fdv=("mc_fdv", "last"),
        max_supply=("max_supply", "last"),
        circulating_supply=("circulating_supply", "last"),
    ).reset_index()
    out["rank_delta"] = out["start_rank"] - out["end_rank"]  # positive = climber
    out["is_capped"] = out["max_supply"].notna()
    return out


# --- tables ----------------------------------------------------------------
def table_climbers_overall(df, n=50, min_snapshots=10):
    m = coin_metrics(df)
    m = m[m["snapshots"] >= min_snapshots]
    return m.sort_values("rank_delta", ascending=False).head(n)


def table_climbers_bear(df, peak, trough, n=50, min_snapshots=5):
    m = coin_metrics(df, (peak, trough))
    m = m[m["snapshots"] >= min_snapshots]
    return m.sort_values("rank_delta", ascending=False).head(n)


def table_quiet_accumulators(df, peak, trough, n=50):
    """Climbed in bear, but current rank still notably worse than their best-ever rank
    in the full dataset. The 're-rating hasn't happened yet' bucket."""
    bear = coin_metrics(df, (peak, trough))
    full = coin_metrics(df)
    merged = bear[["symbol", "name", "rank_delta"]].rename(columns={"rank_delta": "bear_delta"}).merge(
        full[["symbol", "best_rank", "end_rank", "start_rank", "snapshots"]],
        on="symbol", how="inner"
    )
    # climbed during bear AND current rank still well below best historical rank
    merged["gap_to_best"] = merged["end_rank"] - merged["best_rank"]
    out = merged[(merged["bear_delta"] > 0) & (merged["gap_to_best"] >= 20)]
    return out.sort_values(["bear_delta", "gap_to_best"], ascending=False).head(n)


def table_persistent_decliners(df, n=50, min_snapshots=20):
    """Sort by negative rank_delta over full window, only coins present throughout."""
    m = coin_metrics(df)
    m = m[m["snapshots"] >= min_snapshots]
    return m.sort_values("rank_delta", ascending=True).head(n)


def table_stable_holders(df, n=50, min_snapshots=80):
    """Smallest absolute range between best and worst rank."""
    m = coin_metrics(df)
    m = m[m["snapshots"] >= min_snapshots]
    m["rank_range"] = m["worst_rank"] - m["best_rank"]
    return m.sort_values("rank_range", ascending=True).head(n)


def table_overhang_risk(df, n=50, max_float=0.40):
    """Coins with the biggest unlock cliffs ahead. Low MC/FDV ratio = lots of
    supply still to come = potential dilution headwind. Hard-capped only
    (uncapped tokens have MC/FDV = 1.0 by our convention so they're not at
    immediate unlock risk in the same way)."""
    m = coin_metrics(df)
    m = m[m["is_capped"] & (m["current_mc_fdv"] <= max_float)]
    m["dilution_multiple"] = 1.0 / m["current_mc_fdv"]
    return m.sort_values("current_mc_fdv", ascending=True).head(n)


def table_low_float_decliners(df, n=50, max_float=0.40, min_snapshots=10):
    """Coins that are BOTH declining in rank AND have heavy unlock pressure.
    These are the highest-mortality candidates per user thesis: low-float
    tokens die before they survive."""
    m = coin_metrics(df)
    m = m[m["is_capped"] & (m["current_mc_fdv"] <= max_float) & (m["snapshots"] >= min_snapshots) & (m["rank_delta"] < 0)]
    return m.sort_values(["rank_delta", "current_mc_fdv"], ascending=[True, True]).head(n)


def table_high_conviction_climbers(df, n=50, max_float=0.50, min_delta=15, min_snapshots=10):
    """The opposite: climbing in rank DESPITE heavy unlock pressure. These are
    the strongest survival signals — buyers absorbing unlocks AND pushing rank."""
    m = coin_metrics(df)
    m = m[m["is_capped"] & (m["current_mc_fdv"] <= max_float) & (m["snapshots"] >= min_snapshots) & (m["rank_delta"] >= min_delta)]
    return m.sort_values(["rank_delta", "current_mc_fdv"], ascending=[False, True]).head(n)


# --- charts ----------------------------------------------------------------
def plot_trajectories(df, symbols, title, path):
    fig, ax = plt.subplots(figsize=(14, 8))
    sub = df[df["symbol"].isin(symbols)].sort_values("date")
    cmap = plt.get_cmap("tab20")
    for i, sym in enumerate(symbols):
        s = sub[sub["symbol"] == sym]
        if s.empty:
            continue
        ax.plot(s["date"], s["cmc_rank"], marker="o", markersize=3, linewidth=1.5,
                color=cmap(i % 20), label=sym)
    ax.invert_yaxis()  # rank 1 at top
    ax.set_ylabel("CMC rank (lower = better)")
    ax.set_xlabel("Date")
    ax.set_title(title)
    ax.legend(ncols=2, fontsize=8, loc="center left", bbox_to_anchor=(1.0, 0.5))
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


def plot_heatmap(df, path, n=50):
    latest = df["date"].max()
    top_now = df[df["date"] == latest].nsmallest(n, "cmc_rank")["symbol"].tolist()
    sub = df[df["symbol"].isin(top_now)].pivot_table(
        index="symbol", columns="date", values="cmc_rank", aggfunc="first"
    ).reindex(top_now)

    fig, ax = plt.subplots(figsize=(16, 12))
    im = ax.imshow(sub.values, aspect="auto", cmap="RdYlGn_r",
                   norm=mcolors.Normalize(vmin=1, vmax=200))
    ax.set_yticks(range(len(sub.index)))
    ax.set_yticklabels(sub.index, fontsize=8)
    # show ~12 x-ticks
    n_dates = len(sub.columns)
    tick_idx = list(range(0, n_dates, max(1, n_dates // 12)))
    ax.set_xticks(tick_idx)
    ax.set_xticklabels([sub.columns[i].strftime("%Y-%m") for i in tick_idx], rotation=45)
    ax.set_title(f"Rank over time, top {n} by current rank (green = better)")
    fig.colorbar(im, ax=ax, label="cmc_rank")
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


def plot_delta_histogram(df, path):
    m = coin_metrics(df)
    m = m[m["snapshots"] >= 10]
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.hist(m["rank_delta"], bins=60, edgecolor="black", alpha=0.75)
    ax.axvline(0, color="red", linestyle="--", alpha=0.7, label="no change")
    ax.set_xlabel("Rank delta (start - end, positive = climbed)")
    ax.set_ylabel("Number of coins")
    ax.set_title(f"Distribution of rank deltas across {len(m)} coins (full window)")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


def plot_coverage(df, mcap_series, path):
    coverage = df.groupby("date")["symbol"].nunique()
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
    ax1.plot(coverage.index, coverage.values, marker="o", markersize=3)
    ax1.set_ylabel("Coins per snapshot (post-filter)")
    ax1.set_title("Capture coverage and total top-200 market cap")
    ax1.grid(True, alpha=0.3)
    ax1.axhline(coverage.median(), color="gray", linestyle="--", alpha=0.5,
                label=f"median={int(coverage.median())}")
    ax1.legend()
    ax2.plot(mcap_series.index, mcap_series.values / 1e12, marker="o", markersize=3, color="purple")
    ax2.set_ylabel("Sum of top-200 mcap ($T)")
    ax2.set_xlabel("Date")
    ax2.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


# --- summary write-up ------------------------------------------------------
def write_summary(df, peak, trough, mcap_series, tables: dict[str, pd.DataFrame]):
    """Cherry-pick 5-10 most interesting coins. Heuristic:
    - top bear-climbers (heavy weight)
    - quiet accumulators (still re-rating)
    - persistence: present for most of the window
    """
    bear = tables["climbers_bear"].head(20).copy()
    bear["score"] = bear["rank_delta"]
    overall = tables["climbers_overall"].head(20).copy()
    overall["score"] = overall["rank_delta"] / 2  # half weight, longer window
    quiet = tables["quiet_accumulators"].head(20).copy()
    quiet["score"] = quiet["bear_delta"] + quiet["gap_to_best"] * 0.5

    pool = pd.concat([
        bear[["symbol", "score"]],
        overall[["symbol", "score"]],
        quiet[["symbol", "score"]],
    ]).groupby("symbol")["score"].sum().sort_values(ascending=False)

    picks = pool.head(10).index.tolist()
    full_metrics = coin_metrics(df).set_index("symbol")
    bear_metrics = coin_metrics(df, (peak, trough)).set_index("symbol")

    lines = []
    lines.append(f"# Structural rank-climber summary")
    lines.append(f"")
    lines.append(f"Dataset: CMC weekly top-200 snapshots, {df['date'].min().date()} to {df['date'].max().date()} "
                 f"({df['date'].nunique()} snapshots, {df['symbol'].nunique()} coins post-filter).")
    lines.append(f"")
    lines.append(f"Bear window used for relative-strength screen: "
                 f"{peak.date()} to {trough.date()} "
                 f"(top-200 mcap drop {(mcap_series[trough]/mcap_series[peak]-1)*100:.1f}%).")
    lines.append(f"")
    lines.append(f"## 10 most interesting coins")
    lines.append(f"")
    for sym in picks:
        if sym not in full_metrics.index:
            continue
        f = full_metrics.loc[sym]
        b = bear_metrics.loc[sym] if sym in bear_metrics.index else None
        lines.append(f"### {sym} ({f['name']})")
        lines.append(f"")
        lines.append(f"- First seen in dataset: {f['first_date'].date()} at rank {int(f['start_rank'])}")
        lines.append(f"- Best rank reached: {int(f['best_rank'])}")
        lines.append(f"- Worst rank reached: {int(f['worst_rank'])}")
        lines.append(f"- Current rank ({f['last_date'].date()}): {int(f['end_rank'])}")
        lines.append(f"- Full-window rank delta: {int(f['rank_delta']):+d}")
        if b is not None:
            lines.append(f"- Bear-window rank delta ({peak.date()} -> {trough.date()}): "
                         f"{int(b['rank_delta']):+d}  (rank {int(b['start_rank'])} -> {int(b['end_rank'])})")
        lines.append(f"- Weeks present: {int(f['snapshots'])}")
        gap = int(f["end_rank"] - f["best_rank"])
        if gap >= 20:
            lines.append(f"- Note: current rank is {gap} below best historical. Possible quiet-accumulator.")
        lines.append(f"")

    (OUT / "summary.md").write_text("\n".join(lines))
    print(f"  wrote summary.md with {len(picks)} picks")


# --- main ------------------------------------------------------------------
def main():
    print("Loading...")
    df = load()
    print(f"  {len(df):,} rows, {df['symbol'].nunique()} coins, "
          f"{df['date'].nunique()} snapshots")

    print("\nNoise filter:")
    df = apply_noise_filter(df)
    df = compute_float(df)
    df.to_parquet(OUT / "cleaned.parquet", index=False)
    print(f"  post-filter: {len(df):,} rows, {df['symbol'].nunique()} coins")
    print(f"  FDV coverage: {df.groupby('symbol')['max_supply'].last().notna().sum()} of "
          f"{df['symbol'].nunique()} coins are hard-capped (have max_supply)")

    print("\nBear window detection:")
    peak, trough, mcap_series = find_bear_window(df)

    print("\nGenerating tables:")
    tables = {
        "climbers_overall": table_climbers_overall(df),
        "climbers_bear": table_climbers_bear(df, peak, trough),
        "quiet_accumulators": table_quiet_accumulators(df, peak, trough),
        "persistent_decliners": table_persistent_decliners(df),
        "stable_holders": table_stable_holders(df),
        "overhang_risk": table_overhang_risk(df),
        "low_float_decliners": table_low_float_decliners(df),
        "high_conviction_climbers": table_high_conviction_climbers(df),
    }
    for name, t in tables.items():
        path = OUT / f"table_{name}.csv"
        t.to_csv(path, index=False)
        print(f"  wrote table_{name}.csv ({len(t)} rows)")

    print("\nGenerating charts:")
    plot_trajectories(df, tables["climbers_overall"].head(20)["symbol"].tolist(),
                      "Top 20 structural climbers (full window)",
                      OUT / "chart_climbers_overall.png")
    print("  chart_climbers_overall.png")
    plot_trajectories(df, tables["climbers_bear"].head(20)["symbol"].tolist(),
                      f"Top 20 bear-period climbers ({peak.date()} to {trough.date()})",
                      OUT / "chart_climbers_bear.png")
    print("  chart_climbers_bear.png")
    plot_heatmap(df, OUT / "chart_heatmap_top50.png")
    print("  chart_heatmap_top50.png")
    plot_delta_histogram(df, OUT / "chart_delta_histogram.png")
    print("  chart_delta_histogram.png")
    plot_coverage(df, mcap_series, OUT / "chart_coverage.png")
    print("  chart_coverage.png")

    print("\nWriting summary:")
    write_summary(df, peak, trough, mcap_series, tables)

    print(f"\nDone. All outputs in {OUT}")


if __name__ == "__main__":
    main()
