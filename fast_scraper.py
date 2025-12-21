"""
ULTRA FAST SCRAPER - Collects to memory, writes to Excel at END
No Excel lock contention = 10-20x faster
"""
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup
import re
from datetime import datetime
import threading

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


def fetch_match_details(match_id: str) -> dict:
    """
    Fetch HT score and time from Flashscore df_sui API.
    Returns dict with 'SAAT', 'İY', 'İY SONUCU' keys.
    """
    result = {'SAAT': '', 'İY': '', 'İY SONUCU': ''}
    
    try:
        # Get match events API
        url = f'https://www.flashscore.com/x/feed/df_sui_1_{match_id}'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.flashscore.com/',
            'X-Fsign': 'SW9D1eZo',
        }
        
        resp = SESSION.get(url, headers=headers, timeout=5)
        if resp.status_code != 200:
            return result
        
        raw = resp.text
        if 'IK÷Goal' not in raw:
            return result  # No goals, HT is 0-0
        
        # Parse goals from first half
        # Split by events and track cumulative score
        ht_home = 0
        ht_away = 0
        
        # Find position of 2nd Half marker
        pos_2nd = raw.find('AC÷2nd Half')
        if pos_2nd > 0:
            first_half_data = raw[:pos_2nd]
        else:
            first_half_data = raw  # All data if no 2nd half marker
        
        # Find all goals in first half section
        # Each goal has INX (home cumulative) and IOX (away cumulative)
        import re
        goal_events = re.findall(r'IK÷Goal.*?(?=~|$)', first_half_data)
        
        for goal in goal_events:
            inx = re.search(r'INX÷(\d+)', goal)
            iox = re.search(r'IOX÷(\d+)', goal)
            if inx:
                ht_home = int(inx.group(1))
            if iox:
                ht_away = int(iox.group(1))
        
        if ht_home > 0 or ht_away > 0:
            result['İY'] = f'{ht_home}-{ht_away}'
            if ht_home > ht_away:
                result['İY SONUCU'] = 'İY 1'
            elif ht_away > ht_home:
                result['İY SONUCU'] = 'İY 2'
            else:
                result['İY SONUCU'] = 'İY 0'
    except:
        pass
    
    return result


def scrape_match_data(match_id: str, bookmakers: list, bet_types: dict, logger) -> dict:
    """Scrape summary + odds for a single match - returns dict or None"""
    
    url = f'https://www.flashscore.com/match/{match_id}/'
    
    try:
        # Get summary
        response = SESSION.get(url, timeout=8)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        og_title = soup.select_one('meta[property="og:title"]')
        og_desc = soup.select_one('meta[property="og:description"]')
        description = soup.select_one('meta[name="description"]')
        
        result = {"ide": match_id}
        
        # Parse title
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
            else:
                match = re.match(r'^(.+?)\s+-\s+(.+?)$', title)
                if match:
                    result['EV SAHİBİ'] = match.group(1).strip()
                    result['DEPLASMAN'] = match.group(2).strip()
                else:
                    return None
        else:
            return None
        
        # Parse description
        if og_desc:
            desc = og_desc.get('content', '')
            round_match = re.search(r'Round\s*(\d+)', desc)
            if round_match:
                result['HAFTA'] = round_match.group(1)
            league_match = re.match(r'^([^:]+):\s*(.+?)(?:\s*-\s*Round|\s*$)', desc)
            if league_match:
                result['ÜLKE'] = league_match.group(1).strip()
                result['LİG'] = league_match.group(2).strip()
        
        # Parse date and TIME from description
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
            
            # Extract TIME (SAAT) - format: "16:30" in description
            time_match = re.search(r'(\d{1,2}:\d{2})', desc_text)
            if time_match:
                result['SAAT'] = time_match.group(1)
        
        # İY (Half-Time) score from Flashscore API
        # API endpoint: df_su_1_{match_id} returns match summary with period scores
        # Pattern: API format varies: can be AC÷1st Half¬IH÷{away}¬IG÷{home} or AC÷1st Half¬IG÷{home}¬IH÷{away}
        try:
            api_url = f'https://d.flashscore.com/x/feed/df_su_1_{match_id}'
            api_headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.flashscore.com/',
                'Origin': 'https://www.flashscore.com',
                'x-fsign': 'SW9D1eZo',
            }
            api_response = SESSION.get(api_url, headers=api_headers, timeout=5)
            if api_response.status_code == 200:
                api_text = api_response.text
                # Pattern: AC÷1st Half¬IH÷{away}¬IG÷{home} (order varies, away is IH, home is IG)
                # Try both orderings since API format can vary
                ht_home, ht_away = None, None
                
                # Order 1: IH (away) first, IG (home) second 
                ht_match = re.search(r'AC÷1st Half¬IH÷(\d+)¬IG÷(\d+)', api_text)
                if ht_match:
                    ht_away, ht_home = int(ht_match.group(1)), int(ht_match.group(2))
                else:
                    # Order 2: IG (home) first, IH (away) second
                    ht_match = re.search(r'AC÷1st Half¬IG÷(\d+)¬IH÷(\d+)', api_text)
                    if ht_match:
                        ht_home, ht_away = int(ht_match.group(1)), int(ht_match.group(2))
                
                if ht_home is not None and ht_away is not None:
                    result['İY'] = f'{ht_home}-{ht_away}'
                    if ht_home > ht_away:
                        result['İY SONUCU'] = 'İY 1'
                    elif ht_away > ht_home:
                        result['İY SONUCU'] = 'İY 2'
                    else:
                        result['İY SONUCU'] = 'İY 0'
                    # Calculate İY-MS
                    if result.get('MS SONUCU'):
                        iy_code = result['İY SONUCU'].replace('İY ', '')
                        ms_code = result['MS SONUCU'].replace('MS ', '')
                        result['İY-MS'] = f"İY {iy_code}/MS {ms_code}"
                    
                    # İY 0.5 ALT/ÜST ve İY 1.5 ALT/ÜST hesapla
                    iy_total = ht_home + ht_away
                    result['İY 0.5 ALT ÜST'] = '0,5 ÜST' if iy_total > 0.5 else '0,5 ALT'
                    result['İY 1.5 ALT ÜST'] = '1,5 ÜST' if iy_total > 1.5 else '1,5 ALT'
        except:
            pass  # İY will be empty if API fails
        
        
        # Defaults
        for key in ['SAAT', 'İY', 'HAFTA', 'SEZON', 'İY SONUCU', 'MS SONUCU', 'İY-MS', 
                    '2.5 ALT ÜST', '3.5 ÜST', 'KG VAR/YOK', 'İY 0.5 ALT ÜST', 'İY 1.5 ALT ÜST']:
            result.setdefault(key, '')
        
        # Get odds (fast)
        odds = fetch_odds_fast(match_id, bookmakers, bet_types)
        result.update(odds)
        
        return result
        
    except Exception as e:
        return None


def fetch_odds_fast(event_id: str, bookmakers: list, bet_types: dict) -> dict:
    """Fast odds fetch"""
    from config import API_URL, BOOKMAKER_MAPPING
    
    api_url = f"{API_URL}?_hash=oce&eventId={event_id}&projectId=5&geoIpCode=US&geoIpSubdivisionCode=USCA"
    headers = {"Origin": "https://www.flashscore.com", "Referer": "https://www.flashscore.com/"}
    
    try:
        response = SESSION.get(api_url, headers=headers, timeout=8)
        if response.status_code == 200:
            data = response.json()
            from common_scraper import parse_odds_data
            all_odds = {}
            for bm in bookmakers:
                bm_id = BOOKMAKER_MAPPING.get(bm)
                if bm_id:
                    all_odds.update(parse_odds_data(data, bm, bm_id, bet_types))
            return all_odds
    except:
        pass
    return {}


def worker(match_id: str, bookmakers: list, bet_types: dict, logger, datetime_str: str = ''):
    """
    Single worker - scrapes and adds to RESULTS list
    datetime_str: Pre-extracted datetime like "15.12. 20:00" from listing page
    """
    global RESULTS, PROGRESS
    
    start = datetime.now()
    data = scrape_match_data(match_id, bookmakers, bet_types, logger)
    elapsed = (datetime.now() - start).total_seconds()
    
    # Apply pre-extracted datetime (SAAT) if available
    if data and datetime_str:
        # Parse datetime_str: "15.12. 20:00" -> SAAT = "20:00"
        import re
        time_match = re.search(r'(\d{1,2}:\d{2})', datetime_str)
        if time_match:
            data['SAAT'] = time_match.group(1)
        # Also can extract date parts if needed: "15.12." -> day=15, month=12
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
        
        if done % 10 == 0 or done == total:
            logger.info(f"✅ [{done}/{total}] {match_id} ({elapsed:.1f}s)")
        return True
    else:
        if done % 10 == 0:
            logger.warning(f"❌ [{done}/{total}] {match_id}")
        return False


def run_threaded_scraper(match_ids: list, bookmakers: list, bet_types: dict, excel_filename: str, logger, max_workers: int = 30, datetime_map: dict = None):
    """
    ULTRA FAST: Scrape all to memory, then batch write to Excel
    datetime_map: Optional dict {match_id: "15.12. 20:00"} for pre-extracted datetime
    """
    global RESULTS, PROGRESS
    
    if datetime_map is None:
        datetime_map = {}
    
    # Reset
    RESULTS = []
    PROGRESS = {"done": 0, "total": len(match_ids)}
    
    logger.info(f"🚀 Hızlı tarama: {len(match_ids)} maç, {max_workers} worker, {len(datetime_map)} datetime")
    start_time = datetime.now()
    
    failed = []
    
    # Phase 1: Scrape all matches in parallel (NO EXCEL WRITES!)
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
    
    # Phase 2: FAST Excel write with pandas - Column order based on mapping.py
    if RESULTS:
        logger.info(f"📝 Excel'e yazılıyor: {len(RESULTS)} kayıt (pandas - mapping sırası)...")
        write_start = datetime.now()
        
        import pandas as pd
        
        # Column order from mapping.py (same as TEMPLATE_FLASHSCORE.xlsx)
        basic_cols = ["ide", "TARİH", "GÜN", "SAAT", "HAFTA", "HAKEM", 
                      "EV SAHİBİ", "DEPLASMAN", "İY", "MS", "İY SONUCU", "MS SONUCU", 
                      "İY-MS", "2.5 ALT ÜST", "3.5 ÜST", "KG VAR/YOK", 
                      "İY 0.5 ALT ÜST", "İY 1.5 ALT ÜST", "ÜLKE", "LİG"]
        
        # Odds column order from mapping.py (proper structure)
        # 1X2 Full Time: opening_home, opening_draw, opening_away, home, draw, away
        # 1X2 First Half: opening_first_half_home, etc.
        # Over/Under: opening_0.5_over, opening_0.5_under, 0.5_over, 0.5_under, etc.
        
        odds_order = [
            # 1X2 FULL TIME (AÇILIŞ + KAPANIŞ)
            "opening_{bm}_home", "opening_{bm}_draw", "opening_{bm}_away",
            "{bm}_home", "{bm}_draw", "{bm}_away",
            # 1X2 FIRST HALF
            "opening_{bm}_first_half_home", "opening_{bm}_first_half_draw", "opening_{bm}_first_half_away",
            "{bm}_first_half_home", "{bm}_first_half_draw", "{bm}_first_half_away",
            # 1X2 SECOND HALF  
            "opening_{bm}_second_half_home", "opening_{bm}_second_half_draw", "opening_{bm}_second_half_away",
            "{bm}_second_half_home", "{bm}_second_half_draw", "{bm}_second_half_away",
            # OVER/UNDER (0.5 - 5.5)
            "opening_{bm}_0.5_over", "opening_{bm}_0.5_under", "{bm}_0.5_over", "{bm}_0.5_under",
            "opening_{bm}_1.5_over", "opening_{bm}_1.5_under", "{bm}_1.5_over", "{bm}_1.5_under",
            "opening_{bm}_2.5_over", "opening_{bm}_2.5_under", "{bm}_2.5_over", "{bm}_2.5_under",
            "opening_{bm}_3.5_over", "opening_{bm}_3.5_under", "{bm}_3.5_over", "{bm}_3.5_under",
            "opening_{bm}_4.5_over", "opening_{bm}_4.5_under", "{bm}_4.5_over", "{bm}_4.5_under",
            "opening_{bm}_5.5_over", "opening_{bm}_5.5_under", "{bm}_5.5_over", "{bm}_5.5_under",
            # FIRST HALF OVER/UNDER
            "opening_{bm}_first_half_0.5_over", "opening_{bm}_first_half_0.5_under",
            "{bm}_first_half_0.5_over", "{bm}_first_half_0.5_under",
            "opening_{bm}_first_half_1.5_over", "opening_{bm}_first_half_1.5_under",
            "{bm}_first_half_1.5_over", "{bm}_first_half_1.5_under",
            "opening_{bm}_first_half_2.5_over", "opening_{bm}_first_half_2.5_under",
            "{bm}_first_half_2.5_over", "{bm}_first_half_2.5_under",
            # ASIAN HANDICAP
            "opening_{bm}_+0.5_home", "opening_{bm}_+0.5_away", "{bm}_+0.5_home", "{bm}_+0.5_away",
            "opening_{bm}_-0.5_home", "opening_{bm}_-0.5_away", "{bm}_-0.5_home", "{bm}_-0.5_away",
            "opening_{bm}_+1.5_home", "opening_{bm}_+1.5_away", "{bm}_+1.5_home", "{bm}_+1.5_away",
            "opening_{bm}_-1.5_home", "opening_{bm}_-1.5_away", "{bm}_-1.5_home", "{bm}_-1.5_away",
            # BTTS
            "opening_{bm}_yes", "opening_{bm}_no", "{bm}_yes", "{bm}_no",
            "opening_{bm}_first_half_yes", "opening_{bm}_first_half_no",
            "{bm}_first_half_yes", "{bm}_first_half_no",
            # DOUBLE CHANCE
            "opening_{bm}_home_draw_odds", "opening_{bm}_home_away_odds", "opening_{bm}_away_draw",
            "{bm}_home_draw_odds", "{bm}_home_away_odds", "{bm}_away_draw",
            # DNB
            "opening_{bm}_dnb_home", "opening_{bm}_dnb_away", "{bm}_dnb_home", "{bm}_dnb_away",
            # ODD/EVEN
            "opening_{bm}_odd", "opening_{bm}_even", "{bm}_odd", "{bm}_even",
            # HT/FT
            "opening_{bm}_1/1_odd", "opening_{bm}_1/X_odd", "opening_{bm}_1/2_odd",
            "opening_{bm}_X/1_odd", "opening_{bm}_X/X_odd", "opening_{bm}_X/2_odd",
            "opening_{bm}_2/1_odd", "opening_{bm}_2/X_odd", "opening_{bm}_2/2_odd",
            # CORRECT SCORE
            "opening_{bm}_1:0_odd", "opening_{bm}_2:0_odd", "opening_{bm}_2:1_odd",
            "opening_{bm}_3:0_odd", "opening_{bm}_3:1_odd", "opening_{bm}_3:2_odd",
            "opening_{bm}_0:0_odd", "opening_{bm}_1:1_odd", "opening_{bm}_2:2_odd",
            "opening_{bm}_0:1_odd", "opening_{bm}_0:2_odd", "opening_{bm}_1:2_odd",
        ]
        
        df = pd.DataFrame(RESULTS)
        
        # Convert decimal points to commas for Turkish Excel compatibility
        # This allows Excel calculations (SUM, AVERAGE, etc.) to work correctly
        def convert_decimal_to_comma(val):
            if isinstance(val, str) and '.' in val:
                # Check if it looks like a number (e.g., "1.50", "2.75")
                try:
                    float(val)
                    return val.replace('.', ',')
                except ValueError:
                    return val
            return val
        
        # Apply to all odds columns (columns containing bookmaker names)
        bookmaker_names = ["bet365", "betmgm", "betfred", "unibetuk", "betway", "midnite", "ladbrokes", "betfair", "7bet"]
        for col in df.columns:
            col_lower = col.lower()
            if any(bm in col_lower for bm in bookmaker_names):
                df[col] = df[col].apply(convert_decimal_to_comma)
        
        # Bookmaker sheets
        sheets = ["bet365", "BetMGM", "Betfred", "Unibetuk", "Betway", "Midnite", "Ladbrokes", "Betfair", "7Bet"]
        
        # Turkish column name translator
        def turkishify(col_name):
            """Convert English column names to Turkish - MUST match all_columns.txt format"""
            # Basic columns that are already in Turkish - don't modify
            basic_turkish = ['ide', 'TARİH', 'GÜN', 'SAAT', 'HAFTA', 'EV SAHİBİ', 'DEPLASMAN', 
                           'İY', 'MS', 'İY SONUCU', 'MS SONUCU', 'İY-MS', '2.5 ALT ÜST', 
                           '3.5 ÜST', 'KG VAR/YOK', 'İY 0.5 ALT ÜST', 'İY 1.5 ALT ÜST', 
                           'ÜLKE', 'LİG', 'YIL', 'AY', 'SEZON', 'GÜN ADI', 
                           'HOME PARTICIPANT ID', 'AWAY PARTICIPANT ID']
            if col_name in basic_turkish:
                return col_name
            
            tr = col_name
            
            translations = [
                ("_home", " 1"), ("_away", " 2"), ("_draw", " X"),
                ("_over", " Üst"), ("_under", " Alt"),
                ("_yes", " Var"), ("_no", " Yok"),
                ("_odd", " Tek"), ("_even", " Çift"),
                ("first_half_", "İY "), ("second_half_", "2Y "),
                ("_first_half", " İY"), ("_second_half", " 2Y"),
                ("home_draw_odds", "1X"), ("home_away_odds", "12"), ("away_draw", "X2"),
            ]
            for eng, tur in translations:
                tr = tr.replace(eng, tur)
            
            tr = tr.replace("opening_", "AÇ ")
            
            for bm_name in ["bet365", "BetMGM", "Betfred", "Unibetuk", "Betway", "Midnite", "Ladbrokes", "Betfair", "7Bet"]:
                tr = tr.replace(f"{bm_name} ", "")
                tr = tr.replace(f"{bm_name}_", "")
            
            tr = tr.replace("_", " ")
            
            # Convert dots in numbers to spaces to match template (0.5 -> 0 5)
            # Only for odds columns, not basic columns
            tr = tr.replace(".", " ")
            
            while "  " in tr:
                tr = tr.replace("  ", " ")
            return tr.strip()
        
        # Note: turkishify is now applied per-sheet AFTER bookmaker filtering
        # STEP 2: Load FIXED 763 column template (THIS IS THE MASTER ORDER)
        import os
        template_path = os.path.join(os.path.dirname(__file__), 'all_columns.txt')
        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                FIXED_COLUMNS = [line.strip() for line in f if line.strip()]
            logger.info(f"📋 Sabit şablon yüklendi: {len(FIXED_COLUMNS)} kolon")
        except Exception as e:
            FIXED_COLUMNS = None
            logger.warning(f"⚠️ all_columns.txt yüklenemedi: {e}")
        
        with pd.ExcelWriter(excel_filename, engine='xlsxwriter') as writer:
            for sheet_name in sheets:
                bm = sheet_name  # bookmaker name
                
                if FIXED_COLUMNS:
                    # Use FIXED 763 columns template for ALL sheets
                    # Step 1: Build translation map for this bookmaker's columns
                    # Map: Turkish column name -> Original English column name
                    tr_to_eng = {}
                    
                    # For this bookmaker's columns, apply turkishify and save mapping
                    bm_lower = bm.lower()
                    for col in df.columns:
                        # Check if this column belongs to this bookmaker or is a basic column
                        if col in basic_cols:
                            tr_to_eng[col] = col
                        elif bm_lower in col.lower():
                            turkish_name = turkishify(col)
                            tr_to_eng[turkish_name] = col
                    
                    # Step 2: Build DataFrame with template columns (VECTORIZED - FAST!)
                    # Create empty DataFrame with template columns
                    template_data = {}
                    for template_col in FIXED_COLUMNS:
                        if template_col in tr_to_eng:
                            # Found matching column - copy entire column at once
                            eng_col = tr_to_eng[template_col]
                            if eng_col in df.columns:
                                template_data[template_col] = df[eng_col].values
                            else:
                                template_data[template_col] = ['-'] * len(df)
                        else:
                            # No matching data - fill with zeros
                            template_data[template_col] = ['-'] * len(df)
                    
                    sheet_df = pd.DataFrame(template_data, columns=FIXED_COLUMNS)
                    sheet_df = sheet_df.fillna('-')
                    
                else:
                    # Fallback - dynamic columns
                    ordered_eng_cols = []
                    for col in basic_cols:
                        if col in df.columns:
                            ordered_eng_cols.append(col)
                    bm_lower = bm.lower()
                    for col in df.columns:
                        if bm_lower in col.lower() and col not in ordered_eng_cols:
                            ordered_eng_cols.append(col)
                    sheet_df = df[[c for c in ordered_eng_cols if c in df.columns]].copy()
                    sheet_df.columns = [turkishify(c) for c in sheet_df.columns]
                    sheet_df = sheet_df.fillna('-')
                
                # Write to Excel
                sheet_df.to_excel(writer, sheet_name=sheet_name, index=False, startrow=4)
                
                # Write headers at row 4
                ws = writer.sheets[sheet_name]
                for col_num, col_name in enumerate(sheet_df.columns):
                    ws.write(3, col_num, col_name)
        
        write_time = (datetime.now() - write_start).total_seconds()
        logger.info(f"✅ Excel yazımı tamamlandı ({write_time:.1f}s) - {len(RESULTS)/max(write_time, 0.1):.0f} kayıt/s")
    
    total_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"⏱️ Toplam süre: {total_time:.1f}s ({len(match_ids)/max(total_time,1):.1f} maç/s)")
    
    # Return both failed list AND results for team analysis
    return failed, RESULTS.copy()

