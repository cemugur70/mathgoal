import asyncio
import json
from playwright.async_api import async_playwright, Page, expect
from datetime import datetime, timedelta
from progress_tracker import read_progress, update_progress
from common_scraper import scrape_summary_page, fetch_all_odds_data, block_agressive
from excel_writer import write_to_excel, prepare_excel_file, sort_excel_file
from failed_matches_manager import add_failed_match, remove_successful_match
from data_processor import merge_data
from utils import get_logger, get_user_data_path

logger = get_logger(__name__)

async def date_collector_worker(page: Page, date_queue: asyncio.Queue, found_ids: set, league_filters: set, worker_id: int):
    """Tarih kuyruğundan tarihleri alır ve ileri/geri oklarını kullanarak o tarihe gider."""
    while True:
        try:
            current_date = date_queue.get_nowait()
        except asyncio.QueueEmpty:
            break
        date_url_format = current_date.strftime("%Y-%m-%d")
        logger.info(f"[Collector {worker_id}] İşlenen tarih: {date_url_format}")
        
        try:
            # Her tarih için ana sayfaya gitmek, "bugün"den başlamayı garantiler
            await page.goto("https://www.flashscore.co.uk/", timeout=60000, wait_until="domcontentloaded")

            # Çerez onay penceresini kontrol et ve kabul et
            try:
                consent_button = page.locator("#onetrust-accept-btn-handler")
                await consent_button.click(timeout=5000)
                await page.wait_for_selector("#onetrust-accept-btn-handler", state="hidden", timeout=5000)
                logger.info(f"[Collector {worker_id}] Çerez onayı kabul edildi ve pencere kapandı.")
            except Exception:
                logger.debug(f"[Collector {worker_id}] Çerez penceresi bulunamadı veya zaten kabul edilmiş.")

            # Bugünden hedef tarihe gitmek için gün farkını hesapla
            today = datetime.now().date()
            target_date = current_date.date()
            delta_days = (target_date - today).days

            if delta_days != 0:
                date_picker_button = page.locator('[data-testid="wcl-dayPickerButton"]')
                
                if delta_days < 0:
                    button_selector = '[data-day-picker-arrow="prev"]'
                    clicks = abs(delta_days)
                    direction = "geri"
                else: # delta_days > 0
                    button_selector = '[data-day-picker-arrow="next"]'
                    clicks = delta_days
                    direction = "ileri"

                logger.info(f"[Collector {worker_id}] Hedef tarihe ulaşmak için {clicks} gün {direction} gidiliyor...")
                arrow_button = page.locator(button_selector)
                date_stepper = today
                for i in range(clicks):
                    # Bir sonraki adımda beklenen tarihi hesapla
                    if direction == "geri":
                        date_stepper -= timedelta(days=1)
                    else:
                        date_stepper += timedelta(days=1)
                    
                    expected_intermediate_date_str = date_stepper.strftime("%d/%m")
                    
                    await arrow_button.click()
                    # Buton metninin güncellenmesini bekleyerek sayfanın durumunun değiştiğini onayla
                    await expect(date_picker_button).to_contain_text(expected_intermediate_date_str, timeout=15000)

            # Son bir kez doğru tarihte olduğumuzu onayla
            expected_date_str = current_date.strftime("%d/%m")
            date_picker_button = page.locator('[data-testid="wcl-dayPickerButton"]')
            await expect(date_picker_button).to_contain_text(expected_date_str, timeout=20000)
            
            # Maçları topla
            try:
                # Expand all closed leagues first
                closed_leagues = page.locator(".event__expander--close")
                count = await closed_leagues.count()
                if count > 0:
                    for i in range(count):
                        try:
                            await closed_leagues.nth(i).click(timeout=1000)
                        except:
                            pass
                
                await page.wait_for_selector('[data-testid="wcl-headerLeague"]', timeout=30000)
            except Exception as e:
                logger.warning(f"[Collector {worker_id}] No headers found or timeout: {e}")
                continue
            event_headers = await page.locator('[data-testid="wcl-headerLeague"]').all()
            
            # DEBUGGING: Bulunan başlıkları ve filtreleri logla
            logger.info(f"[Collector {worker_id}] Kullanılan filtreler: {league_filters}")
            
            # Bulunan tüm başlıkları al ve temizle
            found_headers_text = []
            for h in event_headers:
                txt = await h.text_content()
                if txt:
                    found_headers_text.append(txt.replace('\n', ' ').strip())
            
            logger.info(f"[Collector {worker_id}] Sayfada bulunan lig başlıkları ({len(found_headers_text)}): {found_headers_text[:20]}...")

            for header in event_headers:
                header_text = (await header.text_content() or "").strip()
                # Normalize text: lowercase and replace non-breaking spaces
                header_text_norm = header_text.lower().replace('\xa0', ' ')
                
                # Check if any filter matches using fuzzy logic (both parts must appear)
                match_found = False
                for country_filter, league_filter in league_filters:
                    # Check if BOTH matching parts exist in the header text
                    # e.g. "Belgium" AND "Super League" are in "Super League WomenBELGIUM"
                    if country_filter in header_text_norm and league_filter in header_text_norm:
                        match_found = True
                        break
                
                if match_found:
                    # Use JS to traverse siblings efficiently
                    def get_ids_js(header):
                        return """(header) => {
                            const wrapper = header.parentElement;
                            const matchIds = [];
                            let sibling = wrapper.nextElementSibling;
                            while (sibling) {
                                // Stop ONLY if we hit the NEXT league header wrapper
                                if (sibling.classList.contains('headerLeague__wrapper')) {
                                    // Check if this wrapper actually contains a league header
                                    if (sibling.querySelector('[data-testid="wcl-headerLeague"]')) {
                                        break;
                                    }
                                    // If not, it's just a spacer or sub-header, continue!
                                }
                                // Collect match ID if it's a match row
                                if (sibling.classList.contains('event__match') && sibling.id) {
                                    matchIds.push(sibling.id.split('_').pop());
                                }
                                sibling = sibling.nextElementSibling;
                            }
                            return matchIds;
                        }"""

                    ids = await header.evaluate(get_ids_js(header))
                    
                    if not ids:
                        # If no IDs, maybe collapsed? Try to click header to expand
                        logger.info(f"[Collector {worker_id}] Matched header '{header_text}' but found no IDs. Trying to expand...")
                        try:
                            # Scroll into view first
                            await header.scroll_into_view_if_needed()
                            # Click the header (usually toggles expansion)
                            await header.click(timeout=2000)
                            await asyncio.sleep(1.0) # wait for animation
                            
                            # Try getting IDs again
                            ids = await header.evaluate(get_ids_js(header))
                            logger.info(f"[Collector {worker_id}] After expansion, found {len(ids)} matches.")
                        except Exception as e:
                            logger.warning(f"[Collector {worker_id}] Failed to expand header: {e}")

                    if ids:
                        logger.info(f"[Collector {worker_id}] FOUND {len(ids)} MATCHES for header '{header_text}'")
                        found_ids.update(ids)
                            
        except Exception as e:
            logger.debug(f"[Collector {worker_id}] Tarih {date_url_format} için maç bulunamadı veya bir hata oluştu: {e}")
        finally:
            date_queue.task_done()

async def scrape_worker(page: Page, queue: asyncio.Queue, worker_id: int, bookmakers: list, excel_filename: str, bet_types: dict, semaphore: asyncio.Semaphore):
    # Kaynak engelleme aktiflestir
    await page.route("**/*", block_agressive)
    
    while True:
        try:
            match_id = queue.get_nowait()
        except asyncio.QueueEmpty:
            break
        
        logger.info(f"[Scraper {worker_id}] Processing match {match_id}")
        
        try:
            # Check if match was already processed (requires reading the specific match status, but read_progress reads global status. 
            # Actually, read_progress() returns the whole dict. We need to check if match_id is in success/failed lists or handle it differently.
            # However, looking at the logic, we might just want to skip this check or implement a specific 'is_processed' check.
            # For now, let's remove this check or fix it. The error was passing match_id to read_progress().
            # Let's remove this check for now as it seems misplaced or the function is not designed for per-match checking this way.
            # OR better: read_progress() returns global state. We shouldn't use it to check specific match in this loop efficiently.
            # Let's just proceed.
            pass

            # Semaphore ile eszamanli islemleri sinirla
            async with semaphore:
                summary_data = await scrape_summary_page(page, match_id)
                if not summary_data:
                    logger.warning(f"Skipping match {match_id} due to missing summary.")
                    add_failed_match(match_id, "MISSING_SUMMARY", "Summary data could not be scraped", ["ALL"])
                    continue
                
                # API calls are lighter on browser, but still good to keep inside semaphore to limit total network load
                odds_data = await fetch_all_odds_data(match_id, bookmakers, bet_types)

            match_id_dict = {"ide": match_id}
            common_data = merge_data(match_id_dict, summary_data)
            
            write_to_excel(excel_filename, common_data, odds_data)
            update_progress(match_id)
            remove_successful_match(match_id)
            logger.info(f"[Scraper {worker_id}] Successfully wrote data for match {match_id}")

        except Exception as e:
            logger.error(f"[Scraper {worker_id}] Error processing match {match_id}: {e}")
            add_failed_match(match_id, "EXCEPTION", str(e), ["ALL"])
        finally:
            queue.task_done()

async def main():
    with open(get_user_data_path("config.json"), "r", encoding="utf-8-sig") as f:
        config = json.load(f)

    leagues = config["ligler"]
    start_date_str = config["baslangic"]
    end_date_str = config["bitis"]
    year_str = config.get("yil") or str(datetime.now().year)
    bookmakers = config["bookmakers"]
    bet_types = config.get("bet_types", {})
    num_scraper_workers = config.get("num_workers", 32)
    num_collector_workers = min(config.get("num_workers", 32), 32)  # Collectors can stay limited

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        
        # --- PHASE 1: Parallel Match ID Collection ---
        logger.info(f"Phase 1: Collecting match IDs with {num_collector_workers} parallel collectors...")
        
        try:
            # Try full date format first (DD.MM.YYYY from GUI)
            if len(start_date_str) > 5 and '.' in start_date_str:
                start_date = datetime.strptime(start_date_str, "%d.%m.%Y")
            else:
                start_date = datetime.strptime(f"{start_date_str}.{year_str}", "%d.%m.%Y")
            
            if len(end_date_str) > 5 and '.' in end_date_str:
                end_date = datetime.strptime(end_date_str, "%d.%m.%Y")
            else:
                end_date = datetime.strptime(f"{end_date_str}.{year_str}", "%d.%m.%Y")
        except ValueError as e:
            logger.error(f"Tarih formati hatasi: {e}. Beklenen: DD.MM.YYYY")
            await browser.close()
            return

        date_queue = asyncio.Queue()
        current_date = start_date
        while current_date <= end_date:
            await date_queue.put(current_date)
            current_date += timedelta(days=1)
            
        found_ids = set()
        
        # Parse filters into (Country, League) tuples
        parsed_filters = []
        for l in leagues:
            if ' - ' in l:
                parts = l.split(' - ')
                parsed_filters.append((parts[0].lower(), parts[1].lower()))
            else:
                parsed_filters.append((l.lower(), ""))

        collector_pages = [await context.new_page() for _ in range(num_collector_workers)]
        collector_tasks = [
            asyncio.create_task(
                date_collector_worker(collector_pages[i], date_queue, found_ids, parsed_filters, i + 1)
            ) for i in range(num_collector_workers)
        ]
        
        await date_queue.join()

        for task in collector_tasks:
            task.cancel()
        await asyncio.gather(*collector_tasks, return_exceptions=True)
        for page in collector_pages:
            await page.close()

        match_ids = list(found_ids)
        if not match_ids:
            logger.info("No match IDs found for the selected criteria. Exiting.")
            await browser.close()
            return
            
        # --- PHASE 2: FAST THREADED SCRAPING ---
        # Excel dosyasını tarih/saat ile oluştur
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        excel_filename = get_user_data_path(f"yeni-mac-{timestamp}.xlsx")
        logger.info(f"📊 Excel dosyası: {excel_filename}")
        
        # Close browser - we'll use HTTP for fast scraping
        await browser.close()
        
        # Use fast threaded scraper (same as season scraper)
        from fast_future_scraper import run_future_scraper
        
        logger.info(f"Phase 2: {len(match_ids)} maç işlenecek (Threading mode)")
        
        # Run threaded scraper (asyncio is already imported at top)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, 
            run_future_scraper,
            match_ids, bookmakers, bet_types, excel_filename, logger, 20, {}
        )
        failed_matches, all_results = result
        
        # Retry failed matches once
        if failed_matches:
            logger.info(f"🔄 {len(failed_matches)} başarısız maç yeniden deneniyor...")
            retry_result = await loop.run_in_executor(
                None,
                run_future_scraper,
                failed_matches, bookmakers, bet_types, excel_filename, logger, 10, {}
            )
        
        logger.info(f"✅ İşlem tamamlandı! Dosya: {excel_filename}")
        print(f"\n✅ İşlem tamamlandı! Dosya: {excel_filename}")

if __name__ == "__main__":
    asyncio.run(main())
