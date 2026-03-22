#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║   MANUAL FİKSTÜR - Gelecek Maçları Güncelle (+7 gün)                   ║
║                                                                         ║
║   Kullanım:                                                             ║
║     python scripts/manual_fixture.py                                    ║
║     python scripts/manual_fixture.py --days 3        (sadece +3 gün)    ║
║     python scripts/manual_fixture.py --workers 12    (12 paralel)       ║
║                                                                         ║
║   Ne Yapar:                                                             ║
║     1. Flashscore'dan bugün + gelecek N günün maçlarını çeker           ║
║     2. Tüm bookmaker oranlarını (10 adet) paralel olarak tarar          ║
║     3. Veritabanına (match_all_columns + matches) yazar                  ║
║     4. Güncellenen tarihleri ve lig sayılarını tablo halinde gösterir    ║
║     5. Sonunda otomatik senkronizasyon çalıştırır                       ║
╚══════════════════════════════════════════════════════════════════════════╝
"""
import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fast_scraper import scrape_match_data
import requests

LOGGER = logging.getLogger("manual_fixture")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

ALL_BOOKMAKERS = [
    "bet365", "BetMGM", "Betfred", "Unibetuk", "Betway",
    "Midnite", "Ladbrokes", "7Bet", "Betfair", "BetUK"
]


class ApiClient:
    def __init__(self):
        self.url = os.getenv("MATHGOAL_API_URL", "https://mathgoal.site")
        self.key = os.getenv("INGEST_API_KEY", "")
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-Api-Key": self.key
        })

    def send_batch(self, rows, bookmaker):
        r = self.session.post(
            f"{self.url}/api/ingest/batch",
            json={"rows": rows, "bookmaker": bookmaker},
            timeout=120
        )
        r.raise_for_status()
        return r.json()

    def sync(self):
        r = self.session.post(
            f"{self.url}/api/ingest/sync-matches",
            timeout=1200
        )
        r.raise_for_status()
        return r.json()


def collect_fixture_ids(days: int) -> dict[str, list[str]]:
    """Flashscore'dan bugün + ileriki N günün maç ID'lerini toplar."""
    from playwright.sync_api import sync_playwright

    LOGGER.info(f"Tarayıcı başlatılıyor... Bugün + {days} günlük fikstür çekilecek.")
    day_data = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www.flashscore.co.uk/football/")

        try:
            page.wait_for_selector(".sportName.soccer", timeout=15000)
        except Exception as e:
            LOGGER.error(f"Flashscore yüklenemedi: {e}")
            browser.close()
            return {}

        for day_idx in range(days + 1):
            # Takvim tarihini oku
            try:
                date_text = page.locator("[data-testid='wcl-dayPickerButton']").inner_text(timeout=3000)
            except:
                date_text = f"Gün +{day_idx}"

            if day_idx == 0:
                label = f"Bugün ({date_text})"
            elif day_idx == 1:
                label = f"Yarın ({date_text})"
            else:
                label = f"+{day_idx} Gün ({date_text})"

            LOGGER.info(f"  📅 {label} maçları çekiliyor...")

            # Scroll to load all matches
            for _ in range(7):
                page.mouse.wheel(0, 6000)
                page.wait_for_timeout(800)

            matches = page.locator("div[id^='g_1_']").all()
            day_ids = [m.get_attribute("id")[4:] for m in matches if m.get_attribute("id")]
            day_data[label] = day_ids
            LOGGER.info(f"  ✅ {len(day_ids)} maç bulundu")

            # İleri git (son gün hariç)
            if day_idx < days:
                try:
                    page.locator("button[aria-label='Next day']").click(timeout=5000)
                    page.wait_for_timeout(3000)
                except Exception as e:
                    LOGGER.warning(f"İleri gidemedi: {e}")
                    break

        browser.close()

    return day_data


def scrape_and_upload(match_ids: list[str], bookmakers: list[str], workers: int):
    """Maç verilerini çekip sunucuya yükler."""
    client = ApiClient()
    stats = {"ok": 0, "fail": 0, "uploaded": 0, "with_odds": 0, "no_odds": 0}
    updated_leagues = set()
    batch = []
    start_time = time.time()
    total = len(match_ids)

    def scrape_one(mid):
        try:
            result = scrape_match_data(mid, bookmakers, {}, LOGGER)
            if result:
                result["ide"] = mid
                return result
        except Exception:
            pass
        return None

    LOGGER.info(f"🚀 {total} fikstür maçı, {len(bookmakers)} bookmaker, {workers} paralel işlem...")

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(scrape_one, mid): mid for mid in match_ids}
        for idx, future in enumerate(as_completed(futures), 1):
            try:
                result = future.result()
                if result and result.get("EV SAHİBİ"):
                    batch.append(result)
                    stats["ok"] += 1

                    if result.get("ÜLKE") and result.get("LİG"):
                        updated_leagues.add(f"{result['ÜLKE']} - {result['LİG']}")

                    # Oran kontrolü
                    has_odds = any(
                        k for k in result.keys()
                        if ("_home" in k.lower() or "_draw" in k.lower() or "_away" in k.lower())
                        and result[k] not in (None, "", "-")
                    )
                    if has_odds:
                        stats["with_odds"] += 1
                    else:
                        stats["no_odds"] += 1
                else:
                    stats["fail"] += 1
            except Exception:
                stats["fail"] += 1

            if len(batch) >= 50:
                for bm in bookmakers:
                    try:
                        resp = client.send_batch(batch, bm)
                        stats["uploaded"] += resp.get("upserted", 0)
                    except Exception as e:
                        LOGGER.error(f"Batch hata ({bm}): {e}")
                batch = []

            if idx % 50 == 0 or idx == total:
                elapsed = time.time() - start_time
                pct = idx * 100 / total
                eta = (elapsed / idx) * (total - idx) if idx > 0 else 0
                LOGGER.info(
                    f"  ⏳ %{pct:.1f} | {idx}/{total} | "
                    f"✅ {stats['ok']} | 🎰 Oranlı: {stats['with_odds']} | "
                    f"Kalan: ~{eta:.0f}s"
                )

    if batch:
        for bm in bookmakers:
            try:
                resp = client.send_batch(batch, bm)
                stats["uploaded"] += resp.get("upserted", 0)
            except Exception as e:
                LOGGER.error(f"Son batch hata ({bm}): {e}")

    return stats, updated_leagues


def print_fixture_summary(day_data, stats, updated_leagues, elapsed):
    """Sonuç tablosu yazdır."""
    print("\n" + "=" * 70)
    print("📆 MANUAL FİKSTÜR - SONUÇ RAPORU")
    print("=" * 70)

    # Gün bazlı tablo
    print("\n📅 GÜN BAZLI MAÇ SAYILARI:")
    print("-" * 50)
    total_ids = 0
    for label, ids in day_data.items():
        print(f"  {label:35s} : {len(ids):4d} maç")
        total_ids += len(ids)
    print("-" * 50)
    print(f"  {'TOPLAM (tekil öncesi)':35s} : {total_ids:4d}")

    print(f"\n📊 SCRAPING SONUÇLARI:")
    print("-" * 50)
    print(f"  ✅ Başarılı          : {stats['ok']}")
    print(f"  🎰 Oranları Çekilen  : {stats['with_odds']}")
    print(f"  ⚠️  Oransız           : {stats['no_odds']}")
    print(f"  ❌ Hatalı            : {stats['fail']}")
    print(f"  📤 DB'ye Yazılan     : {stats['uploaded']}")
    print(f"  ⏱️  Toplam Süre       : {elapsed:.1f}s ({elapsed/60:.1f} dk)")

    print(f"\n🏆 GÜNCELLENEN LİGLER ({len(updated_leagues)} adet):")
    print("-" * 70)
    for i, league in enumerate(sorted(updated_leagues), 1):
        print(f"  {i:03d} | {league}")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Manuel Fikstür: Bugün + gelecek N günün maçlarını ve oranlarını çek"
    )
    parser.add_argument("--days", type=int, default=7,
                        help="Kaç gün ileriye bakılsın (varsayılan: 7)")
    parser.add_argument("--workers", type=int, default=8,
                        help="Paralel işlem sayısı (varsayılan: 8)")
    parser.add_argument("--bookmakers", type=str, default="all",
                        help="Bookmaker listesi veya 'all' (varsayılan: all)")
    parser.add_argument("--no-sync", action="store_true",
                        help="Senkronizasyonu atla")
    args = parser.parse_args()

    if args.bookmakers.lower() == "all":
        bookmakers = ALL_BOOKMAKERS
    else:
        bookmakers = [b.strip() for b in args.bookmakers.split(",") if b.strip()]

    print("\n" + "=" * 70)
    print("📆 MANUAL FİKSTÜR - GELECEK MAÇLARI GÜNCELLE")
    print("=" * 70)
    print(f"  📅 Fikstür Aralığı : Bugün + {args.days} gün")
    print(f"  🎰 Bookmaker       : {len(bookmakers)} adet")
    print(f"  ⚡ Paralel İşlem   : {args.workers}")
    print("=" * 70 + "\n")

    start_time = time.time()

    # 1. Fikstür ID'lerini topla
    day_data = collect_fixture_ids(args.days)
    if not day_data:
        LOGGER.error("Hiç maç bulunamadı! İşlem iptal edildi.")
        return

    # Tüm ID'leri birleştir ve tekilleri al
    all_ids = []
    for ids in day_data.values():
        all_ids.extend(ids)
    unique_ids = list(dict.fromkeys(all_ids))
    LOGGER.info(f"📊 Toplam {len(unique_ids)} TEKİL fikstür maçı taranacak.")

    # 2. Verileri çek ve yükle
    stats, updated_leagues = scrape_and_upload(unique_ids, bookmakers, args.workers)

    # 3. Senkronizasyon
    if not args.no_sync:
        client = ApiClient()
        LOGGER.info("🔄 Veritabanı senkronizasyonu başlıyor...")
        try:
            result = client.sync()
            LOGGER.info(f"✅ Senkronizasyon tamamlandı: {result}")
        except Exception as e:
            LOGGER.error(f"❌ Senkronizasyon hatası: {e}")

    elapsed = time.time() - start_time
    print_fixture_summary(day_data, stats, updated_leagues, elapsed)


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
