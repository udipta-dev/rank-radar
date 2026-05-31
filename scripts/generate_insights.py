"""
Generate analyst-voice insights for 4 pages using Gemini Flash.

Runs as part of the daily refresh, after export_for_web.py has written web.json.
Adds an `insights` top-level field with 4 plain-text strings:
  insights.home / movements / trending / narratives

Failure-safe: missing API key, network errors, quota issues all degrade
gracefully to empty strings. The pipeline never breaks on AI failure.
"""
from __future__ import annotations
import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
WEB_JSON = ROOT / "data" / "web.json"
API_KEY = os.environ.get("GEMINI_API_KEY")
ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)
TIMEOUT = 45
RETRIES = 2

SYSTEM = """You are writing brief analyst notes for a personal crypto dashboard owned by a trader with 9 years of crypto experience. The audience is the trader himself, not the public.

Voice rules. These are absolute, no exceptions:
- 80 to 120 words of plain text. No markdown headers. No bullet lists. No numbered lists.
- NEVER use em dashes. Use periods, commas, or restructure the sentence.
- Forbidden words and phrases anywhere in the output: "however", "moreover", "furthermore", "additionally", "in conclusion", "in summary", "it is worth noting", "it's worth noting", "complex landscape", "evolving dynamics", "stakeholders", "robust", "leverage" as a verb, "ecosystem" used as filler, "navigate" as a verb, "delve".
- Punchy short sentences. Mix in the occasional longer one. Vary the rhythm.
- Mention specific coin symbols (BTC, HYPE, MORPHO, etc.) by name. Not generic categories.
- Use crypto-native terms freely. The reader knows what TGE, FDV, unlock cliff, float, dilution, narrative, beta, accumulation, rotation, nuke, rug, cope mean.
- Have a real opinion. Skip "on the one hand, on the other hand". Pick a side.
- Skip preamble. Do not say "Here is the analysis" or "Looking at the data".
- End with one specific actionable observation, not a wrap-up summary line.

Output plain text only. Ready to display as-is."""


def call_gemini(user_msg: str, label: str) -> str:
    """Returns the generated insight, or empty string on any failure."""
    if not API_KEY:
        print(f"  [{label}] no GEMINI_API_KEY, skipping")
        return ""
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": user_msg}]}],
        "generationConfig": {
            "temperature": 0.75,
            "maxOutputTokens": 1024,
            "candidateCount": 1,
            # Disable internal "thinking" tokens — Gemini 2.5 spends part of the
            # output budget on reasoning by default which truncates the actual
            # response. For 80-120 word punchy notes we don't need reasoning.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    url = f"{ENDPOINT}?key={API_KEY}"
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.post(url, json=body, timeout=TIMEOUT)
            if r.status_code != 200:
                print(f"  [{label}] HTTP {r.status_code}: {r.text[:200]}")
                if attempt < RETRIES and r.status_code >= 500:
                    time.sleep(3 * attempt)
                    continue
                return ""
            data = r.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            ).strip()
            if not text:
                print(f"  [{label}] empty response")
                return ""
            return text
        except Exception as e:
            print(f"  [{label}] attempt {attempt} failed: {e}")
            if attempt < RETRIES:
                time.sleep(3 * attempt)
    return ""


# --- per-page data slice builders ----------------------------------------------


def _coin_label(symbol: str, name_map: dict) -> str:
    n = name_map.get(symbol, "")
    return f"{symbol} ({n})" if n and n != symbol else symbol


def build_home_msg(doc: dict) -> str:
    meta = doc["metadata"]
    bw = meta["bearWindow"]
    nm = doc.get("nameMap", {})
    momentum = doc.get("momentum", {})
    overhang = doc.get("tables", {}).get("overhangRisk", [])[:6]

    movers_d7 = sorted(
        [(s, m) for s, m in momentum.items() if m.get("d7") is not None],
        key=lambda kv: kv[1]["d7"],
        reverse=True,
    )
    climbers_7d = movers_d7[:8]
    decliners_7d = sorted(movers_d7, key=lambda kv: kv[1]["d7"])[:8]
    movers_d30 = sorted(
        [(s, m) for s, m in momentum.items() if m.get("d30") is not None],
        key=lambda kv: kv[1]["d30"],
        reverse=True,
    )
    climbers_30d = movers_d30[:6]

    lines = ["Page: market overview homepage.", ""]
    lines.append(f"Dataset: {meta['snapshotCount']} weekly snapshots, "
                 f"{meta['coinCount']} coins, range {meta['firstDate']} to {meta['lastDate']}.")
    lines.append(f"Auto-detected bear window: {bw['peak'][:10]} to {bw['trough'][:10]}, "
                 f"top-200 mcap fell {bw['drawdownPct']:.1f}%.")
    lines.append("")
    lines.append("Top 8 rank climbers last 7 days (current rank, 7d delta):")
    for sym, m in climbers_7d:
        lines.append(f"  {_coin_label(sym, nm)}: rank {m['currentRank']}, +{m['d7']}")
    lines.append("")
    lines.append("Top 8 rank decliners last 7 days:")
    for sym, m in decliners_7d:
        lines.append(f"  {_coin_label(sym, nm)}: rank {m['currentRank']}, {m['d7']}")
    lines.append("")
    lines.append("Top 6 climbers last 30 days:")
    for sym, m in climbers_30d:
        lines.append(f"  {_coin_label(sym, nm)}: rank {m['currentRank']}, +{m['d30']}")
    lines.append("")

    # Sustained CG-trending coins also climbing on BOTH 7d and 30d.
    # This is the strongest "real story" signal: persistent attention plus
    # structural rank lift in both timeframes = not a one-day pump, not a
    # hype spike that fades. count30d >= 30 means ~1 trending appearance
    # per day on average over the last month.
    trending_per = (doc.get("trending") or {}).get("perCoin") or {}
    sustained_risers = []
    for sym, m in momentum.items():
        d7 = m.get("d7")
        d30 = m.get("d30")
        if d7 is None or d30 is None or d7 <= 0 or d30 <= 0:
            continue
        tp = trending_per.get(sym)
        if not tp:
            continue
        c30 = tp.get("count30d", 0)
        if c30 < 30:
            continue
        sustained_risers.append((sym, m, c30, tp.get("count24h", 0)))
    sustained_risers.sort(key=lambda t: (-t[2], -(t[1]["d7"] + t[1]["d30"])))
    sustained_risers = sustained_risers[:6]
    if sustained_risers:
        lines.append("Sustained CG-trending AND climbing on both 7d and 30d "
                     "(persistence + rank lift, not a single-day pump):")
        for sym, m, c30, c24 in sustained_risers:
            lines.append(f"  {_coin_label(sym, nm)}: rank {m['currentRank']}, "
                         f"+{m['d7']} (7d), +{m['d30']} (30d), "
                         f"on CG trending {c30}× in 30d, still {c24}× in last 24h")
        lines.append("")

    lines.append("Biggest float overhang (lowest MC/FDV, hard-capped only):")
    for r in overhang:
        mc_fdv = r.get("current_mc_fdv")
        if mc_fdv is not None:
            lines.append(f"  {r['symbol']}: float {mc_fdv*100:.1f}%, rank {r.get('end_rank','?')}")
    lines.append("")
    lines.append("Question: What mattered in the last 24h to 7d across rank movement and float? "
                 "Pick the one or two real stories. Be specific. "
                 "If the 'Sustained CG-trending AND climbing' list above has entries, "
                 "lead with those — that intersection (persistent attention + rank lift "
                 "both short and long term) is the highest-conviction signal we surface. "
                 "Name those coins by symbol and say what their setup is.")
    return "\n".join(lines)


def build_movements_msg(doc: dict) -> str:
    tables = doc["tables"]
    nm = doc.get("nameMap", {})

    def fmt_rows(rows, key="rank_delta"):
        out = []
        for r in rows:
            stale = " [stale " + str(r.get("days_since_last_seen", "")) + "d]" \
                if r.get("is_stale") else ""
            out.append(
                f"  {_coin_label(r['symbol'], nm)}: {r['start_rank']} -> {r['end_rank']} "
                f"({r[key]:+d}){stale}"
            )
        return out

    lines = ["Page: rank movements (climbers and decliners).", ""]
    lines.append("Top 10 structural climbers, full 2-year window:")
    lines.extend(fmt_rows(tables.get("climbersOverall", [])[:10]))
    lines.append("")
    lines.append("Top 10 bear-period climbers (rank gained during the auto-detected bear):")
    lines.extend(fmt_rows(tables.get("climbersBear", [])[:10]))
    lines.append("")
    lines.append("Top 10 persistent decliners:")
    lines.extend(fmt_rows(tables.get("persistentDecliners", [])[:10]))
    lines.append("")
    lines.append("Question: What patterns or narratives explain these moves? "
                 "Pick one or two stories worth telling. Mention specific coins by symbol. "
                 "Flag any stale coins (likely delisted or nuked) explicitly.")
    return "\n".join(lines)


def build_trending_msg(doc: dict) -> str:
    t = doc.get("trending", {})
    now_list = t.get("trendingNow", [])[:15]
    per_coin = t.get("perCoin", {})
    new_entrants = t.get("newEntrants", [])
    fades = t.get("fadeAlerts", [])
    snap_count = t.get("snapshotCount30d", 0)

    top_persist = sorted(
        per_coin.values(),
        key=lambda c: c.get("count7d", 0),
        reverse=True,
    )[:12]

    lines = [f"Page: CoinGecko trending coins. Captured every 30 min, "
             f"{snap_count} snapshots over last 30 days.", ""]
    lines.append("Top 15 trending right now (position #1 to #15):")
    for i, c in enumerate(now_list, 1):
        lines.append(f"  #{i} {c.get('symbol','')}: {c.get('name','')}")
    lines.append("")
    lines.append("Top 12 by 7-day persistence (snapshots appeared on list):")
    for c in top_persist:
        lines.append(f"  {c['symbol']}: {c.get('count7d',0)} of {snap_count} "
                     f"snapshots, best position #{c.get('bestPosition',0)+1}")
    lines.append("")
    if new_entrants:
        lines.append("New entrants in last 48h (not on list before):")
        lines.append("  " + ", ".join(new_entrants[:15]))
        lines.append("")
    if fades:
        lines.append("Fade alerts (was hot in prior 7d, dead in last 24h):")
        for f in fades[:8]:
            lines.append(f"  {f['symbol']}: prior {f['priorHits']} hits -> "
                         f"last 24h {f['recentHits']} hits")
        lines.append("")

    # CEX-side cross-source: CG trending + CMC trending only.
    # We deliberately exclude Farcaster and Reddit from this block. Farcaster
    # is a narrow corner of crypto-social and treating its cashtag silence
    # as "social silence" produced wrong calls (e.g. PENGU is loud on X but
    # quiet on FC). Twitter signal will be added later via burner X login;
    # until then the AI gets CEX-side data only.
    cross = doc.get("crossSource") or {}
    cross_per = cross.get("perCoin") or {}
    if cross_per:
        # rank by CG + CMC 24h combined, ignore social columns for the AI
        def cex_total(c):
            return c["cg"]["d1"] + c["cmc"]["d1"]

        ranked = sorted(cross_per.values(), key=lambda c: -cex_total(c))
        top_cex = [c for c in ranked if cex_total(c) >= 1][:12]
        lines.append("CEX-side trending presence (last 24h, CG + CMC only):")
        for c in top_cex:
            lines.append(
                f"  {c['symbol']}: CG {c['cg']['d1']}, CMC {c['cmc']['d1']}"
            )
        # CG vs CMC divergence — meaningful CEX-side manipulation tell
        cg_only = [
            c for c in ranked
            if c["cg"]["d1"] >= 5 and c["cmc"]["d1"] == 0
        ][:6]
        cmc_only = [
            c for c in ranked
            if c["cmc"]["d1"] >= 5 and c["cg"]["d1"] == 0
        ][:6]
        if cg_only:
            lines.append("")
            lines.append("Loud on CG but absent from CMC trending:")
            for c in cg_only:
                lines.append(f"  {c['symbol']}: CG {c['cg']['d1']}, CMC 0")
        if cmc_only:
            lines.append("")
            lines.append("Loud on CMC but absent from CG trending (often a CMC manipulation tell):")
            for c in cmc_only:
                lines.append(f"  {c['symbol']}: CMC {c['cmc']['d1']}, CG 0")
        lines.append("")

    lines.append("Question: What's heating up vs what's rolling over on CEX trending lists? "
                 "Distinguish sustained attention from single-event pumps. "
                 "Use the CG persistence + CG vs CMC divergence data above. "
                 "If a coin is loud on CMC but absent from CG, flag it as a likely CEX-side "
                 "manipulation tell. Call out anything PENGU-like that has held CG attention "
                 "for months. CRITICAL CONSTRAINT: we currently do NOT have Twitter, "
                 "general 'social media' or 'social sentiment' data. Do not speak about "
                 "'social silence', 'social loudness', or 'X buzz' at all. Stay strictly "
                 "on CG and CMC trending evidence.")
    return "\n".join(lines)


def build_narratives_msg(doc: dict) -> str:
    cats = doc.get("trending", {}).get("categories", {})
    snap_count = cats.get("snapshotCount", 0)
    now_list = cats.get("latestNow", [])[:8]
    per_item = cats.get("perItem", {})

    top_persist = sorted(
        per_item.values(),
        key=lambda c: c.get("count7d", 0),
        reverse=True,
    )[:10]

    lines = [f"Page: CoinGecko trending narratives (categories). "
             f"{snap_count} snapshots over last 30 days.", ""]
    lines.append("Currently hot categories (right now):")
    for i, c in enumerate(now_list, 1):
        lines.append(f"  #{i} {c.get('name','')}")
    lines.append("")
    lines.append("Top 10 by 7-day persistence:")
    for c in top_persist:
        lines.append(f"  {c.get('name','?')}: {c.get('count7d',0)} of {snap_count} snapshots, "
                     f"30d count {c.get('count30d',0)}")
    lines.append("")
    lines.append("Question: Which narrative is gaining mindshare vs losing it? "
                 "Look for rotation. AI Agents losing to Prediction Markets, that kind of thing. "
                 "If we have less than 5 days of data, say so plainly and call out what looks "
                 "like the dominant narrative anyway.")
    return "\n".join(lines)


# --- main ---------------------------------------------------------------------


def main():
    if not WEB_JSON.exists():
        print(f"no web.json at {WEB_JSON}, aborting")
        return 1
    doc = json.loads(WEB_JSON.read_text())

    if not API_KEY:
        print("warning: GEMINI_API_KEY not set, writing empty insights")

    insights = {}
    for label, builder in [
        ("home", build_home_msg),
        ("movements", build_movements_msg),
        ("trending", build_trending_msg),
        ("narratives", build_narratives_msg),
    ]:
        msg = builder(doc)
        text = call_gemini(msg, label)
        if text:
            print(f"  [{label}] {len(text.split())} words")
        insights[label] = text

    doc["insights"] = insights
    WEB_JSON.write_text(json.dumps(doc, default=str))
    nonempty = sum(1 for v in insights.values() if v)
    print(f"wrote {WEB_JSON} with {nonempty}/4 insights populated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
