"""
HYBRID SCRAPER - Best of both worlds!
- HTTP for odds (fast, no browser overhead)
- Playwright for SAAT/İY (accurate, JS-rendered content)

~%30 slower than pure HTTP but gets ALL data correctly.
"""
import asyncio
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import re
import json
from datetime import datetime
import threading
from pathlib import Path

# Import shared utilities
from utils import get_logger, get_user_data_path

logger = get_logger(__name__)

# Shared session for HTTP odds fetching
SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/html',
})

# Thread-safe results
RESULTS = []
RESULTS_LOCK = threading.Lock()

# Progress tracking
PROGRESS = {"done": 0, "total": 0, "status": "idle"}
PROGRESS_LOCK = threading.Lock()


async def scrape_summary_playwright(page, match_id: str) -> dict:
    """
    Use Playwright to get SAAT and İY from JS-rendered page.
    This is the ONLY reliable way to get these fields.
    """
    result = {'SAAT': '', 'İY': '', 'İY SONUCU': ''}
    
    url = f'https://www.flashscore.com/match/{match_id}/#/match-summary'
    
    try:
        await page.goto(url, wait_until='domcontentloaded', timeout=15000)
        await page.wait_for_selector('.duelParticipant', timeout=5000)
        
        html = await page.content()
        soup = BeautifulSoup(html, 'html.parser')
        
        # Get TIME (SAAT) from startTime element
        time_elem = soup.select_one('.duelParticipant__startTime')
        if time_elem:
            time_text = time_elem.get_text(strip=True)
            # Format: "19.12. 21:00" or "21:00"
            time_match = re.search(r'(\d{1,2}:\d{2})', time_text)
            if time_match:
                result['SAAT'] = time_match.group(1)
        
        # Get Half-time score (İY) from score wrapper
        # Look for (X-Y) pattern in detail section
        detail_score = soup.select_one('.detailScore')
        if detail_score:
            score_text = detail_score.get_text(strip=True)
            # HT score usually in parentheses: "3 - 0 (1 - 0)"
            ht_match = re.search(r'\((\d+)\s*-\s*(\d+)\)', score_text)
            if ht_match:
                ht_home, ht_away = int(ht_match.group(1)), int(ht_match.group(2))
                result['İY'] = f'{ht_home}-{ht_away}'
                if ht_home > ht_away:
                    result['İY SONUCU'] = 'İY 1'
                elif ht_away > ht_home:
                    result['İY SONUCU'] = 'İY 2'
                else:
                    result['İY SONUCU'] = 'İY 0'
        
        # Fallback: Try period scores
        if not result['İY']:
            period_scores = soup.select('.smh__scores .smh__score')
            if len(period_scores) >= 2:
                # First period = HT
                try:
                    home_parts = period_scores[0].select('.smh__part')
                    away_parts = period_scores[1].select('.smh__part')
                    if home_parts and away_parts:
                        ht_home = int(home_parts[0].get_text(strip=True) or 0)
                        ht_away = int(away_parts[0].get_text(strip=True) or 0)
                        result['İY'] = f'{ht_home}-{ht_away}'
                        if ht_home > ht_away:
                            result['İY SONUCU'] = 'İY 1'
                        elif ht_away > ht_home:
                            result['İY SONUCU'] = 'İY 2'
                        else:
                            result['İY SONUCU'] = 'İY 0'
                except:
                    pass
                    
    except Exception as e:
        logger.debug(f"Playwright summary error for {match_id}: {e}")
    
    return result


def fetch_odds_http(match_id: str, bookmakers: list, bet_types: dict) -> dict:
    """
    Fast HTTP-based odds fetching (no browser needed).
    """
    from config import API_URL, BOOKMAKER_MAPPING
    from common_scraper import parse_odds_data
    
    api_url = f"{API_URL}?_hash=oce&eventId={match_id}&projectId=5&geoIpCode=US&geoIpSubdivisionCode=USCA"
    headers = {"Origin": "https://www.flashscore.com", "Referer": "https://www.flashscore.com/"}
    
    all_odds = {}
    try:
        response = SESSION.get(api_url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            for bm in bookmakers:
                bm_id = BOOKMAKER_MAPPING.get(bm)
                if bm_id:
                    all_odds.update(parse_odds_data(data, bm, bm_id, bet_types))
    except Exception as e:
        logger.debug(f"Odds fetch error for {match_id}: {e}")
    
    return all_odds


def fetch_basic_info_http(match_id: str) -> dict:
    """
    Get basic match info from HTML meta tags (teams, date, score).
    Works without JS rendering.
    """
    result = {"ide": match_id}
    
    url = f'https://www.flashscore.com/match/{match_id}/'
    
    try:
        response = SESSION.get(url, timeout=8)
        if response.status_code != 200:
            return result
        
        soup = BeautifulSoup(response.text, 'html.parser')
        og_title = soup.select_one('meta[property="og:title"]')
        og_desc = soup.select_one('meta[property="og:description"]')
        description = soup.select_one('meta[name="description"]')
        
        # Parse teams and score from title
        if og_title:
            title = og_title.get('content', '')
            match = re.match(r'^(.+?)\s+-\s+(.+?)\s+(\d+):(\d+)$', title)
            if match:
                result['EV SAHİBİ'] = match.group(1).strip()
                result['DEPLASMAN'] = match.group(2).strip()
                h_s, a_s = int(match.group(3)), int(match.group(4))
                result['MS'] = f"{h_s}-{a_s}"
                result['MS SONUCU'] = 'MS 1' if h_s > a_s else 'MS 2' if a_s > h_s else 'MS 0'
                total = h_s + a_s
                result['2.5 ALT ÜST'] = '2.5 ÜST' if total > 2.5 else '2.5 ALT'
                result['3.5 ÜST'] = '3.5 ÜST' if total > 3.5 else '3.5 ALT'
                result['KG VAR/YOK'] = 'KG VAR' if (h_s > 0 and a_s > 0) else 'KG YOK'
        
        # Parse league/country from description
        if og_desc:
            desc = og_desc.get('content', '')
            round_match = re.search(r'Round\s*(\d+)', desc)
            if round_match:
                result['HAFTA'] = round_match.group(1)
            league_match = re.match(r'^([^:]+):\s*(.+?)(?:\s*-\s*Round|\s*$)', desc)
            if league_match:
                result['ÜLKE'] = league_match.group(1).strip()
                result['LİG'] = league_match.group(2).strip()
        
        # Parse date from description
        if description:
            desc_text = description.get('content', '')
            date_match = re.search(r'(\d{2})/(\d{2})/(\d{4})', desc_text)
            if date_match:
                day, month, year = date_match.group(1), date_match.group(2), date_match.group(3)
                result['TARİH'] = f"{day}.{month}.{year}"
                result['GÜN'] = day
                result['AY'] = month
                result['YIL'] = year
                try:
                    date_obj = datetime.strptime(f"{day}/{month}/{year}", "%d/%m/%Y")
                    gun_adlari = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
                    result['GÜN_ADI'] = gun_adlari[date_obj.weekday()]
                    if date_obj.month >= 8:
                        result['SEZON'] = f"{date_obj.year}-{date_obj.year+1}"
                    else:
                        result['SEZON'] = f"{date_obj.year-1}-{date_obj.year}"
                except:
                    pass
    except Exception as e:
        logger.debug(f"Basic info error for {match_id}: {e}")
    
    # Set defaults
    for key in ['SAAT', 'İY', 'HAFTA', 'SEZON', 'İY SONUCU', 'MS SONUCU', 'İY-MS', 
                '2.5 ALT ÜST', '3.5 ÜST', 'KG VAR/YOK', 'İY 0.5 ALT ÜST', 'İY 1.5 ALT ÜST']:
        result.setdefault(key, '')
    
    return result


async def scrape_match_hybrid(page, match_id: str, bookmakers: list, bet_types: dict) -> dict:
    """
    HYBRID approach: HTTP for basic info + odds, Playwright for SAAT/İY.
    """
    # Step 1: Get basic info via HTTP (fast)
    result = fetch_basic_info_http(match_id)
    
    # Step 2: Get odds via HTTP (fast)
    odds = fetch_odds_http(match_id, bookmakers, bet_types)
    result.update(odds)
    
    # Step 3: Get SAAT and İY via Playwright (accurate)
    summary = await scrape_summary_playwright(page, match_id)
    result['SAAT'] = summary.get('SAAT', '')
    result['İY'] = summary.get('İY', '')
    result['İY SONUCU'] = summary.get('İY SONUCU', '')
    
    # Calculate İY-MS
    if result.get('MS SONUCU') and result.get('İY SONUCU'):
        iy_code = result['İY SONUCU'].replace('İY ', '')
        ms_code = result['MS SONUCU'].replace('MS ', '')
        result['İY-MS'] = f"İY {iy_code}/MS {ms_code}"
    
    return result


async def run_hybrid_scraper(match_ids: list, bookmakers: list, bet_types: dict, excel_filename: str, max_concurrent: int = 5):
    """
    Run hybrid scraper with multiple Playwright pages for SAAT/İY.
    """
    global RESULTS, PROGRESS
    
    RESULTS = []
    PROGRESS = {"done": 0, "total": len(match_ids), "status": "running"}
    
    logger.info(f"🚀 Hybrid Scraper: {len(match_ids)} maç, {max_concurrent} paralel sayfa")
    start_time = datetime.now()
    
    failed = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        
        # Create page pool
        pages = [await context.new_page() for _ in range(max_concurrent)]
        
        # Process matches in batches
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def process_match(page, match_id):
            try:
                result = await scrape_match_hybrid(page, match_id, bookmakers, bet_types)
                if result and result.get('EV SAHİBİ'):
                    with RESULTS_LOCK:
                        RESULTS.append(result)
                    with PROGRESS_LOCK:
                        PROGRESS["done"] += 1
                    return True
                else:
                    failed.append(match_id)
                    return False
            except Exception as e:
                logger.warning(f"Error for {match_id}: {e}")
                failed.append(match_id)
                return False
        
        # Distribute work across pages
        tasks = []
        for i, match_id in enumerate(match_ids):
            page = pages[i % max_concurrent]
            
            async def wrapped_process(p=page, m=match_id):
                async with semaphore:
                    return await process_match(p, m)
            
            tasks.append(wrapped_process())
        
        # Run all tasks
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Cleanup
        for page in pages:
            await page.close()
        await context.close()
        await browser.close()
    
    scrape_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"📊 Hybrid tarama: {len(RESULTS)} başarılı, {len(failed)} başarısız ({scrape_time:.1f}s)")
    
    # Write to Excel
    if RESULTS:
        write_results_to_excel(RESULTS, excel_filename)
    
    # Save for analysis
    results_file = get_user_data_path("last_results.json")
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)
    
    PROGRESS["status"] = "completed"
    return failed, RESULTS.copy()


def write_results_to_excel(results: list, excel_filename: str):
    """Write results to Excel using pandas + xlsxwriter."""
    import pandas as pd
    
    logger.info(f"📝 Excel'e yazılıyor: {len(results)} kayıt...")
    
    # Column order
    basic_cols = ["ide", "TARİH", "GÜN", "AY", "YIL", "GÜN_ADI", "SAAT", "HAFTA", "SEZON", 
                  "ÜLKE", "LİG", "EV SAHİBİ", "DEPLASMAN", "MS", "İY", "İY SONUCU", 
                  "MS SONUCU", "İY-MS", "2.5 ALT ÜST", "3.5 ÜST", "KG VAR/YOK", 
                  "İY 0.5 ALT ÜST", "İY 1.5 ALT ÜST"]
    
    df = pd.DataFrame(results)
    
    # Bookmaker sheets
    sheets = ["bet365", "BetMGM", "Betfred", "Unibetuk", "Betway", "Midnite", "Ladbrokes", "Betfair", "7Bet"]
    
    with pd.ExcelWriter(excel_filename, engine='xlsxwriter') as writer:
        for sheet_name in sheets:
            bm_lower = sheet_name.lower()
            bm_cols = [c for c in df.columns if bm_lower in c.lower() or c in basic_cols]
            
            # Sort columns
            def get_sort_key(col):
                if col in basic_cols:
                    return (0, basic_cols.index(col))
                is_opening = "opening" in col.lower()
                return (1000 if is_opening else 2000, col)
            
            ordered_cols = sorted([c for c in bm_cols if c in df.columns], key=get_sort_key)
            sheet_df = df[ordered_cols] if ordered_cols else df[basic_cols]
            sheet_df.to_excel(writer, sheet_name=sheet_name, index=False, startrow=2)
            
            # Add header
            ws = writer.sheets[sheet_name]
            ws.write(0, 0, f"Flashscore Hybrid Export - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
            for col_num, col_name in enumerate(sheet_df.columns):
                ws.write(1, col_num, col_name)
    
    logger.info(f"✅ Excel yazımı tamamlandı: {excel_filename}")


# Entry point for GUI
def run_hybrid(match_ids, bookmakers, bet_types, excel_filename, logger_instance, max_concurrent=5):
    """Wrapper to run async hybrid scraper from sync code."""
    global logger
    logger = logger_instance
    return asyncio.run(run_hybrid_scraper(match_ids, bookmakers, bet_types, excel_filename, max_concurrent))


if __name__ == "__main__":
    # Test
    test_ids = ["SS3W5yS8", "pYP9mZXF"]
    failed, results = asyncio.run(run_hybrid_scraper(
        test_ids, 
        ["bet365", "Unibetuk"], 
        {}, 
        "test_hybrid.xlsx"
    ))
    print(f"Done! {len(results)} results")
