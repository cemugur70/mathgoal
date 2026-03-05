#!/usr/bin/env python3
"""
Collect match ids from a specific Flashscore league and season range.

Usage examples:
  python scripts/collect_match_ids_from_league.py \
    --country England \
    --league "Premier League" \
    --league-url "https://www.flashscore.co.uk/football/england/premier-league/" \
    --season-start 2025 \
    --season-end 2025 \
    --output collected_match_ids_england_premier_2025_2026.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright


LOGGER = logging.getLogger("collect_match_ids")
BASE_URL = "https://www.flashscore.co.uk"


@dataclass
class SeasonItem:
    text: str
    start_year: int
    end_year: int
    season_url: str
    results_url: str


def setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(message)s",
    )


def normalize_league_url(url: str) -> str:
    normalized = url.strip()
    if not normalized:
        raise ValueError("league_url bos olamaz")

    if normalized.startswith("/"):
        normalized = urljoin(BASE_URL, normalized)
    if not normalized.startswith("http"):
        normalized = f"{BASE_URL.rstrip('/')}/{normalized.lstrip('/')}"

    normalized = normalized.split("?", maxsplit=1)[0].split("#", maxsplit=1)[0]
    normalized = normalized.rstrip("/")

    normalized = re.sub(
        r"/(results|fixtures|standings|odds|news|archive)$",
        "",
        normalized,
        flags=re.IGNORECASE,
    )
    return f"{normalized}/"


def build_archive_url(league_url: str) -> str:
    return f"{league_url.rstrip('/')}/archive/"


def build_results_url(season_url: str) -> str:
    clean = season_url.rstrip("/")
    if clean.endswith("/results"):
        return f"{clean}/"
    return f"{clean}/results/"


def parse_years_from_season_text(text: str) -> tuple[int, int] | None:
    season_text = text.strip()
    year_pair = re.search(r"(\d{4})\s*/\s*(\d{2,4})", season_text)
    if year_pair:
        start_year = int(year_pair.group(1))
        end_raw = year_pair.group(2)
        end_year = int(end_raw)
        if len(end_raw) == 2:
            end_year = (start_year // 100) * 100 + end_year
            if end_year < start_year:
                end_year += 100
        return start_year, end_year

    single_year = re.search(r"(\d{4})", season_text)
    if single_year:
        year = int(single_year.group(1))
        return year, year
    return None


async def collect_seasons(page, archive_url: str) -> list[SeasonItem]:
    await page.goto(archive_url, timeout=60000)
    await page.wait_for_load_state("domcontentloaded", timeout=20000)
    await page.wait_for_selector("div.archiveLatte__row", timeout=20000)

    rows = await page.locator("div.archiveLatte__row").all()
    seasons: list[SeasonItem] = []
    seen_urls = set()

    for row in rows:
        anchor = row.locator("a.archiveLatte__text").first
        if await anchor.count() == 0:
            continue

        text = (await anchor.text_content() or "").strip()
        href = (await anchor.get_attribute("href") or "").strip()
        if not text or not href:
            continue

        parsed = parse_years_from_season_text(text)
        if not parsed:
            continue

        start_year, end_year = parsed
        season_url = urljoin(BASE_URL, href)
        if season_url in seen_urls:
            continue
        seen_urls.add(season_url)

        seasons.append(
            SeasonItem(
                text=text,
                start_year=start_year,
                end_year=end_year,
                season_url=season_url,
                results_url=build_results_url(season_url),
            )
        )

    seasons.sort(key=lambda item: item.start_year, reverse=True)
    return seasons


def select_seasons(
    seasons: list[SeasonItem],
    season_start: int | None,
    season_end: int | None,
    season_label: str,
    last_n_seasons: int,
) -> list[SeasonItem]:
    selected = seasons

    if season_label:
        needle = season_label.strip().lower()
        selected = [item for item in selected if needle in item.text.lower()]

    if season_start is not None:
        effective_end = season_end if season_end is not None else season_start
        selected = [
            item
            for item in selected
            if season_start <= item.start_year <= effective_end
        ]

    if last_n_seasons > 0:
        selected = selected[:last_n_seasons]

    return selected


async def collect_ids_from_results_page(
    page,
    results_url: str,
    max_clicks: int,
) -> tuple[list[dict[str, str]], int]:
    await page.goto(results_url, timeout=60000)
    await page.wait_for_load_state("domcontentloaded", timeout=20000)
    await page.wait_for_timeout(1500)

    click_count = 0
    while click_count < max_clicks:
        button = page.locator('[data-testid="wcl-buttonLink"]').first
        if await button.count() == 0:
            break

        is_visible = False
        try:
            is_visible = await button.is_visible()
        except Exception:
            is_visible = False

        if not is_visible:
            break

        try:
            await button.click(timeout=3000)
            click_count += 1
            await page.wait_for_timeout(500)
        except PlaywrightTimeoutError:
            break
        except Exception:
            break

    rows = await page.evaluate(
        """
        () => {
          const output = [];
          const nodes = document.querySelectorAll('.event__match[id^="g_1_"]');
          nodes.forEach((node) => {
            const rawId = (node.id || '').replace('g_1_', '').trim();
            if (!rawId) return;
            const time = node.querySelector('.event__time')?.textContent?.trim() || '';
            output.push({ id: rawId, datetime: time });
          });
          return output;
        }
        """
    )

    return rows, click_count


async def run_collection(args: argparse.Namespace) -> dict[str, Any]:
    league_url = normalize_league_url(args.league_url)
    archive_url = build_archive_url(league_url)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=not args.show_browser)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        try:
            seasons = await collect_seasons(page, archive_url=archive_url)
            if not seasons:
                raise RuntimeError("Arsiv sayfasinda sezon bulunamadi.")

            selected = select_seasons(
                seasons=seasons,
                season_start=args.season_start,
                season_end=args.season_end,
                season_label=args.season_label,
                last_n_seasons=args.last_n_seasons,
            )

            if not selected:
                available = ", ".join([item.text for item in seasons[:10]])
                raise RuntimeError(
                    "Filtreye uygun sezon bulunamadi. "
                    f"Ornek mevcut sezonlar: {available}"
                )

            LOGGER.info("Secilen sezon sayisi: %s", len(selected))
            for item in selected:
                LOGGER.info(
                    "  - %s (%s/%s)",
                    item.text,
                    item.start_year,
                    item.end_year,
                )

            unique_ids: list[str] = []
            id_seen = set()
            datetime_map: dict[str, str] = {}
            season_stats: list[dict[str, Any]] = []

            for season in selected:
                LOGGER.info("Taranan sezon: %s", season.text)
                rows, click_count = await collect_ids_from_results_page(
                    page,
                    results_url=season.results_url,
                    max_clicks=args.max_clicks,
                )
                before = len(unique_ids)
                for row in rows:
                    match_id = str(row.get("id", "")).strip()
                    if len(match_id) != 8 or not match_id.isalnum():
                        continue
                    if match_id not in id_seen:
                        id_seen.add(match_id)
                        unique_ids.append(match_id)
                        datetime_map[match_id] = str(row.get("datetime", "")).strip()

                    if args.max_matches > 0 and len(unique_ids) >= args.max_matches:
                        break

                added = len(unique_ids) - before
                season_stats.append(
                    {
                        "season": season.text,
                        "results_url": season.results_url,
                        "clicked_show_more": click_count,
                        "row_count": len(rows),
                        "added_unique_ids": added,
                    }
                )
                LOGGER.info(
                    "  -> satir: %s | yeni id: %s | toplam id: %s",
                    len(rows),
                    added,
                    len(unique_ids),
                )

                if args.max_matches > 0 and len(unique_ids) >= args.max_matches:
                    LOGGER.info("max_matches limitine ulasildi: %s", args.max_matches)
                    break

            output = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "country": args.country,
                "league": args.league,
                "league_url": league_url,
                "archive_url": archive_url,
                "season_start_year": args.season_start,
                "season_end_year": args.season_end if args.season_end is not None else args.season_start,
                "season_label": args.season_label,
                "last_n_seasons": args.last_n_seasons,
                "total_count": len(unique_ids),
                "match_ids": unique_ids,
                "datetime_map": datetime_map,
                "season_stats": season_stats,
            }
            return output
        finally:
            await context.close()
            await browser.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect match ids from a league URL and season filter."
    )
    parser.add_argument("--country", default="", help="Metadata country name")
    parser.add_argument("--league", default="", help="Metadata league name")
    parser.add_argument(
        "--league-url",
        required=True,
        help="Example: https://www.flashscore.co.uk/football/england/premier-league/",
    )
    parser.add_argument("--season-start", type=int, default=None, help="Season start year (e.g. 2025)")
    parser.add_argument("--season-end", type=int, default=None, help="Season start year range end")
    parser.add_argument("--season-label", default="", help="Text filter, e.g. 2025/2026")
    parser.add_argument("--last-n-seasons", type=int, default=0, help="Take latest N seasons")
    parser.add_argument("--max-clicks", type=int, default=120, help="Max show-more clicks per season")
    parser.add_argument("--max-matches", type=int, default=0, help="Stop after N unique ids (0 = no limit)")
    parser.add_argument(
        "--output",
        default="collected_match_ids.json",
        help="Output JSON path",
    )
    parser.add_argument("--show-browser", action="store_true", help="Run non-headless browser")
    parser.add_argument("--log-level", default="INFO", help="DEBUG, INFO, WARNING, ERROR")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(args.log_level)

    if args.season_end is not None and args.season_start is None:
        raise ValueError("season_end kullaniliyorsa season_start de verilmelidir.")
    if args.season_start is not None and args.season_end is not None and args.season_end < args.season_start:
        raise ValueError("season_end, season_start'tan kucuk olamaz.")
    if args.last_n_seasons < 0:
        raise ValueError("last_n_seasons negatif olamaz.")

    if args.season_start is None and not args.season_label and args.last_n_seasons == 0:
        now = datetime.now(timezone.utc)
        default_start = now.year if now.month >= 7 else now.year - 1
        args.season_start = default_start
        args.season_end = default_start
        LOGGER.info("Filtre verilmedigi icin varsayilan sezon secildi: %s/%s", default_start, default_start + 1)

    result = asyncio.run(run_collection(args))
    output_path = Path(args.output)
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    LOGGER.info("Kaydedildi: %s", output_path)
    LOGGER.info("Toplam benzersiz match id: %s", result["total_count"])


if __name__ == "__main__":
    main()
