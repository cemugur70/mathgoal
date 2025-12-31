"""
OLD MAIN - Eski Maçlar (Geçmiş Tarihli)
Uses fast_scraper for HTTP-based scraping (same as season_main.py)
"""
import asyncio
import json
import re
from datetime import datetime, timedelta
from playwright.async_api import async_playwright

from utils import get_logger, get_user_data_path
from excel_writer import prepare_excel_file, sort_excel_file
from progress_tracker import init_progress, finish_progress

logger = get_logger(__name__)


async def collect_match_ids_by_date(page, leagues, start_date, end_date):
    """
    Collect match IDs from Flashscore main page by navigating through dates.
    Uses date picker arrows to go back/forward in time.
    """
    all_match_ids = {}  # {match_id: datetime_str}
    
    # Build league filters
    league_filters = set()
    for league in leagues:
        parts = league.split(' - ')
        if len(parts) >= 2:
            # Format: "COUNTRY: League Name"
            league_filters.add(f"{parts[0]}: {parts[1]}")
    
    logger.info(f"📋 {len(league_filters)} lig filtresi oluşturuldu")
    
    # Navigate to main page
    await page.goto("https://www.flashscore.co.uk/", timeout=60000, wait_until="domcontentloaded")
    
    # Accept cookies if present
    try:
        consent_button = page.locator("#onetrust-accept-btn-handler")
        await consent_button.click(timeout=5000)
        await page.wait_for_timeout(1000)
    except:
        pass
    
    # Iterate through dates
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime("%d.%m.%Y")
        logger.info(f"🔍 Tarih taranıyor: {date_str}")
        
        try:
            # Calculate days from today
            today = datetime.now().date()
            target_date = current_date.date()
            delta_days = (target_date - today).days
            
            if delta_days != 0:
                # Navigate to target date using arrows
                if delta_days < 0:
                    button_selector = '[data-day-picker-arrow="prev"]'
                    clicks = abs(delta_days)
                else:
                    button_selector = '[data-day-picker-arrow="next"]'
                    clicks = delta_days
                
                arrow_button = page.locator(button_selector)
                for _ in range(clicks):
                    await arrow_button.click()
                    await page.wait_for_timeout(300)
            
            # Wait for matches to load
            await page.wait_for_selector('[data-testid="wcl-headerLeague"]', timeout=10000)
            
            # Expand collapsed leagues
            collapsed = await page.locator(".event__header--closed").all()
            for cl in collapsed:
                try:
                    await cl.click(timeout=1000)
                    await page.wait_for_timeout(100)
                except:
                    pass
            
            # Get match IDs from matching leagues
            event_headers = await page.locator('[data-testid="wcl-headerLeague"]').all()
            
            for header in event_headers:
                header_text = (await header.text_content() or "").strip().lower()
                
                # Check if header matches any of our league filters
                matched = any(f.lower() in header_text for f in league_filters)
                
                if matched:
                    # Get match IDs using JS traversal
                    ids = await header.evaluate("""(header) => {
                        const wrapper = header.parentElement;
                        const matchIds = [];
                        let el = wrapper.nextElementSibling;
                        
                        while (el) {
                            if (el.classList.contains('headerLeague__wrapper')) {
                                const hasHeader = el.querySelector('[data-testid="wcl-headerLeague"]');
                                if (hasHeader) break;
                            }
                            if (el.classList.contains('event__match') && el.id) {
                                matchIds.push(el.id.split('_').pop());
                            }
                            el = el.nextElementSibling;
                        }
                        return matchIds;
                    }""")
                    
                    if ids:
                        logger.info(f"  ✅ {header_text[:50]}... -> {len(ids)} maç")
                        for match_id in ids:
                            if match_id not in all_match_ids:
                                all_match_ids[match_id] = date_str
            
            # Go back to today for next iteration
            if delta_days != 0:
                await page.goto("https://www.flashscore.co.uk/", timeout=60000, wait_until="domcontentloaded")
                await page.wait_for_timeout(500)
                
        except Exception as e:
            logger.warning(f"Tarih {date_str} için hata: {e}")
        
        current_date += timedelta(days=1)
    
    logger.info(f"✅ TOPLAM {len(all_match_ids)} BENZERSİZ MAÇ BULUNDU")
    return all_match_ids


async def main():
    # Load config
    with open(get_user_data_path("config.json"), "r", encoding="utf-8-sig") as f:
        config = json.load(f)
    
    leagues = config["ligler"]
    start_date_str = config["baslangic"]
    end_date_str = config["bitis"]
    bookmakers = config["bookmakers"]
    bet_types = config.get("bet_types", {})
    
    # Parse dates (format: DD.MM.YYYY)
    try:
        start_date = datetime.strptime(start_date_str, "%d.%m.%Y")
        end_date = datetime.strptime(end_date_str, "%d.%m.%Y")
    except ValueError as e:
        logger.error(f"Tarih format hatası: {e}. Beklenen: DD.MM.YYYY")
        return
    
    logger.info(f"📅 Tarih aralığı: {start_date_str} - {end_date_str}")
    logger.info(f"📋 Seçilen ligler: {len(leagues)}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        
        # Phase 1: Collect match IDs
        logger.info("🔍 Phase 1: Maç ID'leri toplanıyor...")
        match_ids = await collect_match_ids_by_date(page, leagues, start_date, end_date)
        
        await page.close()
        await browser.close()
        
        if not match_ids:
            logger.error("❌ Hiç maç bulunamadı!")
            return
        
        match_id_list = list(match_ids.keys())
        datetime_map = match_ids
        
        # Setup Excel
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        excel_filename = get_user_data_path(f"eski-mac-{timestamp}.xlsx")
        logger.info(f"📁 Excel: {excel_filename}")
        prepare_excel_file(excel_filename)
        init_progress(len(match_id_list), "Old Matches Scraping")
        
        # Phase 2: Fast threaded scraping
        logger.info(f"⚡ Phase 2: {len(match_id_list)} maç işlenecek (Threading mode)")
        
        from fast_scraper import run_threaded_scraper
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            run_threaded_scraper,
            match_id_list, bookmakers, bet_types, excel_filename, logger, 20, datetime_map
        )
        failed_matches, all_results = result
        
        # Retry failed
        if failed_matches:
            logger.info(f"🔄 {len(failed_matches)} başarısız maç yeniden deneniyor...")
            retry_result = await loop.run_in_executor(
                None,
                run_threaded_scraper,
                failed_matches, bookmakers, bet_types, excel_filename, logger, 10, datetime_map
            )
            failed_matches, retry_results = retry_result
            all_results.extend(retry_results)
        
        # Sort Excel
        sort_excel_file(excel_filename)
        
        # Report
        total = len(match_ids)
        success = len(all_results)
        
        finish_progress(status="completed")
        
        logger.info("=" * 50)
        logger.info("SONUÇ RAPORU")
        logger.info(f"Toplam Maç: {total}")
        logger.info(f"Başarılı: {success} ({100*success//max(total,1)}%)")
        logger.info(f"Başarısız: {len(failed_matches)}")
        logger.info("=" * 50)
        
        print(f"\n{'='*50}")
        print(f"✅ İŞLEM TAMAMLANDI!")
        print(f"Başarılı: {success}/{total}")
        print(f"Dosya: {excel_filename}")
        print(f"{'='*50}")


if __name__ == "__main__":
    asyncio.run(main())