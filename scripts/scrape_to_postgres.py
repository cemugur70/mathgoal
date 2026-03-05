#!/usr/bin/env python3
"""
All-columns ingestion pipeline:
1) Match id listesini okur
2) Her bookmaker icin veri ceker
3) match_all_columns tablosuna JSONB raw_data olarak upsert eder
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from psycopg import connect
from psycopg.types.json import Jsonb

LOGGER = logging.getLogger("scrape_to_postgres")
PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

BOOKMAKERS_ALL = [
    "Bwin",
    "Betway",
    "bet365",
    "1xBet",
    "Pinnacle",
    "William Hill",
    "Unibet",
    "Betfair",
    "Betclic",
    "SBOBet",
]

FAST_BOOKMAKER_ALIASES = {
    "Unibet": "Unibetuk",
}

BASE_TEMPLATE_KEYS = {
    "ide",
    "TARİH",
    "GÜN",
    "SAAT",
    "HAFTA",
    "EV SAHİBİ",
    "DEPLASMAN",
    "İY",
    "MS",
    "İY SONUCU",
    "MS SONUCU",
    "İY-MS",
    "2.5 ALT ÜST",
    "3.5 ÜST",
    "KG VAR/YOK",
    "İY 0.5 ALT ÜST",
    "İY 1.5 ALT ÜST",
    "ÜLKE",
    "LİG",
}

SCRAPE_MATCH_DATA = None


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


def load_all_columns(col_file: Path) -> list[str]:
    if not col_file.exists():
        raise FileNotFoundError(f"all_columns dosyasi bulunamadi: {col_file}")
    columns = [line.strip() for line in col_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not columns:
        raise ValueError(f"all_columns dosyasi bos: {col_file}")
    return list(dict.fromkeys(columns))


def parse_bookmakers(raw: str) -> list[str]:
    if not raw or raw.strip().lower() == "all":
        return BOOKMAKERS_ALL[:]
    values = [item.strip() for item in raw.split(",") if item.strip()]
    if not values:
        return BOOKMAKERS_ALL[:]
    return values


def try_load_fast_scraper() -> None:
    global SCRAPE_MATCH_DATA
    if SCRAPE_MATCH_DATA is not None:
        return
    try:
        from fast_scraper import scrape_match_data  # type: ignore

        SCRAPE_MATCH_DATA = scrape_match_data
        LOGGER.info("fast_scraper yuklendi.")
    except Exception as error:
        SCRAPE_MATCH_DATA = None
        LOGGER.warning("fast_scraper kullanilamadi, Playwright fallback devrede: %s", error)


def normalize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return value


def turkishify_column_name(column_name: str, bookmaker_names: list[str]) -> str:
    if column_name in BASE_TEMPLATE_KEYS:
        return column_name

    transformed = column_name

    translations = [
        ("_home", " 1"),
        ("_away", " 2"),
        ("_draw", " X"),
        ("_over", " Üst"),
        ("_under", " Alt"),
        ("_yes", " true"),
        ("_no", " false"),
        ("_odd", " Tek"),
        ("_even", " Çift"),
        ("first_half_", "İY "),
        ("second_half_", "2Y "),
        ("_first_half", " İY"),
        ("_second_half", " 2Y"),
        ("home_draw_odds", "1X"),
        ("home_away_odds", "12"),
        ("away_draw", "X2"),
    ]
    for eng, tr in translations:
        transformed = transformed.replace(eng, tr)

    transformed = transformed.replace("opening_", "AÇ ")

    for bookmaker in bookmaker_names:
        transformed = transformed.replace(f"{bookmaker} ", "")
        transformed = transformed.replace(f"{bookmaker}_", "")
        transformed = transformed.replace(f"{bookmaker.lower()} ", "")
        transformed = transformed.replace(f"{bookmaker.lower()}_", "")

    transformed = transformed.replace("_", " ")
    transformed = transformed.replace(".", " ")
    while "  " in transformed:
        transformed = transformed.replace("  ", " ")
    return transformed.strip()


def build_all_columns_row(
    scraped_data: dict[str, Any],
    bookmaker: str,
    all_columns: list[str],
    bookmaker_names: list[str],
    candidate_names: list[str],
) -> dict[str, Any]:
    source_map: dict[str, str] = {}
    lower_candidates = [name.lower() for name in candidate_names]

    for key in scraped_data:
        if key in BASE_TEMPLATE_KEYS:
            source_map[key] = key
        elif any(candidate in key.lower() for candidate in lower_candidates):
            transformed = turkishify_column_name(key, bookmaker_names)
            source_map.setdefault(transformed, key)

    result: dict[str, Any] = {}
    for column in all_columns:
        source_key = source_map.get(column)
        if source_key:
            result[column] = normalize_value(scraped_data.get(source_key))
        else:
            result[column] = None

    result["ide"] = normalize_value(scraped_data.get("ide")) or normalize_value(scraped_data.get("MATCH_ID"))
    result["bookmaker"] = bookmaker
    return result


def fallback_playwright_row(match_id: str, bookmaker: str, all_columns: list[str]) -> dict[str, Any]:
    row = {column: None for column in all_columns}
    row["ide"] = match_id
    row["bookmaker"] = bookmaker

    try:
        from playwright.sync_api import sync_playwright

        url = f"https://www.flashscore.com/match/{match_id}/#/odds-comparison/1x2-odds/full-time"
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page()
            page.goto(url, timeout=20000, wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            browser.close()
    except Exception as error:
        LOGGER.debug("Playwright fallback hata %s/%s: %s", match_id, bookmaker, error)

    return row


def scrape_match_bookmaker(
    match_id: str,
    bookmaker: str,
    all_columns: list[str],
    bookmaker_names: list[str],
) -> tuple[dict[str, Any], bool]:
    fast_name = FAST_BOOKMAKER_ALIASES.get(bookmaker, bookmaker)

    if SCRAPE_MATCH_DATA is not None:
        try:
            scraped = SCRAPE_MATCH_DATA(match_id, [fast_name], {}, LOGGER)
            if scraped:
                row = build_all_columns_row(
                    scraped_data=scraped,
                    bookmaker=bookmaker,
                    all_columns=all_columns,
                    bookmaker_names=bookmaker_names,
                    candidate_names=[bookmaker, fast_name],
                )
                return row, True
        except Exception as error:
            LOGGER.debug("fast_scraper hata %s/%s: %s", match_id, bookmaker, error)

    row = fallback_playwright_row(match_id, bookmaker, all_columns)
    return row, False


def upsert_batch(conn, rows: list[dict[str, Any]], bookmaker: str) -> int:
    if not rows:
        return 0

    upsert_sql = """
        INSERT INTO match_all_columns (match_id, bookmaker, raw_data, scraped_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (match_id, bookmaker)
        DO UPDATE SET
            raw_data = EXCLUDED.raw_data,
            scraped_at = NOW()
    """

    with conn.cursor() as cur:
        cur.executemany(
            upsert_sql,
            [(row.get("ide"), bookmaker, Jsonb(row)) for row in rows],
        )
    conn.commit()
    return len(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape match odds and upsert to PostgreSQL match_all_columns."
    )
    parser.add_argument("--ids-file", default="collected_match_ids.json")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--log-level", default="INFO")
    parser.add_argument(
        "--bookmakers",
        default="all",
        help="Comma-separated bookmaker names or 'all'",
    )
    parser.add_argument("--batch-size", type=int, default=120)
    parser.add_argument("--all-columns-file", default="all_columns.txt")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(args.log_level)
    load_dotenv()
    try_load_fast_scraper()

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url and not args.dry_run:
        raise RuntimeError("DATABASE_URL bulunamadi.")

    ids_file = Path(args.ids_file)
    if not ids_file.exists():
        raise FileNotFoundError(f"Match id dosyasi bulunamadi: {ids_file}")

    match_ids = load_match_ids(ids_file)
    if args.limit > 0:
        match_ids = match_ids[: args.limit]
    if not match_ids:
        LOGGER.warning("Islenecek match id bulunamadi.")
        return

    all_columns_path = Path(args.all_columns_file)
    if not all_columns_path.is_absolute():
        all_columns_path = PROJECT_ROOT / all_columns_path
    all_columns = load_all_columns(all_columns_path)

    bookmakers = parse_bookmakers(args.bookmakers)
    workers = max(args.workers, 1)
    batch_size = max(args.batch_size, 1)

    LOGGER.info(
        "Toplam id: %s | workers: %s | bookmakers: %s | batch: %s | all_columns: %s",
        len(match_ids),
        workers,
        len(bookmakers),
        batch_size,
        len(all_columns),
    )

    total_ok = 0
    total_fallback = 0
    total_fail = 0
    total_upsert = 0

    if args.dry_run:
        conn = None
    else:
        conn = connect(database_url)

    try:
        bookmaker_names = BOOKMAKERS_ALL[:]

        for bookmaker in bookmakers:
            LOGGER.info("Bookmaker basladi: %s", bookmaker)
            batch: list[dict[str, Any]] = []

            with ThreadPoolExecutor(max_workers=workers) as executor:
                future_map = {
                    executor.submit(
                        scrape_match_bookmaker,
                        match_id,
                        bookmaker,
                        all_columns,
                        bookmaker_names,
                    ): match_id
                    for match_id in match_ids
                }

                for idx, future in enumerate(as_completed(future_map), start=1):
                    match_id = future_map[future]
                    try:
                        row, from_fast = future.result()
                        if row.get("ide") is None:
                            row["ide"] = match_id
                        batch.append(row)
                        if from_fast:
                            total_ok += 1
                            LOGGER.info("[%s/%s] OK %s / %s", idx, len(match_ids), match_id, bookmaker)
                        else:
                            total_fallback += 1
                            LOGGER.warning(
                                "[%s/%s] FALLBACK %s / %s",
                                idx,
                                len(match_ids),
                                match_id,
                                bookmaker,
                            )
                    except Exception as error:
                        total_fail += 1
                        LOGGER.warning(
                            "[%s/%s] FAIL %s / %s: %s",
                            idx,
                            len(match_ids),
                            match_id,
                            bookmaker,
                            error,
                        )
                        continue

                    if len(batch) >= batch_size:
                        if conn is not None:
                            upserted = upsert_batch(conn, batch, bookmaker)
                            total_upsert += upserted
                            LOGGER.info("Batch upsert: %s rows (%s)", upserted, bookmaker)
                        batch = []

            if batch and conn is not None:
                upserted = upsert_batch(conn, batch, bookmaker)
                total_upsert += upserted
                LOGGER.info("Son batch upsert: %s rows (%s)", upserted, bookmaker)

        LOGGER.info(
            "Tamamlandi | fast_ok: %s | fallback: %s | fail: %s | upsert: %s",
            total_ok,
            total_fallback,
            total_fail,
            total_upsert,
        )
    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    main()
