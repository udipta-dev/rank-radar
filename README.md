# rank-radar

Personal dashboard for tracking structural rank movement of top crypto assets.
Scrapes CMC weekly historical snapshots, identifies climbers / quiet accumulators /
decliners, renders the results as a Next.js site on Vercel.

## What it does

- **Scrapes** the top-200 CMC ranking each Sunday (free, no API key)
- **Filters** stablecoins, tokenized commodities, wrapped tokens
- **Detects** the bear window from total mcap drawdown across the dataset
- **Surfaces** structural climbers, bear-period climbers, quiet accumulators
  (climbed in bear but not yet re-rated), persistent decliners, stable holders
- **Renders** sortable tables, per-coin rank trajectories, and a heatmap

## Stack

- Python: `requests`, `pandas`, `pyarrow`, `matplotlib`
- Web: Next.js 15 (App Router), Tailwind v4, Recharts
- Refresh: GitHub Actions weekly cron (Sundays 23:30 UTC)
- Hosting: Vercel (static export)
- Storage: JSON committed to repo — no DB, no S3, no MongoDB

## Local dev

```bash
# Data pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install requests pandas pyarrow matplotlib

python scripts/scrape_cmc_historical.py   # ~5 min the first time, idempotent
python scripts/analyze.py
python scripts/export_for_web.py

# Site
npm install
npm run dev    # http://localhost:3000
```

## Layout

```
data/
  raw/YYYYMMDD.json     scraped snapshots, one file per week
  snapshots.parquet     flat long table
  out/                  analysis outputs (CSV tables, summary, optional PNGs)
  web.json              consumed by the Next.js build
scripts/
  scrape_cmc_historical.py
  analyze.py
  export_for_web.py
app/                    Next.js pages
components/             React components
lib/                    data loader + types
.github/workflows/
  weekly-refresh.yml    cron job that re-scrapes + re-analyzes + commits
```
