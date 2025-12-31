"""
OLD MAIN - Eski Maçlar (Geçmiş Tarihli)
Uses league results pages instead of date picker (more reliable)
Then uses fast_scraper for HTTP-based scraping
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


async def collect_match_ids_from_results(page, leagues, start_date, end_date):
    """
    Collect match IDs from league RESULTS pages (not main page date picker).
    This is more reliable for past matches.
    """
    all_match_ids = {}  # {match_id: datetime_str}
    
    base_url = "https://www.flashscore.co.uk"
    
    # Build league URLs
    league_urls = []
    for league in leagues:
        parts = league.split(' - ')
        if len(parts) >= 2:
            country = parts[0].lower().replace(' ', '-')
            league_name = parts[1].lower().replace(' ', '-')
            url = f"{base_url}/football/{country}/{league_name}/results/"
            league_urls.append((league, url))
    
    logger.info(f"📋 {len(league_urls)} lig sonuç URL'si oluşturuldu")
    
    for league_name, league_url in league_urls:
        try:
            logger.info(f"🔍 Lig taranıyor: {league_name}")
            await page.goto(league_url, timeout=45000, wait_until="domcontentloaded")
            
            # Wait for matches
            try:
                await page.wait_for_selector('.event__match', timeout=15000)
            except:
                logger.warning(f"  ⚠️ Maç bulunamadı: {league_name}")
                continue
            
            # Click "Show more" to load all matches
            click_count = 0
            max_clicks = 30
            while click_count < max_clicks:
                try:
                    show_more = page.locator('[data-testid="wcl-buttonLink"]')
                    await show_more.wait_for(state="visible", timeout=3000)
                    await show_more.click()
                    await page.wait_for_timeout(500)
                    click_count += 1
                except:
                    break
            
            if click_count > 0:
                logger.info(f"  ↻ {click_count} kez 'Show more' tıklandı")
            
            # Get match data with dates
            match_data = await page.evaluate("""
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
            
            # Filter by date range
            for item in match_data:
                match_id = item['id']
                datetime_str = item['datetime']  # Format: "DD.MM. HH:MM"
                
                # Parse date from datetime string
                try:
                    # Expected format: "28.12. 17:30" or "28.12.2024 17:30"
                    date_match = re.search(r'(\d{2})\.(\d{2})\.(\d{4})?', datetime_str)
                    if date_match:
                        day = int(date_match.group(1))
                        month = int(date_match.group(2))
                        year = int(date_match.group(3)) if date_match.group(3) else datetime.now().year
                        
                        match_date = datetime(year, month, day)
                        
                        # Check if within date range
                        if start_date <= match_date <= end_date:
                            if match_id not in all_match_ids:
                                all_match_ids[match_id] = datetime_str
                    else:
                        # If date parsing fails, include the match anyway
                        if match_id not in all_match_ids:
                            all_match_ids[match_id] = datetime_str
                except:
                    # Include match if date parsing fails
                    if match_id not in all_match_ids:
                        all_match_ids[match_id] = datetime_str
            
            logger.info(f"  ✅ {len(match_data)} maç bulundu, filtreleme sonrası toplam: {len(all_match_ids)}")
            
        except Exception as e:
            logger.warning(f"Lig {league_name} için hata: {e}")
    
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
        
        # Phase 1: Collect match IDs from results pages
        logger.info("🔍 Phase 1: Maç ID'leri toplanıyor (sonuç sayfalarından)...")
        match_ids = await collect_match_ids_from_results(page, leagues, start_date, end_date)
        
        await page.close()
        await browser.close()
        
        if not match_ids:
            logger.error("❌ Hiç maç bulunamadı!")
            print("\n❌ Seçilen tarih aralığında maç bulunamadı!")
            print("İpucu: Tarihlerin geçmişte olduğundan emin olun.")
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