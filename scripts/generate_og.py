"""
Render a 1200x630 OG image (social-share card) showing the rank heatmap.
Matches the website's vivid log-scale palette. Run by daily refresh so the
image stays fresh.

Output: public/og.png
"""
from __future__ import annotations
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
CLEANED = DATA / "out" / "cleaned.parquet"
OUT = ROOT / "public" / "og.png"

# match web palette: vivid emerald -> amber -> crimson
CMAP = LinearSegmentedColormap.from_list(
    "rankradar",
    [(0.0, "#00ff82"), (0.5, "#fbbf24"), (1.0, "#ef233c")],
    N=256,
)
BG = "#0b0d10"
ACCENT = "#00ff85"
FG = "#ffffff"
FG_DIM = "#8a93a0"


def log_norm(rank: float, max_rank: int = 200) -> float:
    if pd.isna(rank):
        return np.nan
    if rank < 1:
        rank = 1
    return min(1.0, max(0.0, np.log(rank) / np.log(max_rank)))


def main():
    df = pd.read_parquet(CLEANED)
    df["date"] = pd.to_datetime(df["date"])
    latest = df["date"].max()
    top = df[df["date"] == latest].nsmallest(40, "cmc_rank")["symbol"].tolist()
    heat = df[df["symbol"].isin(top)].pivot_table(
        index="symbol", columns="date", values="cmc_rank", aggfunc="first"
    ).reindex(top)

    # log-scaled matrix
    mat = heat.values.astype(float)
    mat_t = np.vectorize(log_norm, otypes=[float])(mat)

    # figure sized for 1200x630 at 100 DPI
    fig = plt.figure(figsize=(12, 6.3), dpi=100, facecolor=BG)
    fig.patch.set_facecolor(BG)

    # title strip top
    fig.text(0.04, 0.92, "rank-radar", color=ACCENT, fontsize=32, fontweight="bold")
    fig.text(0.04, 0.86, "crypto rank movement + trending attention dashboard",
             color=FG, fontsize=13)

    # heatmap axes (leave room for title and footer)
    ax = fig.add_axes([0.04, 0.12, 0.86, 0.68])
    ax.imshow(mat_t, aspect="auto", cmap=CMAP, vmin=0, vmax=1, interpolation="bilinear")
    ax.set_yticks(range(len(top)))
    ax.set_yticklabels(top, fontsize=7, color=FG, family="monospace")
    # date ticks
    n_dates = len(heat.columns)
    tick_idx = list(range(0, n_dates, max(1, n_dates // 8)))
    ax.set_xticks(tick_idx)
    ax.set_xticklabels([heat.columns[i].strftime("%y-%m") for i in tick_idx],
                       fontsize=8, color=FG_DIM)
    ax.tick_params(colors=FG_DIM, length=2)
    for spine in ax.spines.values():
        spine.set_visible(False)

    # legend
    legend_ax = fig.add_axes([0.92, 0.12, 0.015, 0.68])
    gradient = np.linspace(0, 1, 256).reshape(-1, 1)
    legend_ax.imshow(gradient, aspect="auto", cmap=CMAP, origin="lower")
    legend_ax.set_xticks([])
    legend_ax.set_yticks([0, 255])
    legend_ax.set_yticklabels(["#1", "#200"], fontsize=8, color=FG_DIM)
    legend_ax.tick_params(colors=FG_DIM, length=2)
    for spine in legend_ax.spines.values():
        spine.set_visible(False)

    # footer
    fig.text(0.04, 0.04, "rank-radar-alpha.vercel.app",
             color=FG, fontsize=11, family="monospace")
    fig.text(0.96, 0.04, "NFA · DYOR",
             color=FG_DIM, fontsize=10, ha="right")

    OUT.parent.mkdir(exist_ok=True)
    fig.savefig(OUT, facecolor=BG, dpi=100, bbox_inches=None)
    plt.close(fig)
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
