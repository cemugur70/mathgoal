#!/usr/bin/env python3
"""
MVP ingestion pipeline:
1) Read match ids
2) Scrape match summary from Flashscore pages
3) Upsert into PostgreSQL
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from psycopg import connect
from psycopg.types.json import Jsonb
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


LOGGER = logging.getLogger("scrape_to_postgres")


@dataclass
class MatchRecord:
    match_id: str
    home_team: str
    away_team: str
    home_score: int | None
    away_score: int | None
    full_time_result: str | None
    country: str | None
    league: str | None
    round_no: int | None
    season: str | None
    match_date: date | None
    match_time: str | None
    source_url: str
    raw_payload: dict[str, Any]


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(message)s",
    )


def create_http_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(
        total=4,
        connect=4,
        read=4,
        backoff_factor=0.6,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries, pool_connections=40, pool_maxsize=40)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
    )
    return session


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


def parse_title(og_title: str) -> tuple[str, str, int | None, int | None]:
    title = og_title.split("|", maxsplit=1)[0].strip()
    match = re.match(r"^(.+?)\s*-\s*(.+?)(?:\s+(\d+)\s*:\s*(\d+))?$", title)
    if not match:
        raise ValueError(f"Beklenmeyen baslik formati: {og_title}")
    home_team = match.group(1).strip()
    away_team = match.group(2).strip()
    home_score = int(match.group(3)) if match.group(3) is not None else None
    away_score = int(match.group(4)) if match.group(4) is not None else None
    return home_team, away_team, home_score, away_score


def parse_competition(og_description: str) -> tuple[str | None, str | None, int | None]:
    if not og_description:
        return None, None, None

    match = re.match(r"^([^:]+):\s*(.+?)(?:\s*-\s*Round\s*(\d+))?(?:\s*$)", og_description.strip())
    if not match:
        return None, og_description.strip(), None

    country = match.group(1).strip()
    league = match.group(2).strip()
    round_no = int(match.group(3)) if match.group(3) else None
    return country, league, round_no


def parse_date_and_time(meta_description: str) -> tuple[date | None, str | None]:
    if not meta_description:
        return None, None

    date_match = re.search(r"(\d{1,2})[./](\d{1,2})[./](\d{4})", meta_description)
    time_match = re.search(r"\b(\d{1,2}:\d{2})\b", meta_description)

    parsed_date: date | None = None
    if date_match:
        day = int(date_match.group(1))
        month = int(date_match.group(2))
        year = int(date_match.group(3))
        parsed_date = date(year=year, month=month, day=day)

    parsed_time = time_match.group(1) if time_match else None
    return parsed_date, parsed_time


def detect_season(match_date: date | None) -> str | None:
    if match_date is None:
        return None
    if match_date.month >= 8:
        return f"{match_date.year}-{match_date.year + 1}"
    return f"{match_date.year - 1}-{match_date.year}"


def build_result_code(home_score: int | None, away_score: int | None) -> str | None:
    if home_score is None or away_score is None:
        return None
    if home_score > away_score:
        return "MS 1"
    if away_score > home_score:
        return "MS 2"
    return "MS 0"


def scrape_match(session: requests.Session, match_id: str) -> MatchRecord:
    source_url = f"https://www.flashscore.com/match/{match_id}/"
    response = session.get(source_url, timeout=(5, 15))
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    og_title = soup.select_one('meta[property="og:title"]')
    og_description = soup.select_one('meta[property="og:description"]')
    meta_description = soup.select_one('meta[name="description"]')

    if og_title is None:
        raise ValueError("og:title bulunamadi")

    home_team, away_team, home_score, away_score = parse_title(og_title.get("content", ""))
    country, league, round_no = parse_competition(og_description.get("content", "") if og_description else "")
    parsed_date, parsed_time = parse_date_and_time(
        meta_description.get("content", "") if meta_description else ""
    )

    record = MatchRecord(
        match_id=match_id,
        home_team=home_team,
        away_team=away_team,
        home_score=home_score,
        away_score=away_score,
        full_time_result=build_result_code(home_score, away_score),
        country=country,
        league=league,
        round_no=round_no,
        season=detect_season(parsed_date),
        match_date=parsed_date,
        match_time=parsed_time,
        source_url=source_url,
        raw_payload={
            "og_title": og_title.get("content", ""),
            "og_description": og_description.get("content", "") if og_description else "",
            "meta_description": meta_description.get("content", "") if meta_description else "",
        },
    )
    return record


def scrape_many(match_ids: list[str], workers: int) -> tuple[list[MatchRecord], list[str]]:
    session = create_http_session()
    records: list[MatchRecord] = []
    failed_ids: list[str] = []

    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_map = {executor.submit(scrape_match, session, match_id): match_id for match_id in match_ids}
        for index, future in enumerate(as_completed(future_map), start=1):
            match_id = future_map[future]
            try:
                records.append(future.result())
                LOGGER.info("[%s/%s] OK %s", index, len(match_ids), match_id)
            except Exception as error:
                failed_ids.append(match_id)
                LOGGER.warning("[%s/%s] FAIL %s (%s)", index, len(match_ids), match_id, error)

    session.close()
    return records, failed_ids


def ensure_schema(conn, sql_path: Path) -> None:
    sql = sql_path.read_text(encoding="utf-8")
    with conn.cursor() as cursor:
        cursor.execute(sql)
    conn.commit()


def upsert_matches(conn, records: list[MatchRecord]) -> int:
    if not records:
        return 0

    sql = """
    INSERT INTO matches (
      match_id,
      home_team,
      away_team,
      home_score,
      away_score,
      full_time_result,
      country,
      league,
      round_no,
      season,
      match_date,
      match_time,
      source_url,
      raw_payload,
      scraped_at
    )
    VALUES (
      %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
    )
    ON CONFLICT (match_id)
    DO UPDATE SET
      home_team = EXCLUDED.home_team,
      away_team = EXCLUDED.away_team,
      home_score = EXCLUDED.home_score,
      away_score = EXCLUDED.away_score,
      full_time_result = EXCLUDED.full_time_result,
      country = EXCLUDED.country,
      league = EXCLUDED.league,
      round_no = EXCLUDED.round_no,
      season = EXCLUDED.season,
      match_date = EXCLUDED.match_date,
      match_time = EXCLUDED.match_time,
      source_url = EXCLUDED.source_url,
      raw_payload = EXCLUDED.raw_payload,
      scraped_at = NOW()
    """

    rows = [
        (
            record.match_id,
            record.home_team,
            record.away_team,
            record.home_score,
            record.away_score,
            record.full_time_result,
            record.country,
            record.league,
            record.round_no,
            record.season,
            record.match_date,
            record.match_time,
            record.source_url,
            Jsonb(record.raw_payload),
        )
        for record in records
    ]

    with conn.cursor() as cursor:
      cursor.executemany(sql, rows)
    conn.commit()
    return len(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape match pages and upsert to PostgreSQL.")
    parser.add_argument(
        "--ids-file",
        default="collected_match_ids.json",
        help="JSON file (match_ids list) or line-based file with match ids",
    )
    parser.add_argument("--workers", type=int, default=8, help="Concurrent request worker count")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of match ids (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Scrape only, do not write to DB")
    parser.add_argument("--log-level", default="INFO", help="DEBUG, INFO, WARNING, ERROR")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(args.log_level)
    load_dotenv()

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url and not args.dry_run:
        raise RuntimeError("DATABASE_URL bulunamadi. .env veya ortam degiskeni tanimlayin.")

    ids_file = Path(args.ids_file)
    if not ids_file.exists():
        raise FileNotFoundError(f"Match id dosyasi bulunamadi: {ids_file}")

    match_ids = load_match_ids(ids_file)
    if args.limit > 0:
        match_ids = match_ids[: args.limit]

    if not match_ids:
        LOGGER.warning("Islenecek match id bulunamadi.")
        return

    LOGGER.info("Toplam id: %s | workers: %s", len(match_ids), args.workers)
    records, failed_ids = scrape_many(match_ids, workers=max(args.workers, 1))
    LOGGER.info("Scrape tamamlandi | basarili: %s | hatali: %s", len(records), len(failed_ids))

    if args.dry_run:
        LOGGER.info("Dry-run aktif, DB yazimi atlandi.")
        return

    sql_path = Path(__file__).resolve().parents[1] / "sql" / "001_init.sql"
    with connect(database_url) as conn:
        ensure_schema(conn, sql_path=sql_path)
        inserted = upsert_matches(conn, records)

    LOGGER.info("DB upsert tamamlandi | satir: %s", inserted)
    if failed_ids:
        LOGGER.warning("Basarisiz id'ler: %s", ", ".join(failed_ids))


if __name__ == "__main__":
    main()
