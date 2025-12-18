"""
FAST FUTURE SCRAPER - For upcoming matches (Yeni Maçlar)
Uses same modern Excel style as fast_scraper.py
"""
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup
import re
from datetime import datetime
import threading
from config import BOOKMAKER_MAPPING

# Shared session for connection pooling
SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
})

# Thread-safe results list
RESULTS = []
RESULTS_LOCK = threading.Lock()

# Progress counter
PROGRESS = {"done": 0, "total": 0}
PROGRESS_LOCK = threading.Lock()

API_URL = "https://9.flashscore.info/9/x/feed/df_od_1"


def scrape_future_match_data(match_id: str, bookmakers: list, bet_types: dict, logger) -> dict:
    """Scrape data for an UPCOMING match - reuse fast_scraper logic but mark scores as '-'"""
    from fast_scraper import scrape_match_data
    
    result = scrape_match_data(match_id, bookmakers, bet_types, logger)
    
    if result:
        # Override scores with '-' since match hasn't been played yet
        result['MS'] = '-'
        result['İY'] = '-'
        result['İY SONUCU'] = '-'
        result['MS SONUCU'] = '-'
        result['İY-MS'] = '-'
        result['2.5 ALT ÜST'] = '-'
        result['3.5 ÜST'] = '-'
        result['KG VAR/YOK'] = '-'
        result['İY 0.5 ALT ÜST'] = '-'
        result['İY 1.5 ALT ÜST'] = '-'
    
    return result


def worker(match_id: str, bookmakers: list, bet_types: dict, logger, datetime_str: str = ''):
    """Single worker - scrapes and adds to RESULTS list"""
    global RESULTS, PROGRESS
    
    start = datetime.now()
    data = scrape_future_match_data(match_id, bookmakers, bet_types, logger)
    elapsed = (datetime.now() - start).total_seconds()
    
    # Apply pre-extracted datetime (SAAT) if available
    if data and datetime_str:
        import re
        time_match = re.search(r'(\d{1,2}:\d{2})', datetime_str)
        if time_match:
            data['SAAT'] = time_match.group(1)
        date_match = re.search(r'(\d{1,2})\.(\d{1,2})\.', datetime_str)
        if date_match and not data.get('GÜN'):
            data['GÜN'] = date_match.group(1).zfill(2)
            data['AY'] = date_match.group(2).zfill(2)
    
    with PROGRESS_LOCK:
        PROGRESS["done"] += 1
        done = PROGRESS["done"]
        total = PROGRESS["total"]
    
    if data:
        with RESULTS_LOCK:
            RESULTS.append(data)
        return True
    return False


def run_future_scraper(match_ids: list, bookmakers: list, bet_types: dict, excel_filename: str, logger, max_workers: int = 20, datetime_map: dict = None):
    """
    Fast scraper for FUTURE matches - collects all to memory, then batch writes
    """
    global RESULTS, PROGRESS
    
    if datetime_map is None:
        datetime_map = {}
    
    # Reset
    RESULTS = []
    PROGRESS = {"done": 0, "total": len(match_ids)}
    
    logger.info(f"🚀 Yeni maçlar taranıyor: {len(match_ids)} maç, {max_workers} worker")
    start_time = datetime.now()
    
    failed = []
    
    # Phase 1: Scrape all matches in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(worker, mid, bookmakers, bet_types, logger, datetime_map.get(mid, '')): mid 
            for mid in match_ids
        }
        
        for future in as_completed(futures):
            mid = futures[future]
            try:
                if not future.result():
                    failed.append(mid)
            except:
                failed.append(mid)
    
    scrape_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"📊 Tarama tamamlandı: {len(RESULTS)} başarılı, {len(failed)} başarısız ({scrape_time:.1f}s)")
    
    # Phase 2: FAST Excel write with pandas
    if RESULTS:
        logger.info(f"📝 Excel'e yazılıyor: {len(RESULTS)} kayıt...")
        write_start = datetime.now()
        
        import pandas as pd
        
        # Column order
        basic_cols = ["ide", "TARİH", "GÜN", "SAAT", "HAFTA", "HAKEM", 
                      "EV SAHİBİ", "DEPLASMAN", "İY", "MS", "İY SONUCU", "MS SONUCU", 
                      "İY-MS", "2.5 ALT ÜST", "3.5 ÜST", "KG VAR/YOK", 
                      "İY 0.5 ALT ÜST", "İY 1.5 ALT ÜST", "ÜLKE", "LİG"]
        
        # Odds order (same as fast_scraper.py)
        odds_order = [
            "opening_{bm}_home", "opening_{bm}_draw", "opening_{bm}_away",
            "{bm}_home", "{bm}_draw", "{bm}_away",
            "opening_{bm}_first_half_home", "opening_{bm}_first_half_draw", "opening_{bm}_first_half_away",
            "{bm}_first_half_home", "{bm}_first_half_draw", "{bm}_first_half_away",
            "opening_{bm}_second_half_home", "opening_{bm}_second_half_draw", "opening_{bm}_second_half_away",
            "{bm}_second_half_home", "{bm}_second_half_draw", "{bm}_second_half_away",
            "opening_{bm}_0.5_over", "opening_{bm}_0.5_under", "{bm}_0.5_over", "{bm}_0.5_under",
            "opening_{bm}_1.5_over", "opening_{bm}_1.5_under", "{bm}_1.5_over", "{bm}_1.5_under",
            "opening_{bm}_2.5_over", "opening_{bm}_2.5_under", "{bm}_2.5_over", "{bm}_2.5_under",
            "opening_{bm}_3.5_over", "opening_{bm}_3.5_under", "{bm}_3.5_over", "{bm}_3.5_under",
            "opening_{bm}_4.5_over", "opening_{bm}_4.5_under", "{bm}_4.5_over", "{bm}_4.5_under",
            "opening_{bm}_5.5_over", "opening_{bm}_5.5_under", "{bm}_5.5_over", "{bm}_5.5_under",
            "opening_{bm}_first_half_0.5_over", "opening_{bm}_first_half_0.5_under",
            "{bm}_first_half_0.5_over", "{bm}_first_half_0.5_under",
            "opening_{bm}_first_half_1.5_over", "opening_{bm}_first_half_1.5_under",
            "{bm}_first_half_1.5_over", "{bm}_first_half_1.5_under",
            "opening_{bm}_+0.5_home", "opening_{bm}_+0.5_away", "{bm}_+0.5_home", "{bm}_+0.5_away",
            "opening_{bm}_-0.5_home", "opening_{bm}_-0.5_away", "{bm}_-0.5_home", "{bm}_-0.5_away",
            "opening_{bm}_+1.5_home", "opening_{bm}_+1.5_away", "{bm}_+1.5_home", "{bm}_+1.5_away",
            "opening_{bm}_-1.5_home", "opening_{bm}_-1.5_away", "{bm}_-1.5_home", "{bm}_-1.5_away",
            "opening_{bm}_yes", "opening_{bm}_no", "{bm}_yes", "{bm}_no",
            "opening_{bm}_first_half_yes", "opening_{bm}_first_half_no",
            "{bm}_first_half_yes", "{bm}_first_half_no",
            "opening_{bm}_home_draw_odds", "opening_{bm}_home_away_odds", "opening_{bm}_away_draw",
            "{bm}_home_draw_odds", "{bm}_home_away_odds", "{bm}_away_draw",
            "opening_{bm}_dnb_home", "opening_{bm}_dnb_away", "{bm}_dnb_home", "{bm}_dnb_away",
            "opening_{bm}_odd", "opening_{bm}_even", "{bm}_odd", "{bm}_even",
        ]
        
        df = pd.DataFrame(RESULTS)
        
        # Convert decimal points to commas for Turkish Excel
        def convert_decimal_to_comma(val):
            if isinstance(val, str) and '.' in val:
                try:
                    float(val)
                    return val.replace('.', ',')
                except ValueError:
                    return val
            return val
        
        bookmaker_names = ["bet365", "betmgm", "betfred", "unibetuk", "betway", "midnite", "ladbrokes", "betfair", "7bet"]
        for col in df.columns:
            col_lower = col.lower()
            if any(bm in col_lower for bm in bookmaker_names):
                df[col] = df[col].apply(convert_decimal_to_comma)
        
        # Bookmaker sheets
        sheets = ["bet365", "BetMGM", "Betfred", "Unibetuk", "Betway", "Midnite", "Ladbrokes", "Betfair", "7Bet"]
        
        with pd.ExcelWriter(excel_filename, engine='xlsxwriter') as writer:
            for sheet_name in sheets:
                bm = sheet_name
                
                ordered_cols = []
                
                for col in basic_cols:
                    if col in df.columns:
                        ordered_cols.append(col)
                
                for pattern in odds_order:
                    col_name = pattern.format(bm=bm)
                    if col_name in df.columns:
                        ordered_cols.append(col_name)
                
                bm_lower = bm.lower()
                for col in df.columns:
                    if bm_lower in col.lower() and col not in ordered_cols:
                        ordered_cols.append(col)
                
                if ordered_cols:
                    sheet_df = df[[c for c in ordered_cols if c in df.columns]]
                    sheet_df.to_excel(writer, sheet_name=sheet_name, index=False, startrow=4)
                    
                    # Turkish column names
                    def turkishify(col_name):
                        tr = col_name
                        
                        translations = [
                            ("_home", " 1"),
                            ("_away", " 2"), 
                            ("_draw", " X"),
                            ("_over", " Üst"),
                            ("_under", " Alt"),
                            ("_yes", " Var"),
                            ("_no", " Yok"),
                            ("_odd", " Tek"),
                            ("_even", " Çift"),
                            ("first_half_", "İY "),
                            ("second_half_", "2Y "),
                            ("_first_half", " İY"),
                            ("_second_half", " 2Y"),
                            ("home_draw_odds", "1X"),
                            ("home_away_odds", "12"),
                            ("away_draw", "X2"),
                            ("dnb_", "GS "),
                        ]
                        for eng, tur in translations:
                            tr = tr.replace(eng, tur)
                        
                        tr = tr.replace("opening_", "AÇ ")
                        
                        for bm_name in ["bet365", "BetMGM", "Betfred", "Unibetuk", "Betway", "Midnite", "Ladbrokes", "Betfair", "7Bet"]:
                            tr = tr.replace(f"{bm_name} ", "")
                            tr = tr.replace(f"{bm_name}_", "")
                        
                        tr = tr.replace("_", " ")
                        while "  " in tr:
                            tr = tr.replace("  ", " ")
                        return tr.strip()
                    
                    ws = writer.sheets[sheet_name]
                    for col_num, col_name in enumerate(sheet_df.columns):
                        turkish_name = turkishify(col_name)
                        ws.write(3, col_num, turkish_name)
        
        write_time = (datetime.now() - write_start).total_seconds()
        logger.info(f"✅ Excel yazımı tamamlandı ({write_time:.1f}s)")
    
    total_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"⏱️ Toplam süre: {total_time:.1f}s")
    
    return failed, RESULTS.copy()
