
import asyncio
import json
import subprocess
import sys
import httpx
from playwright.async_api import async_playwright
from utils import get_logger, get_resource_path, get_user_data_path
from common_scraper import scrape_summary_page, scrape_summary_http, fetch_all_odds_data, fetch_odds_single_call, block_agressive
from excel_writer import write_to_excel, prepare_excel_file, sort_excel_file
from data_processor import merge_data
from progress_tracker import (init_progress, increment_progress, update_progress, 
                              finish_progress, add_failed_match, remove_failed_match,
                              get_failed_matches, get_failed_count)
import re
from datetime import datetime

logger = get_logger(__name__)

# Global Excel dosyası ismi (işlem başlangıcında belirlenir)
EXCEL_FILENAME = None

async def get_all_match_urls(page, leagues, start_date, end_date):
    """Gezinerek tüm maç urllerini toplar - DUPLICATE DETECTION EKLENDİ."""
    
    # URL'leri oluştur
    league_urls = []
    for league in leagues:
        parts = league.split(' - ')
        if len(parts) >= 2:
            country = parts[0].lower().replace(' ', '-')
            league_name = parts[1].lower().replace(' ', '-')
            url = f"https://www.flashscore.co.uk/football/{country}/{league_name}/archive/"
            league_urls.append(url)
    
    logger.info(f"📋 {len(league_urls)} lig arşiv URL'si bulundu")
    for url in league_urls:
        logger.info(f"  → {url}")

    # Sezon URL'lerini topla (DUPLICATE KONTROLÜ)
    season_links = set()  # SET kullanarak duplicate önle
    base_url = "https://www.flashscore.co.uk"
    
    for league_url in league_urls:
        try:
            await page.goto(league_url, timeout=45000)
            await page.wait_for_selector("div.archiveLatte__row", timeout=15000)
            seasons = await page.locator("div.archiveLatte__row").all()
            
            for season in seasons:
                try:
                    season_link_element = season.locator("div.archiveLatte__season > a.archiveLatte__text")
                    if await season_link_element.count() > 0:
                        season_text_raw = await season_link_element.text_content()
                        # Sezon formatı: "Superliga 2024/2025" veya "2024/25"
                        # BAŞLANGIÇ yılını al (2024/2025 → 2024)
                        season_text = season_text_raw.strip()
                        
                        # "/" ile ayrılmış yılları bul
                        if '/' in season_text:
                            parts = season_text.split('/')
                            # Başlangıç yılını bul (ilk 4 haneli sayı)
                            start_year_match = re.search(r'(\d{4})/', season_text)
                            if start_year_match:
                                year = int(start_year_match.group(1))
                            else:
                                continue
                        else:
                            continue

                        # Kullanıcının seçtiği yıl aralığına uygun mu?
                        # Örnek: baslangic=2024, bitis=2025 için sadece 2024/2025 sezonu
                        if start_date <= year <= end_date:
                            href = await season_link_element.get_attribute("href")
                            full_url = f"{base_url}{href}results/"
                            
                            # DUPLICATE KONTROLÜ
                            if full_url not in season_links:
                                season_links.add(full_url)
                                logger.info(f"  ✅ {season_text} (yıl: {year})")
                            else:
                                logger.warning(f"  ⚠️ DUPLICATE atlandı: {full_url}")
                                
                except Exception as e:
                    logger.warning(f"Sezon satırı parse edilemedi: {e}")
                    
        except Exception as e:
            logger.error(f"Lig arşivi işlenemedi {league_url}: {e}")

    season_links = list(season_links)
    logger.info(f"📅 {len(season_links)} sezon URL'si bulundu (duplicate filtrelendi)")

    # Maç ID'lerini topla - DICT: {match_id: datetime_str}
    match_ids = {}  # DICT: ID -> datetime mapping
    
    for season_link in season_links:
        try:
            logger.info(f"🔍 Maç ID'leri taranıyor: {season_link}")
            await page.goto(season_link, timeout=45000)
            await page.wait_for_load_state('domcontentloaded', timeout=15000)

            # Show more butonuna tıkla
            click_count = 0
            max_clicks = 50  # Azaltıldı
            while click_count < max_clicks:
                try:
                    show_more_button = page.locator('[data-testid="wcl-buttonLink"]')
                    await show_more_button.wait_for(state="visible", timeout=3000)
                    click_count += 1
                    await show_more_button.click()
                    await page.wait_for_load_state("networkidle", timeout=2000)
                except Exception:
                    break
            
            if click_count > 0:
                logger.info(f"  ↻ {click_count} kez 'Show more' tıklandı")
            
            # HTML'den ID'leri VE SAAT bilgisini çek (event__time selector)
            match_data_list = await page.evaluate("""
                () => {
                    const matches = document.querySelectorAll('.event__match');
                    const data = [];
                    matches.forEach(match => {
                        const id = match.id?.replace('g_1_', '');
                        const timeEl = match.querySelector('.event__time');
                        const time = timeEl ? timeEl.innerText.trim() : '';
                        if (id && id.length === 8) {
                            data.push({id: id, datetime: time});
                        }
                    });
                    return data;
                }
            """)
            
            # Mevcut setimize yeni ID'leri ekle
            before_count = len(match_ids)
            for item in match_data_list:
                match_id = item['id']
                if match_id not in match_ids:
                    match_ids[match_id] = item['datetime']  # ID -> datetime mapping
            new_count = len(match_ids) - before_count
            
            logger.info(f"  📊 Bu sezon: {len(match_data_list)} maç, Yeni: {new_count}, Toplam: {len(match_ids)}")

        except Exception as e:
            logger.error(f"Maç URL'leri taranamadı {season_link}: {e}")
            
    logger.info(f"✅ TOPLAM {len(match_ids)} BENZERSİZ MAÇ BULUNDU")
    return match_ids  # Returns dict: {match_id: datetime_str}


async def scrape_worker_http(http_client, queue, worker_id, bookmakers, bet_types, excel_filename, retry_queue, success_count, failed_count, semaphore):
    """
    PURE HTTP worker - NO BROWSER! Fast httpx-based scraping.
    """
    while True:
        try:
            match_id = queue.get_nowait()
        except asyncio.QueueEmpty:
            break
        
        try:
            start_time = datetime.now()
            remaining = queue.qsize()
            
            # Summary çekimi (HTTP)
            summary_data = await scrape_summary_http(match_id, http_client)
            
            if not summary_data:
                failed_count.append(match_id)
                await retry_queue.put(match_id)
                queue.task_done()
                logger.warning(f"❌ {match_id} - Summary başarısız, Kalan: {remaining}")
                continue
            
            # Odds - TEK API çağrısı
            odds_data = await fetch_odds_single_call(http_client, match_id, bookmakers, bet_types)
            
            # Excel'e yaz
            match_id_dict = {"ide": match_id}
            common_data = merge_data(match_id_dict, summary_data)
            write_to_excel(excel_filename, common_data, odds_data)
            
            # Success
            remove_failed_match(match_id)
            increment_progress(success=True)
            success_count.append(match_id)
            
            elapsed = (datetime.now() - start_time).total_seconds()
            done = len(success_count)
            
            # HER maçı logla
            logger.info(f"✅ [{done}] {match_id} ({elapsed:.1f}s) Kalan: {remaining}")

        except Exception as e:
            failed_count.append(match_id)
            increment_progress(success=False, match_id=match_id, error_msg=str(e))
            await retry_queue.put(match_id)
            logger.warning(f"❌ {match_id}: {type(e).__name__}")
        finally:
            queue.task_done()


async def scrape_worker_with_pool(page_pool, queue, worker_id, bookmakers, bet_types, excel_filename, retry_queue, success_count, failed_count):
    """
    Page Pool based worker. Borrows a page from pool, scrapes, returns page.
    This is MUCH faster than creating/closing pages per match.
    """
    while True:
        try:
            match_id = queue.get_nowait()
        except asyncio.QueueEmpty:
            break
        
        logger.info(f"[Scraper {worker_id}] Processing match {match_id}")
        
        page = None
        try:
            start_time = datetime.now()
            
            # Borrow page from pool (blocks if all pages busy)
            page = await page_pool.get()
            sem_acquire_time = datetime.now()
            
            # Navigate to match (page already has route set)
            summary_data = await scrape_summary_page(page, match_id)
            summary_end_time = datetime.now()
            summary_duration = (summary_end_time - sem_acquire_time).total_seconds()
            
            # Return page to pool BEFORE API calls (frees it for others)
            await page_pool.put(page)
            page = None
            
            if not summary_data:
                logger.warning(f"Skipping match {match_id} due to missing summary. (Summary took {summary_duration:.2f}s)")
                add_failed_match(match_id, "MISSING_SUMMARY")
                failed_count.append(match_id)
                await retry_queue.put(match_id)
                queue.task_done()
                continue
            
            # API calls are HTTP-only (no browser), very fast
            odds_data = await fetch_all_odds_data(match_id, bookmakers, bet_types)
            odds_end_time = datetime.now()
            odds_duration = (odds_end_time - summary_end_time).total_seconds()

            total_duration = (odds_end_time - start_time).total_seconds()
            
            match_id_dict = {"ide": match_id}
            common_data = merge_data(match_id_dict, summary_data)
            
            write_to_excel(excel_filename, common_data, odds_data)
            
            # Success handling
            remove_failed_match(match_id)
            increment_progress(success=True)
            success_count.append(match_id)
            logger.info(f"[Scraper {worker_id}] DONE {match_id} in {total_duration:.2f}s (Sum: {summary_duration:.2f}s, Odds: {odds_duration:.2f}s)")

        except Exception as e:
            logger.error(f"[Scraper {worker_id}] Error processing match {match_id}: {e}")
            add_failed_match(match_id, str(e))
            failed_count.append(match_id)
            increment_progress(success=False, match_id=match_id, error_msg=str(e))
            await retry_queue.put(match_id)
        finally:
            # If error occurred and page wasn't returned, return it now
            if page:
                await page_pool.put(page)
            queue.task_done()


async def scrape_worker(context, queue, worker_id, bookmakers, bet_types, excel_filename, retry_queue, success_count, failed_count, semaphore):
    # NOT: Page artik loop icinde, semaphore alinca olusturulacak
    
    while True:
        try:
            match_id = queue.get_nowait()
        except asyncio.QueueEmpty:
            break
        
        logger.info(f"[Scraper {worker_id}] Processing match {match_id}")
        
        page = None
        try:
            start_time = datetime.now()
            
            # Semaphore ile eszamanli islemleri sinirla (WEB BROWSER VISUALS BURADA SINIRLANIR)
            async with semaphore:
                sem_acquire_time = datetime.now()
                # logger.debug(f"[Scraper {worker_id}] Semaphore acquired after {(sem_acquire_time - start_time).total_seconds():.2f}s")
                
                # PAGE'i SADECE SEMAPHORE ICINDE OLUSTUR (MEMORY SAVING)
                page = await context.new_page()
                # Kaynak engelleme aktiflestir
                await page.route("**/*", block_agressive)
                
                summary_data = await scrape_summary_page(page, match_id)
                summary_end_time = datetime.now()
                summary_duration = (summary_end_time - sem_acquire_time).total_seconds()
                
                # Close page immediately after usage inside semaphore to free memory
                await page.close()
                page = None
                
                if not summary_data:
                    logger.warning(f"Skipping match {match_id} due to missing summary. (Summary took {summary_duration:.2f}s)")
                    add_failed_match(match_id, "MISSING_SUMMARY")
                    failed_count.append(match_id)
                    await retry_queue.put(match_id)
                    continue
                
                # API calls are lighter, done after page is closed
                odds_data = await fetch_all_odds_data(match_id, bookmakers, bet_types)
                odds_end_time = datetime.now()
                odds_duration = (odds_end_time - summary_end_time).total_seconds()

            total_duration = (odds_end_time - start_time).total_seconds()
            
            match_id_dict = {"ide": match_id}
            common_data = merge_data(match_id_dict, summary_data)
            
            write_to_excel(excel_filename, common_data, odds_data)
            
            # Success handling
            remove_failed_match(match_id)
            increment_progress(success=True)
            success_count.append(match_id)
            logger.info(f"[Scraper {worker_id}] DONE {match_id} in {total_duration:.2f}s (Sum: {summary_duration:.2f}s, Odds: {odds_duration:.2f}s)")

        except Exception as e:
            logger.error(f"[Scraper {worker_id}] Error processing match {match_id}: {e}")
            add_failed_match(match_id, str(e))
            failed_count.append(match_id)
            increment_progress(success=False, match_id=match_id, error_msg=str(e))
            await retry_queue.put(match_id)
        finally:
            if page: # Eger hata aldiysa ve sayfa kapanmadiysa kapat
                try:
                    await page.close()
                except:
                    pass
            queue.task_done()


async def main():
    # Config dosyasını yükle
    with open(get_user_data_path("config.json"), "r", encoding="utf-8-sig") as f:
        config = json.load(f)
    
    # Bookmaker mapping
    from config import BOOKMAKER_MAPPING

    leagues = config["ligler"]
    start_date = int(config["baslangic"]) if config["baslangic"].isdigit() else 2024
    end_date = int(config["bitis"]) if config["bitis"].isdigit() else 2025
    bookmakers = config["bookmakers"]
    bet_types = config.get("bet_types", {})
    num_workers = config.get("num_workers", 16)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        
        # --- PHASE 1: Collect IDs ---
        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        logger.info("🔍 Maç ID'leri toplanıyor...")
        url_collector_page = await context.new_page()
        match_ids = await get_all_match_urls(url_collector_page, leagues, start_date, end_date)
        await url_collector_page.close()
        await context.close()

        if not match_ids:
            logger.info("❌ Maç bulunamadı. Çıkış yapılıyor.")
            await browser.close()
            return
        
        # match_ids is now a dict: {match_id: datetime_str}
        # Extract list of IDs and keep datetime mapping
        match_id_list = list(match_ids.keys())
        datetime_map = match_ids  # {match_id: "15.12. 20:00"}
        
        # Log first 10 match IDs for verification
        logger.info(f"📋 İlk 10 maç: {[(mid, datetime_map.get(mid, '')) for mid in match_id_list[:10]]}")
        logger.info(f"⚡ Phase 2: {len(match_id_list)} maç işlenecek")
        
        # Excel Setup
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        excel_filename = get_user_data_path(f"yeni-sonuc-Season-{timestamp}.xlsx")
        logger.info(f"📁 Excel: {excel_filename}")
        prepare_excel_file(excel_filename)
        init_progress(len(match_id_list), "Season Scraping")
        
        # --- PHASE 2: FAST THREADED SCRAPING ---
        await browser.close()
        
        # Use fast threaded scraper instead of slow asyncio
        from fast_scraper import run_threaded_scraper
        
        logger.info(f"⚡ {len(match_id_list)} maç işlenecek (Threading mode)")
        
        # Run threaded scraper (blocking call - it handles threading internally)
        import asyncio
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, 
            run_threaded_scraper,
            match_id_list, bookmakers, bet_types, excel_filename, logger, 20, datetime_map
        )
        failed_matches, all_results = result  # Unpack tuple
        
        # Retry failed matches once
        if failed_matches:
            logger.info(f"🔄 {len(failed_matches)} başarısız maç yeniden deneniyor...")
            retry_result = await loop.run_in_executor(
                None,
                run_threaded_scraper,
                failed_matches, bookmakers, bet_types, excel_filename, logger, 10, datetime_map
            )
            failed_matches, retry_results = retry_result
            all_results.extend(retry_results)  # Add retry results
        
        # Excel sırala
        sort_excel_file(excel_filename)
        
        # Sonuçları JSON olarak kaydet (analiz için)
        results_file = get_user_data_path("last_results.json")
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        
        # SONUC RAPORU
        total = len(match_ids)
        success = len(all_results)
        
        finish_progress(status="completed")
        
        logger.info("=" * 50)
        logger.info("SONUC RAPORU")
        logger.info(f"Toplam Mac: {total}")
        logger.info(f"Basarili: {success} ({100*success//max(total,1)}%)")
        logger.info(f"Basarisiz: {len(failed_matches)}")
        logger.info(f"📊 Analiz için: {results_file}")
        logger.info("=" * 50)
        
        print(f"\n{'='*50}")
        print(f"✅ ISLEM TAMAMLANDI!")
        print(f"Basarili: {success}/{total}")
        print(f"Dosya: {excel_filename}")
        print(f"{'='*50}")

if __name__ == "__main__":
    asyncio.run(main())