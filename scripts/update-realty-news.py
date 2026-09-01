#!/usr/bin/env python3
"""Bounded Realty news collector.

Adds at most one new RWA and one new metaverse item per refresh, keeps a rolling
archive, and materializes the cards into static HTML for crawlability. It does
not summarize article bodies and never copies article text.
"""
from __future__ import annotations

import argparse
import email.utils
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "realty" / "news" / "data.json"
PAGE_PATH = ROOT / "realty" / "news" / "index.html"
MAX_ITEMS = 12
CADENCE_HOURS = 72
DENY = ("price prediction", "presale", "airdrop", "casino", "betting", "giveaway")
QUERIES = {
    "rwa": '"tokenized real estate" OR "real estate tokenization" OR "tokenized property"',
    "metaverse": '"metaverse real estate" OR "virtual land" Decentraland Sandbox Otherside',
}
MARKERS = {
    "rwa": ("<!-- RWA_NEWS_START -->", "<!-- RWA_NEWS_END -->"),
    "metaverse": ("<!-- METAVERSE_NEWS_START -->", "<!-- METAVERSE_NEWS_END -->"),
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def normalize_title(value: str) -> str:
    value = re.sub(r"\s+-\s+[^-]{2,60}$", "", value).strip()
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def clean_google_title(title: str, source: str) -> str:
    suffix = f" - {source}" if source else ""
    if suffix and title.endswith(suffix):
        title = title[: -len(suffix)]
    return re.sub(r"\s+", " ", title).strip()


def fetch_candidates(query: str) -> list[dict[str, str]]:
    params = urllib.parse.urlencode({
        "q": query,
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en",
    })
    url = f"https://news.google.com/rss/search?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "TheHolding-Realty-News/1.0"})
    with urllib.request.urlopen(req, timeout=25) as response:
        xml = response.read()
    root = ET.fromstring(xml)
    out: list[dict[str, str]] = []
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        source_node = item.find("source")
        source = ((source_node.text if source_node is not None else "") or "").strip()
        title = clean_google_title(title, source)
        if not title or not link or any(term in title.lower() for term in DENY):
            continue
        try:
            dt = email.utils.parsedate_to_datetime(pub).astimezone(timezone.utc)
        except Exception:
            dt = utcnow()
        out.append({
            "title": title[:220],
            "source": source[:80] or "External source",
            "publishedAt": dt.isoformat().replace("+00:00", "Z"),
            "url": link,
        })
    return out


def choose_new(existing: list[dict[str, str]], candidates: list[dict[str, str]]) -> dict[str, str] | None:
    seen = {normalize_title(item.get("title", "")) for item in existing}
    for candidate in candidates:
        key = normalize_title(candidate["title"])
        if key and key not in seen:
            return candidate
    return None


def fmt_date(value: str) -> str:
    try:
        return parse_dt(value).strftime("%b %d, %Y")
    except Exception:
        return "Recent"


def render_cards(items: list[dict[str, str]], lane: str) -> str:
    cards = []
    for item in items[:MAX_ITEMS]:
        title = html.escape(item.get("title", "Untitled"))
        source = html.escape(item.get("source", "External source"))
        date = html.escape(fmt_date(item.get("publishedAt", "")))
        url = html.escape(item.get("url", "#"), quote=True)
        cards.append(
            f'<article class="news-card {lane}">'
            f'<div class="news-meta"><span>{source}</span><time>{date}</time></div>'
            f'<h3>{title}</h3>'
            f'<a href="{url}" target="_blank" rel="noopener noreferrer">Read source <span aria-hidden="true">↗</span></a>'
            f'</article>'
        )
    return "\n".join(cards)


def replace_region(page: str, start: str, end: str, replacement: str) -> str:
    if start not in page or end not in page:
        raise RuntimeError(f"Missing news marker: {start} / {end}")
    before, rest = page.split(start, 1)
    _, after = rest.split(end, 1)
    return f"{before}{start}\n{replacement}\n{end}{after}"


def materialize(data: dict) -> None:
    page = PAGE_PATH.read_text(encoding="utf-8")
    for lane in ("rwa", "metaverse"):
        start, end = MARKERS[lane]
        page = replace_region(page, start, end, render_cards(data.get(lane, []), lane))
    generated = html.escape(data.get("generatedAt", ""))
    page = re.sub(
        r'(<time class="feed-updated" datetime=")[^"]*(">)[^<]*(</time>)',
        lambda m: f'{m.group(1)}{generated}{m.group(2)}Updated {fmt_date(generated)}{m.group(3)}',
        page,
        count=1,
    )
    PAGE_PATH.write_text(page, encoding="utf-8")


def validate(data: dict) -> None:
    for lane in ("rwa", "metaverse"):
        items = data.get(lane)
        if not isinstance(items, list) or not items:
            raise RuntimeError(f"{lane} feed must contain items")
        for item in items:
            for key in ("title", "source", "publishedAt", "url"):
                if not item.get(key):
                    raise RuntimeError(f"{lane} item missing {key}")
            if not item["url"].startswith("https://"):
                raise RuntimeError(f"{lane} URL must be HTTPS")
    page = PAGE_PATH.read_text(encoding="utf-8")
    for start, end in MARKERS.values():
        if page.count(start) != 1 or page.count(end) != 1:
            raise RuntimeError("News page markers must be unique")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    validate(data)
    if args.validate:
        print("Realty news contract GREEN")
        return 0

    force = args.force or os.getenv("FORCE_REFRESH") == "1"
    last = parse_dt(data.get("generatedAt", "1970-01-01T00:00:00Z"))
    age_hours = (utcnow() - last).total_seconds() / 3600
    if not force and age_hours < CADENCE_HOURS:
        print(f"Cadence guard: {age_hours:.1f}h since last refresh; no update needed")
        return 0

    changed = False
    for lane, query in QUERIES.items():
        try:
            candidate = choose_new(data.get(lane, []), fetch_candidates(query))
        except Exception as exc:
            print(f"WARN: {lane} feed fetch failed: {exc}", file=sys.stderr)
            candidate = None
        if candidate:
            data[lane] = [candidate, *data.get(lane, [])][:MAX_ITEMS]
            changed = True
            print(f"Added {lane}: {candidate['title']}")
        else:
            print(f"No new {lane} item found")

    if changed or force:
        data["generatedAt"] = utcnow().replace(microsecond=0).isoformat().replace("+00:00", "Z")
        DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        materialize(data)
        validate(data)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
