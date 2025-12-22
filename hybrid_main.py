"""
HYBRID MAIN - Entry point for Hybrid Scraper mode
Uses HTTP for fast odds + Playwright for accurate SAAT/İY

Similar to season_main.py but uses hybrid_scraper instead of fast_scraper.
"""
import asyncio
import json
import re
from datetime import datetime
from playwright.async_api import async_playwright

from utils import get_logger, get_user_data_path
from progress_tracker import init_progress, increment_progress, finish_progress

logger = get_logger(__name__)


async def get_all_match_urls(page, leagues, start_date, end_date):
    """Collect all match IDs from league archives - WORKING VERSION from season_main.py."""
    
    # Build league URLs
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

    # Collect season URLs (with duplicate check)
    season_links = set()
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
                        season_text = season_text_raw.strip()
                        
                        # Find start year from "2024/2025" format
                        if '/' in season_text:
                            start_year_match = re.search(r'(\d{4})/', season_text)
                            if start_year_match:
                                year = int(start_year_match.group(1))
                            else:
                                continue
                        else:
                            continue

                        # Check if within user's selected year range
                        if start_date <= year <= end_date:
                            href = await season_link_element.get_attribute("href")
                            full_url = f"{base_url}{href}results/"
                            
                            if full_url not in season_links:
                                season_links.add(full_url)
                                logger.info(f"  ✅ {season_text} (yıl: {year})")
                                
                except Exception as e:
                    logger.debug(f"Sezon satırı parse edilemedi: {e}")
                    
        except Exception as e:
            logger.error(f"Lig arşivi işlenemedi {league_url}: {e}")

    season_links = list(season_links)
    logger.info(f"📅 {len(season_links)} sezon URL'si bulundu")

    # Collect match IDs
    match_ids = set()
    
    for season_link in season_links:
        try:
            logger.info(f"🔍 Maç ID'leri taranıyor: {season_link}")
            await page.goto(season_link, timeout=45000)
            await page.wait_for_load_state('domcontentloaded', timeout=15000)

            # Click show more button
            click_count = 0
            max_clicks = 50
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
            
            # Get match IDs from HTML
            final_html = await page.content()
            season_match_ids = set(re.findall(r'id="g_1_([a-zA-Z0-9]{8})"', final_html))
            
            before_count = len(match_ids)
            match_ids.update(season_match_ids)
            new_count = len(match_ids) - before_count
            
            logger.info(f"  📊 Bu sezon: {len(season_match_ids)} maç, Yeni: {new_count}, Toplam: {len(match_ids)}")

        except Exception as e:
            logger.error(f"Maç URL'leri taranamadı {season_link}: {e}")
            
    logger.info(f"✅ TOPLAM {len(match_ids)} BENZERSİZ MAÇ BULUNDU")
    return list(match_ids)


async def main():
    """Main entry point for hybrid scraper."""
    
    # Load config
    with open(get_user_data_path("config.json"), "r", encoding="utf-8-sig") as f:
        config = json.load(f)
    
    leagues = config["ligler"]
    start_date = int(config["baslangic"]) if config["baslangic"].isdigit() else 2024
    end_date = int(config["bitis"]) if config["bitis"].isdigit() else 2025
    bookmakers = config["bookmakers"]
    bet_types = config.get("bet_types", {})
    num_workers = config.get("num_workers", 5)  # Lower for hybrid mode
    
    # Initialize progress
    init_progress(0)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        logger.info("🔍 Maç ID'leri toplanıyor...")
        print("🔍 Maç ID'leri toplanıyor...")
        
        # Collect match IDs
        match_ids = await get_all_match_urls(page, leagues, start_date, end_date)
        
        await page.close()
        await browser.close()
        
        if not match_ids:
            logger.error("❌ Hiç maç bulunamadı!")
            print("❌ Hiç maç bulunamadı!")
            return
        
        total = len(match_ids)
        logger.info(f"📋 {total} maç bulundu, hybrid tarama başlıyor...")
        print(f"📋 {total} maç bulundu, hybrid tarama başlıyor...")
        
        # Reset progress
        init_progress(total)
        
        # Create Excel filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        excel_filename = get_user_data_path(f"hybrid-sonuc-{timestamp}.xlsx")
        
        # Run hybrid scraper
        from hybrid_scraper import run_hybrid_scraper
        
        # Limit concurrent pages for stability
        max_concurrent = min(num_workers, 5)
        
        failed, results = await run_hybrid_scraper(
            match_ids=match_ids,
            bookmakers=bookmakers,
            bet_types=bet_types,
            excel_filename=excel_filename,
            max_concurrent=max_concurrent
        )
        
        success = len(results)
        
        finish_progress(status="completed")
        
        logger.info("=" * 50)
        logger.info("HYBRID SCRAPER - SONUÇ RAPORU")
        logger.info(f"Toplam Maç: {total}")
        logger.info(f"Başarılı: {success} ({100*success//max(total,1)}%)")
        logger.info(f"Başarısız: {len(failed)}")
        logger.info("=" * 50)
        
        print(f"\n{'='*50}")
        print(f"✅ HYBRİD TARAMA TAMAMLANDI!")
        print(f"Başarılı: {success}/{total}")
        print(f"Dosya: {excel_filename}")
        print(f"{'='*50}")


if __name__ == "__main__":
    asyncio.run(main())
