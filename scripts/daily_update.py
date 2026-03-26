#!/usr/bin/env python3
import json, logging, os, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fast_scraper import scrape_match_data
import requests

LOGGER = logging.getLogger("daily_update")
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

class ApiClient:
    def __init__(self):
        self.url = os.getenv("MATHGOAL_API_URL", "https://mathgoal.site")
        self.key = os.getenv("INGEST_API_KEY", "")
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json", "X-Api-Key": self.key})
    def send_batch(self, rows, bookmaker):
        r = self.session.post(f"{self.url}/api/ingest/batch", json={"rows": rows, "bookmaker": bookmaker}, timeout=120)
        r.raise_for_status()
        return r.json()
    def sync(self):
        r = self.session.post(f"{self.url}/api/ingest/sync-matches", timeout=1200)
        r.raise_for_status()
        return r.json()

def get_daily_ids():
    from playwright.sync_api import sync_playwright
    LOGGER.info("Tarayici baslatiliyor...")
    day_matches = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www.flashscore.co.uk/football/")
        try:
            page.wait_for_selector(".sportName.soccer", timeout=15000)
            
            # Go back to Yesterday first!
            try:
                page.locator("button[aria-label='Previous day']").click(timeout=5000)
                page.wait_for_timeout(3000)
            except: pass
            
        except Exception as e:
            LOGGER.error(f"Flashscore ana sayfa yuklenemedi: {e}")
            return []

        for offset in range(-1, 8):
            if offset == -1: label = "Dun"
            elif offset == 0: label = "Bugun"
            elif offset == 1: label = "Yarin"
            else: label = f"+{offset} Gun"
            
            LOGGER.info(f"{label} (d={offset}) maclari cekiliyor...")
            
            # scroll down multiple times to lazy load
            for _ in range(7):
                page.mouse.wheel(0, 6000)
                page.wait_for_timeout(800)
            
            matches = page.locator("div[id^='g_1_']").all()
            ids = [m.get_attribute("id")[4:] for m in matches if m.get_attribute("id")]
            day_matches[label] = ids
            LOGGER.info(f"  -> {label} icin {len(ids)} mac bulundu")
            
            # Now click tomorrow to prepare for the next iteration
            if offset < 7:
                try:
                    page.locator("button[aria-label='Next day']").click(timeout=5000)
                    # wait for dom update
                    page.wait_for_timeout(3000)
                except Exception as e:
                    LOGGER.warning(f"Failed to click tomorrow: {e}")
        browser.close()
    
    # Merge and deduplicate
    all_ids = []
    for ids in day_matches.values():
        all_ids.extend(ids)
    return list(dict.fromkeys(all_ids))

def main():
    LOGGER.info("GÜNLÜK OTOMATİK GÜNCELLEME BAŞLADI")
    all_ids = get_daily_ids()
    if not all_ids:
        LOGGER.info("Hic mac bulunamadi, iptal ediliyor.")
        return
        
    LOGGER.info(f"Toplam {len(all_ids)} TEKİL maç ID'si taranacak...")
    
    BM_LIST = ["bet365", "BetMGM", "Betfred", "Unibetuk", "Betway", "Midnite", "Ladbrokes", "7Bet", "Betfair", "BetUK"]
    
    client = ApiClient()
    ok = fail = 0
    batch = []
    grand_total = 0
    updated_leagues = set()
    
    def scrape_one(mid):
        try:
            # We scrape ALL bookmakers at once perfectly dynamically
            # By passing an empty dict for bet_types, it will fallback to pulling everything.
            result = scrape_match_data(mid, BM_LIST, {}, LOGGER)
            if result:
                result["ide"] = mid
                return result
        except Exception:
            pass
        return None
        
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(scrape_one, mid): mid for mid in all_ids}
        for idx, future in enumerate(as_completed(futures), 1):
            try:
                result = future.result()
                if result and result.get("ÜLKE") and result.get("LİG"):
                    batch.append(result)
                    ok += 1
                    updated_leagues.add(f"{result['ÜLKE']} - {result['LİG']}")
                else:
                    fail += 1
            except Exception:
                fail += 1
                
            if len(batch) >= 50:
                for bm in BM_LIST:
                    try:
                        resp = client.send_batch(batch, bm)
                        grand_total += resp.get("upserted", 0)
                    except Exception as e:
                        LOGGER.error(f"Batch hata ({bm}): {e}")
                batch = []
                
            if idx % 100 == 0:
                LOGGER.info(f"Yuzde: %{idx*100/len(all_ids):.1f} | Basarili: {ok} | Hatali: {fail}")
                
    if batch:
        try:
            resp = client.send_batch(batch, "bet365")
            grand_total += resp.get("upserted", 0)
        except Exception as e:
            LOGGER.error(f"Son batch hata: {e}")
            
    LOGGER.info(f"Scraping tamamlandi. Basarili: {ok}, Kayit edildi: {grand_total}")
    LOGGER.info("Veritabani Senkronizasyonu basliyor (matches db guncellemesi)...")
    try:
        LOGGER.info(f"Sync Donus: {client.sync()}")
    except Exception as e:
        LOGGER.error(f"Sync hata: {e}")
        
    # Tablo olarak ligleri goster:
    LOGGER.info("=" * 60)
    LOGGER.info("GÜNCELLENEN LİGLER TABLOSU")
    LOGGER.info("=" * 60)
    for index, league in enumerate(sorted(list(updated_leagues)), 1):
        LOGGER.info(f"{index:03d} | {league}")
    LOGGER.info("=" * 60)
    LOGGER.info("Arka plan guncellemeleri tamamlandi.")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
