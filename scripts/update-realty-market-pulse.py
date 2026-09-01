#!/usr/bin/env python3
"""Refresh the bounded Realty metaverse-land 30d volume snapshot.

Runs inside the existing Change Intelligence writer. It is deliberately bounded:
- weekly cadence guard (168h)
- two public, source-linked NFTHUD land collections
- no estimates, extrapolation or zero fallback
- any source/parse failure preserves the last-known-good snapshot
"""
from __future__ import annotations

import argparse
import html as html_lib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

DATA_PATH = Path("realty/data/market-pulse.json")
CADENCE = timedelta(hours=168)
SOURCES = (
    ("Otherdeed Expanded", "https://www.nfthud.io/collections/otherdeed-expanded"),
    ("Decentraland LAND", "https://www.nfthud.io/collections/decentraland"),
)
VOLUME_RE = re.compile(r"30d\s*Vol\s*([0-9][0-9,.]*)\s*(?:Ξ|ETH)", re.I)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def load_data() -> dict:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(data.get("metrics"), dict):
        raise ValueError("market-pulse metrics missing")
    return data


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
        except ValueError:
            return None


def fetch_volume(url: str) -> float:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; TheHolding-Realty-Pulse/1.0; +https://theholding.ai/realty/)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        raw = response.read().decode("utf-8", errors="replace")
    text = html_lib.unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"\s+", " ", text)
    match = VOLUME_RE.search(text)
    if not match:
        raise ValueError(f"30d volume not found: {url}")
    value = float(match.group(1).replace(",", ""))
    if value < 0 or value > 1_000_000:
        raise ValueError(f"implausible 30d volume: {value}")
    return value


def validate(data: dict) -> None:
    metric = data.get("metrics", {}).get("metaverseLandVolume30dEth")
    if not isinstance(metric, dict):
        raise ValueError("metaverseLandVolume30dEth missing")
    if metric.get("unit") != "ETH" or metric.get("period") != "30d":
        raise ValueError("metaverse volume contract drift")
    value = metric.get("value")
    if not isinstance(value, (int, float)) or value < 0:
        raise ValueError("metaverse volume value invalid")
    components = metric.get("components")
    if not isinstance(components, list) or len(components) != len(SOURCES):
        raise ValueError("metaverse volume components invalid")
    for component in components:
        if not component.get("name") or not component.get("sourceUrl"):
            raise ValueError("metaverse volume provenance incomplete")


def refresh(force: bool = False) -> bool:
    data = load_data()
    validate(data)
    current = now_utc()
    last = parse_date(data.get("updatedAt"))
    if not force and last and current - last < CADENCE:
        print("Realty market pulse: weekly cadence not due; keeping last-known-good snapshot.")
        return False

    components = []
    try:
        for name, url in SOURCES:
            value = fetch_volume(url)
            components.append(
                {
                    "name": name,
                    "volume30dEth": round(value, 2),
                    "source": "NFTHUD",
                    "sourceUrl": url,
                    "sourceSnapshotDate": current.date().isoformat(),
                }
            )
    except Exception as exc:  # fail-closed: preserve prior JSON
        print(f"Realty market pulse: source refresh unavailable ({exc}); preserving last-known-good.")
        return False

    total = round(sum(item["volume30dEth"] for item in components), 2)
    metric = data["metrics"]["metaverseLandVolume30dEth"]
    metric.update(
        {
            "value": total,
            "display": f"{total:.1f} ETH",
            "unit": "ETH",
            "period": "30d",
            "scope": "Bounded flagship Ethereum virtual-land basket: Otherdeed Expanded and Decentraland LAND. This is not an estimate of the entire metaverse market.",
            "components": components,
            "methodology": "Sum of published 30-day collection volumes from the named NFTHUD land collections. No extrapolation, token-volume substitution or fabricated fallback.",
        }
    )
    data["snapshotDate"] = current.date().isoformat()
    data["updatedAt"] = current.isoformat().replace("+00:00", "Z")
    data.setdefault("provenance", {})["metaverseLandVolume30d"] = (
        "Bounded NFTHUD collection snapshots for Otherdeed Expanded and Decentraland LAND; "
        "the displayed basket is intentionally narrower than total metaverse activity."
    )
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Realty market pulse refreshed: {total:.1f} ETH (30d bounded land basket).")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    try:
        data = load_data()
        validate(data)
        if args.validate:
            print("Realty market pulse contract OK.")
            return 0
        refresh(force=args.force)
        return 0
    except Exception as exc:
        print(f"Realty market pulse validation failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
