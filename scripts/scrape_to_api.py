#!/usr/bin/env python3
"""
API-based ingestion pipeline:
Scrapes match data locally, then sends to Dokploy via HTTPS API.

No direct PostgreSQL connection needed — bypasses firewall entirely.

Usage:
  python scripts/scrape_to_api.py --ids-file collected_match_ids.json --workers 8
  python scripts/scrape_to_api.py --ids-file collected_match_ids_england_premier_2025_2026.json --workers 8 --bookmakers bet365
  python scripts/scrape_to_api.py --sync-only   # Just sync match_all_columns -> matches
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

LOGGER = logging.getLogger("scrape_to_api")
PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(message)s",
    )


def load_match_ids(ids_file: Path) -> list[str]:
    content = ids_file.read_text(encoding="utf-8").strip()
    if not content:
        return []

    match_ids: list[str] = []
    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict) and isinstance(parsed.get("match_ids"), list):
            match_ids = [str(item).strip() for item in parsed["match_ids"]]
        elif isinstance(parsed, list):
            match_ids = [str(item).strip() for item in parsed]
    except json.JSONDecodeError:
        pass

    if not match_ids:
        for line in content.splitlines():
            clean = line.strip().strip(",")
            if clean:
                match_ids.append(clean)

    unique_ids: list[str] = []
    seen = set()
    for match_id in match_ids:
        if match_id and match_id not in seen:
            seen.add(match_id)
            unique_ids.append(match_id)
    return unique_ids


class ApiClient:
    """Sends scraped data to mathgoal-app API."""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-Api-Key": api_key,
        })
        self.session.timeout = 60

    def check_status(self) -> dict:
        resp = self.session.get(f"{self.base_url}/api/ingest/status")
        resp.raise_for_status()
        return resp.json()

    def send_batch(self, rows: list[dict], bookmaker: str) -> dict:
        resp = self.session.post(
            f"{self.base_url}/api/ingest/batch",
            json={"rows": rows, "bookmaker": bookmaker},
        )
        resp.raise_for_status()
        return resp.json()

    def sync_matches(self) -> dict:
        resp = self.session.post(f"{self.base_url}/api/ingest/sync-matches")
        resp.raise_for_status()
        return resp.json()


def try_load_scraper():
    """Load the fast_scraper module."""
    try:
        from config import BOOKMAKER_MAPPING
        from fast_scraper import scrape_match_data
        LOGGER.info("fast_scraper yuklendi. Bookmakers: %s", list(BOOKMAKER_MAPPING.keys()))
        return scrape_match_data, list(BOOKMAKER_MAPPING.keys())
    except Exception as error:
        LOGGER.warning("fast_scraper yuklenemedi: %s", error)
        return None, []


def scrape_one(match_id: str, bookmaker: str, scrape_fn, logger) -> dict | None:
    """Scrape a single match for a given bookmaker."""
    try:
        result = scrape_fn(match_id, [bookmaker], {}, logger)
        if result:
            result["ide"] = match_id
            return result
    except Exception as e:
        LOGGER.debug("Scrape hata %s/%s: %s", match_id, bookmaker, e)
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape match odds and send to Mathgoal API."
    )
    parser.add_argument("--ids-file", default="collected_match_ids.json")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0, help="Limit number of match IDs")
    parser.add_argument("--log-level", default="INFO")
    parser.add_argument(
        "--bookmakers",
        default="bet365",
        help="Comma-separated bookmaker names or 'all'",
    )
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument(
        "--api-url",
        default="",
        help="API base URL (default: MATHGOAL_API_URL env or https://mathgoal.site)",
    )
    parser.add_argument(
        "--api-key",
        default="",
        help="API key (default: INGEST_API_KEY env variable)",
    )
    parser.add_argument(
        "--sync-only",
        action="store_true",
        help="Only sync match_all_columns -> matches, no scraping",
    )
    parser.add_argument(
        "--no-sync",
        action="store_true",
        help="Skip the final matches sync step",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(args.log_level)
    load_dotenv()

    # API connection
    api_url = args.api_url or os.getenv("MATHGOAL_API_URL", "https://mathgoal.site")
    api_key = args.api_key or os.getenv("INGEST_API_KEY", "")

    if not api_key:
        LOGGER.error("INGEST_API_KEY gerekli. .env dosyasina veya --api-key parametresine ekleyin.")
        sys.exit(1)

    client = ApiClient(api_url, api_key)

    # Test connection
    try:
        status = client.check_status()
        LOGGER.info(
            "API baglantisi basarili! match_all_columns: %s, matches: %s",
            status.get("match_all_columns", 0),
            status.get("matches", 0),
        )
    except Exception as e:
        LOGGER.error("API baglantisi basarisiz: %s", e)
        sys.exit(1)

    # Sync-only mode
    if args.sync_only:
        LOGGER.info("Sync-only modu: match_all_columns -> matches senkronizasyonu...")
        try:
            result = client.sync_matches()
            LOGGER.info(
                "Sync tamamlandi! Senkronize: %s, Toplam matches: %s",
                result.get("synced", 0),
                result.get("totalMatches", 0),
            )
        except Exception as e:
            LOGGER.error("Sync hatasi: %s", e)
        return

    # Load scraper
    scrape_fn, supported_bookmakers = try_load_scraper()
    if scrape_fn is None:
        LOGGER.error("fast_scraper yuklenemedi. Scraping yapilamaz.")
        sys.exit(1)

    # Load match IDs
    ids_file = Path(args.ids_file)
    if not ids_file.exists():
        LOGGER.error("Match id dosyasi bulunamadi: %s", ids_file)
        sys.exit(1)

    match_ids = load_match_ids(ids_file)
    if args.limit > 0:
        match_ids = match_ids[: args.limit]

    if not match_ids:
        LOGGER.warning("Islenecek match id bulunamadi.")
        return

    # Parse bookmakers
    if args.bookmakers.strip().lower() == "all":
        bookmakers = supported_bookmakers if supported_bookmakers else ["bet365"]
    else:
        bookmakers = [b.strip() for b in args.bookmakers.split(",") if b.strip()]

    workers = max(args.workers, 1)
    batch_size = max(args.batch_size, 1)

    LOGGER.info(
        "Basliyor | ids: %s | workers: %s | bookmakers: %s | batch: %s",
        len(match_ids), workers, bookmakers, batch_size,
    )

    total_ok = 0
    total_fail = 0
    total_sent = 0

    for bookmaker in bookmakers:
        LOGGER.info("=" * 50)
        LOGGER.info("Bookmaker: %s", bookmaker)
        batch: list[dict] = []

        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_map = {
                executor.submit(scrape_one, mid, bookmaker, scrape_fn, LOGGER): mid
                for mid in match_ids
            }

            for idx, future in enumerate(as_completed(future_map), start=1):
                match_id = future_map[future]
                try:
                    result = future.result()
                    if result:
                        batch.append(result)
                        total_ok += 1
                        if idx % 50 == 0 or idx == len(match_ids):
                            LOGGER.info("[%s/%s] OK %s", idx, len(match_ids), match_id)
                    else:
                        total_fail += 1
                        LOGGER.warning("[%s/%s] EMPTY %s/%s", idx, len(match_ids), match_id, bookmaker)
                except Exception as error:
                    total_fail += 1
                    LOGGER.warning("[%s/%s] FAIL %s: %s", idx, len(match_ids), match_id, error)

                # Send batch when full
                if len(batch) >= batch_size:
                    try:
                        resp = client.send_batch(batch, bookmaker)
                        total_sent += resp.get("upserted", 0)
                        LOGGER.info("Batch gonderildi: %s rows -> API", resp.get("upserted", 0))
                    except Exception as e:
                        LOGGER.error("Batch gonderme hatasi: %s", e)
                    batch = []

        # Send remaining
        if batch:
            try:
                resp = client.send_batch(batch, bookmaker)
                total_sent += resp.get("upserted", 0)
                LOGGER.info("Son batch gonderildi: %s rows -> API", resp.get("upserted", 0))
            except Exception as e:
                LOGGER.error("Son batch hatasi: %s", e)

    LOGGER.info("=" * 50)
    LOGGER.info("SCRAPE TAMAMLANDI | OK: %s | FAIL: %s | API'ye gonderilen: %s", total_ok, total_fail, total_sent)

    # Sync matches
    if not args.no_sync:
        LOGGER.info("matches tablosu senkronize ediliyor...")
        try:
            result = client.sync_matches()
            LOGGER.info(
                "Sync tamamlandi! Senkronize: %s, Toplam matches: %s",
                result.get("synced", 0),
                result.get("totalMatches", 0),
            )
        except Exception as e:
            LOGGER.error("Sync hatasi: %s", e)

    # Final status
    try:
        status = client.check_status()
        LOGGER.info("Son durum -> match_all_columns: %s, matches: %s",
                     status.get("match_all_columns", 0), status.get("matches", 0))
    except Exception:
        pass


if __name__ == "__main__":
    main()
