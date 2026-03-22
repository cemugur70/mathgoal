#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║   MANUAL UPDATE - Bitmiş Maçları Güncelle                              ║
║                                                                         ║
║   Kullanım:                                                             ║
║     python scripts/manual_update.py                                     ║
║     python scripts/manual_update.py --days 3         (son 3 gün)        ║
║     python scripts/manual_update.py --days 7         (son 7 gün)        ║
║     python scripts/manual_update.py --workers 12     (12 paralel)       ║
║     python scripts/manual_update.py --bookmakers bet365,Betway           ║
║                                                                         ║
║   Ne Yapar:                                                             ║
║     1. Flashscore'dan son N günün (varsayılan 2) bitmiş maçlarını çeker ║
║     2. Tüm bookmaker oranlarını (10 adet) paralel olarak tarar          ║
║     3. Veritabanına (match_all_columns + matches) yazar                  ║
║     4. Güncellenen ligleri tablo halinde gösterir                        ║
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

LOGGER = logging.getLogger("manual_update")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

# ─── Tüm bookmakerlar ───────────────────────────────────────────────────
ALL_BOOKMAKERS = [
    "bet365", "BetMGM", "Betfred", "Unibetuk", "Betway",
    "Midnite", "Ladbrokes", "7Bet", "Betfair", "BetUK"
]


class ApiClient:
    """Sunucuya veri gönderen ve senkronizasyon yapan istemci."""
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


def collect_match_ids(days: int) -> list[str]:
    """Flashscore'dan son N günün maç ID'lerini toplar."""
    from playwright.sync_api import sync_playwright

    LOGGER.info(f"Tarayıcı başlatılıyor... Son {days} günün maçları çekilecek.")
    all_ids = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www.flashscore.co.uk/football/")

        try:
            page.wait_for_selector(".sportName.soccer", timeout=15000)
        except Exception as e:
            LOGGER.error(f"Flashscore yüklenemedi: {e}")
            browser.close()
            return []

        # Önce N gün geriye git
        for _ in range(days):
            try:
                page.locator("button[aria-label='Previous day']").click(timeout=5000)
                page.wait_for_timeout(3000)
            except:
                break

        # Şimdi her günü tara ve ileri git
        for day_idx in range(days + 1):
            label = f"Gün {day_idx - days}" if day_idx < days else "Bugün"
            LOGGER.info(f"  📅 {label} maçları çekiliyor...")

            # Scroll to load all matches
            for _ in range(7):
                page.mouse.wheel(0, 6000)
                page.wait_for_timeout(800)

            matches = page.locator("div[id^='g_1_']").all()
            day_ids = [m.get_attribute("id")[4:] for m in matches if m.get_attribute("id")]
            all_ids.extend(day_ids)
            LOGGER.info(f"  ✅ {len(day_ids)} maç bulundu")

            # İleri git (son gün hariç)
            if day_idx < days:
                try:
                    page.locator("button[aria-label='Next day']").click(timeout=5000)
                    page.wait_for_timeout(3000)
                except:
                    break

        browser.close()

    # Tekil ID'ler
    unique_ids = list(dict.fromkeys(all_ids))
    LOGGER.info(f"📊 Toplam {len(unique_ids)} TEKİL maç ID'si toplandı.")
    return unique_ids


def scrape_and_upload(match_ids: list[str], bookmakers: list[str], workers: int):
    """Maç verilerini çekip sunucuya yükler."""
    client = ApiClient()
    stats = {"ok": 0, "fail": 0, "uploaded": 0}
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

    LOGGER.info(f"🚀 {total} maç, {len(bookmakers)} bookmaker, {workers} paralel işlem ile taranıyor...")
    LOGGER.info(f"   Bookmaker'lar: {', '.join(bookmakers)}")

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(scrape_one, mid): mid for mid in match_ids}
        for idx, future in enumerate(as_completed(futures), 1):
            try:
                result = future.result()
                if result and result.get("ÜLKE") and result.get("LİG"):
                    batch.append(result)
                    stats["ok"] += 1
                    updated_leagues.add(f"{result['ÜLKE']} - {result['LİG']}")
                else:
                    stats["fail"] += 1
            except Exception:
                stats["fail"] += 1

            # Her 50 kayıtta batch gönder
            if len(batch) >= 50:
                for bm in bookmakers:
                    try:
                        resp = client.send_batch(batch, bm)
                        stats["uploaded"] += resp.get("upserted", 0)
                    except Exception as e:
                        LOGGER.error(f"Batch hata ({bm}): {e}")
                batch = []

            # İlerleme göster
            if idx % 50 == 0 or idx == total:
                elapsed = time.time() - start_time
                pct = idx * 100 / total
                eta = (elapsed / idx) * (total - idx) if idx > 0 else 0
                LOGGER.info(
                    f"  ⏳ %{pct:.1f} | {idx}/{total} | "
                    f"✅ {stats['ok']} | ❌ {stats['fail']} | "
                    f"Süre: {elapsed:.0f}s | Kalan: ~{eta:.0f}s"
                )

    # Son kalan batch'i gönder
    if batch:
        for bm in bookmakers:
            try:
                resp = client.send_batch(batch, bm)
                stats["uploaded"] += resp.get("upserted", 0)
            except Exception as e:
                LOGGER.error(f"Son batch hata ({bm}): {e}")

    return stats, updated_leagues


def run_sync(client: ApiClient):
    """Veritabanı senkronizasyonu (match_all_columns -> matches)."""
    LOGGER.info("🔄 Veritabanı senkronizasyonu başlıyor...")
    try:
        result = client.sync()
        LOGGER.info(f"✅ Senkronizasyon tamamlandı: {result}")
    except Exception as e:
        LOGGER.error(f"❌ Senkronizasyon hatası: {e}")


def print_summary(stats, updated_leagues, elapsed):
    """Sonuç tablosu yazdır."""
    print("\n" + "=" * 70)
    print("📊 MANUAL UPDATE - SONUÇ RAPORU")
    print("=" * 70)
    print(f"  ✅ Başarılı       : {stats['ok']}")
    print(f"  ❌ Hatalı         : {stats['fail']}")
    print(f"  📤 DB'ye Yazılan  : {stats['uploaded']}")
    print(f"  ⏱️  Toplam Süre    : {elapsed:.1f} saniye ({elapsed/60:.1f} dakika)")
    print("=" * 70)
    print(f"\n🏆 GÜNCELLENEN LİGLER ({len(updated_leagues)} adet):")
    print("-" * 70)
    for i, league in enumerate(sorted(updated_leagues), 1):
        print(f"  {i:03d} | {league}")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Manuel Güncelleme: Bitmiş maçları tüm bookmaker'larla güncelle"
    )
    parser.add_argument("--days", type=int, default=2,
                        help="Kaç günlük geçmiş maç çekilsin (varsayılan: 2)")
    parser.add_argument("--workers", type=int, default=8,
                        help="Paralel işlem sayısı (varsayılan: 8)")
    parser.add_argument("--bookmakers", type=str, default="all",
                        help="Bookmaker listesi, virgülle ayrılmış veya 'all' (varsayılan: all)")
    parser.add_argument("--no-sync", action="store_true",
                        help="Senkronizasyonu atla")
    args = parser.parse_args()

    # Bookmaker seçimi
    if args.bookmakers.lower() == "all":
        bookmakers = ALL_BOOKMAKERS
    else:
        bookmakers = [b.strip() for b in args.bookmakers.split(",") if b.strip()]

    print("\n" + "=" * 70)
    print("🔧 MANUAL UPDATE - BİTMİŞ MAÇLARI GÜNCELLE")
    print("=" * 70)
    print(f"  📅 Gün Aralığı    : Son {args.days} gün + bugün")
    print(f"  🎰 Bookmaker      : {len(bookmakers)} adet ({', '.join(bookmakers[:3])}...)")
    print(f"  ⚡ Paralel İşlem  : {args.workers}")
    print(f"  🔄 Senkronizasyon : {'Hayır' if args.no_sync else 'Evet'}")
    print("=" * 70 + "\n")

    start_time = time.time()

    # 1. Maç ID'lerini topla
    match_ids = collect_match_ids(args.days)
    if not match_ids:
        LOGGER.error("Hiç maç bulunamadı! İşlem iptal edildi.")
        return

    # 2. Verileri çek ve yükle
    stats, updated_leagues = scrape_and_upload(match_ids, bookmakers, args.workers)

    # 3. Senkronizasyon
    if not args.no_sync:
        client = ApiClient()
        run_sync(client)

    elapsed = time.time() - start_time
    print_summary(stats, updated_leagues, elapsed)


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
