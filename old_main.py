import asyncio
import json
from playwright.async_api import async_playwright, Page, expect
from utils import get_logger, get_resource_path, get_user_data_path
from common_scraper import scrape_summary_page, fetch_all_odds_data, block_agressive
from excel_writer import write_to_excel, prepare_excel_file, sort_excel_file
from data_processor import merge_data
from failed_matches_manager import add_failed_match, remove_successful_match
from datetime import datetime, timedelta
import re

logger = get_logger(__name__)

async def date_collector_worker(page: Page, date_queue: asyncio.Queue, found_ids: set, league_filters: set, worker_id: int):
    """Tarih kuyruğundan tarihleri alır ve ileri/geri oklarını kullanarak o tarihe gider."""
    while not date_queue.empty():
        current_date = await date_queue.get()
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
            await page.wait_for_selector('[data-testid="wcl-headerLeague"]', timeout=30000)
            
            # Expand collapsed leagues
            collapsed_leagues = await page.locator(".event__header--closed").all()
            if collapsed_leagues:
                logger.info(f"[Collector {worker_id}] {len(collapsed_leagues)} kapalı lig bulundu, hepsi açılıyor...")
                for cl in collapsed_leagues:
                    try:
                        await cl.click(timeout=2000)
                        await page.wait_for_timeout(200)
                    except:
                        pass
            
            event_headers = await page.locator('[data-testid="wcl-headerLeague"]').all()
            
            found_headers_text = [await h.text_content() for h in event_headers]
            logger.debug(f"[Collector {worker_id}] Sayfada bulunan lig başlıkları: {found_headers_text}")

            for header in event_headers:
                header_text = (await header.text_content() or "").strip()
                header_text_norm = header_text.lower().replace('\xa0', ' ')
                
                # Check if any filter matches
                match_found = False
                for filter_name in league_filters:
                    filter_name_norm = filter_name.lower().replace('\xa0', ' ')
                    if filter_name_norm in header_text_norm:
                        match_found = True
                        break
                
                if match_found:
                    # Use JS to traverse siblings efficiently - UPDATED LOGIC
                    ids = await header.evaluate("""(header) => {
                        const wrapperSource = header.parentElement;
                        const matchIds = [];
                        
                        // Flashscore yapısında bazen header bir wrapper içinde, bazen direkt var.
                        // Garanti olsun diye, header'ın içinde bulunduğu en dış wrapper'dan sonrasına bakacağız.
                        // Ancak genellikle headerLeague__wrapper -> headerLeague yapısı var.
                        
                        let currentElement = wrapperSource.nextElementSibling;
                        
                        while (currentElement) {
                            // Eğer yeni bir lig başlığı wrapper'ına gelirsek dur
                            if (currentElement.classList.contains('headerLeague__wrapper')) {
                                // Ancak bu wrapper boş olabilir veya sadece banner olabilir.
                                // İçinde gerçek bir header var mı kontrol etmeli miyiz?
                                // Basit mantık: Her wrapper yeni bir bölüm demek.
                                const hasHeader = currentElement.querySelector('[data-testid="wcl-headerLeague"]');
                                if (hasHeader) {
                                    break;
                                }
                                // Header yoksa (reklam vs) devam et
                            }
                            
                            // event__match sınıfı varsa ID'yi al
                            if (currentElement.classList.contains('event__match') && currentElement.id) {
                                matchIds.push(currentElement.id.split('_').pop());
                            }
                            
                            currentElement = currentElement.nextElementSibling;
                        }
                        return matchIds;
                    }""")
                    
                    if ids:
                        logger.info(f"[Collector {worker_id}] HEADER MATCH: '{header_text}' -> {len(ids)} maç bulundu.")
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
            # Semaphore ile eszamanli islemleri sinirla
            async with semaphore:
                summary_data = await scrape_summary_page(page, match_id)
                if not summary_data:
                    logger.warning(f"Skipping match {match_id} due to missing summary.")
                    add_failed_match(match_id, "MISSING_SUMMARY", "No summary data", ["ALL"])
                    continue
                
                # API calls are lighter on browser, but still good to keep inside to limit total net usage
                odds_data = await fetch_all_odds_data(match_id, bookmakers, bet_types)

            match_id_dict = {"ide": match_id}
            common_data = merge_data(match_id_dict, summary_data)
            
            write_to_excel(excel_filename, common_data, odds_data)
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
    num_scraper_workers = min(config.get("num_workers", 32), 32)  # Max 32
    num_collector_workers = min(config.get("num_workers", 32), 32)  # Use same as scraper

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
        league_name_filters = {f"{l.split(' - ')[0]}: {l.split(' - ')[1]}" for l in leagues}

        collector_pages = [await context.new_page() for _ in range(num_collector_workers)]
        collector_tasks = [
            asyncio.create_task(
                date_collector_worker(collector_pages[i], date_queue, found_ids, league_name_filters, i + 1)
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
            
        # --- PHASE 2: Parallel Match Data Scraping ---
        # Excel dosyasını tarih/saat ile oluştur
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        excel_filename = get_user_data_path(f"eski-mac-{timestamp}.xlsx")
        logger.info(f"📊 Excel dosyası: {excel_filename}")
        
        # Excel dosyasını scraping başlamadan önce hazırla
        logger.info("📊 Template Excel dosyası hazırlanıyor...")
        prepare_excel_file(excel_filename)
        logger.info("✅ Template Excel hazır!")
        
        logger.info(f"Phase 2: Processing {len(match_ids)} matches with {num_scraper_workers} workers...")
        match_queue = asyncio.Queue()
        for match_id in match_ids:
            await match_queue.put(match_id)

        # Semaphore for concurrency control (limiting active navigations)
        semaphore = asyncio.Semaphore(20) # Max 20 concurrent navigations

        scraper_pages = [await context.new_page() for _ in range(num_scraper_workers)]
        scraper_tasks = []
        for i in range(num_scraper_workers):
            # Pass semaphore to worker
            task = asyncio.create_task(scrape_worker(
                scraper_pages[i], match_queue, i + 1, bookmakers, excel_filename, bet_types, semaphore
            ))
            scraper_tasks.append(task)
            # Small delay to prevent thundering herd
            await asyncio.sleep(0.1)
            
        await match_queue.join()

        for task in scraper_tasks:
            task.cancel()
        await asyncio.gather(*scraper_tasks, return_exceptions=True)

        await browser.close()
        
        # Scraping bitti, Excel'i sırala
        sort_excel_file(excel_filename)
        
        logger.info(f"All matches processed. Excel file: {excel_filename}")
        print(f"\n✅ İşlem tamamlandı! Dosya: {excel_filename}")

if __name__ == "__main__":
    asyncio.run(main())