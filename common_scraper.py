import asyncio
import httpx
import json
import re
from playwright.async_api import Page
from bs4 import BeautifulSoup
from datetime import datetime
from utils import get_logger
from config import BOOKMAKER_MAPPING, BET_TYPE_MAPPING, BET_SCOPE_MAPPING, API_URL
from failed_matches_manager import add_failed_match, remove_successful_match

logger = get_logger(__name__)

# HTTP headers for browser simulation
HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

async def scrape_summary_http(match_id: str, client: httpx.AsyncClient = None) -> dict:
    """
    Pure HTTP scraper - NO BROWSER NEEDED! 6-10x faster than Playwright.
    Extracts match data from HTML meta tags.
    
    Returns dict matching Excel format: TARİH, GÜN, AY, YIL, GÜN_ADI, SAAT, HAFTA, SEZON, ÜLKE, LİG, EV SAHİBİ, DEPLASMAN, MS, İY
    """
    url = f'https://www.flashscore.com/match/{match_id}/'
    
    try:
        if client:
            response = await client.get(url, headers=HTTP_HEADERS, follow_redirects=True, timeout=30)
        else:
            async with httpx.AsyncClient() as temp_client:
                response = await temp_client.get(url, headers=HTTP_HEADERS, follow_redirects=True, timeout=30)
        
        if response.status_code != 200:
            logger.warning(f"HTTP {response.status_code} for {match_id}")
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract from meta tags
        og_title = soup.select_one('meta[property="og:title"]')
        og_desc = soup.select_one('meta[property="og:description"]')
        description = soup.select_one('meta[name="description"]')
        
        result = {}
        
        # Parse og:title: 'Midtjylland - Brondby 0:1'
        if og_title:
            title = og_title.get('content', '')
            # Pattern with score: 'Team1 - Team2 Score1:Score2'
            match = re.match(r'^(.+?)\s+-\s+(.+?)\s+(\d+):(\d+)$', title)
            if match:
                result['EV SAHİBİ'] = match.group(1).strip()
                result['DEPLASMAN'] = match.group(2).strip()
                home_score = match.group(3)
                away_score = match.group(4)
                result['MS'] = f"{home_score}-{away_score}"
            else:
                # Pattern without score
                match = re.match(r'^(.+?)\s+-\s+(.+?)$', title)
                if match:
                    result['EV SAHİBİ'] = match.group(1).strip()
                    result['DEPLASMAN'] = match.group(2).strip()
                    result['MS'] = ''
        
        # Parse og:description: 'DENMARK: Superliga - Round 5'
        if og_desc:
            desc = og_desc.get('content', '')
            round_match = re.search(r'Round\s*(\d+)', desc)
            if round_match:
                result['HAFTA'] = round_match.group(1)
            
            league_match = re.match(r'^([^:]+):\s*(.+?)(?:\s*-\s*Round|\s*$)', desc)
            if league_match:
                result['ÜLKE'] = league_match.group(1).strip()
                result['LİG'] = league_match.group(2).strip()
        
        # Parse description for date: 'Follow Team v Team DD/MM/YYYY ...'
        if description:
            desc = description.get('content', '')
            date_match = re.search(r'(\d{2})/(\d{2})/(\d{4})', desc)
            if date_match:
                day = date_match.group(1)
                month = date_match.group(2)
                year = date_match.group(3)
                result['TARİH'] = f"{day}.{month}.{year}"
                result['GÜN'] = day
                result['AY'] = month
                result['YIL'] = year
                
                # Calculate day of week
                from datetime import datetime
                try:
                    date_obj = datetime.strptime(f"{day}/{month}/{year}", "%d/%m/%Y")
                    gun_adlari = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
                    result['GÜN_ADI'] = gun_adlari[date_obj.weekday()]
                    
                    # Calculate season
                    if date_obj.month >= 8:
                        result['SEZON'] = f"{date_obj.year}-{date_obj.year+1}"
                    else:
                        result['SEZON'] = f"{date_obj.year-1}-{date_obj.year}"
                except:
                    pass
        
        # Default empty values for missing fields
        result.setdefault('SAAT', '')
        result.setdefault('İY', '')
        result.setdefault('HAFTA', '')
        result.setdefault('SEZON', '')
        
        # Calculate derived fields from MS score
        ms = result.get('MS', '')
        if ms and '-' in ms:
            try:
                h_s, a_s = [int(x) for x in ms.split('-')]
                
                # MS SONUCU
                if h_s > a_s:
                    result['MS SONUCU'] = 'MS 1'
                elif a_s > h_s:
                    result['MS SONUCU'] = 'MS 2'
                else:
                    result['MS SONUCU'] = 'MS 0'
                
                # 2.5 ALT ÜST
                total = h_s + a_s
                result['2.5 ALT ÜST'] = '2.5 ÜST' if total > 2.5 else '2.5 ALT'
                
                # 3.5 ÜST
                result['3.5 ÜST'] = '3.5 ÜST' if total > 3.5 else '3.5 ALT'
                
                # KG VAR/YOK
                result['KG VAR/YOK'] = 'KG VAR' if (h_s > 0 and a_s > 0) else 'KG YOK'
                
            except:
                pass
        
        # İY fields (will be empty since HTTP doesn't have half-time data)
        result.setdefault('İY SONUCU', '')
        result.setdefault('MS SONUCU', '')
        result.setdefault('İY-MS', '')
        result.setdefault('2.5 ALT ÜST', '')
        result.setdefault('3.5 ÜST', '')
        result.setdefault('KG VAR/YOK', '')
        result.setdefault('İY 0.5 ALT ÜST', '')
        result.setdefault('İY 1.5 ALT ÜST', '')
        
        # Validate minimum required fields
        if 'EV SAHİBİ' in result and 'DEPLASMAN' in result:
            return result
        else:
            return None
            
    except httpx.TimeoutException:
        logger.error(f"TIMEOUT for {match_id}")
        return None
    except httpx.ConnectError:
        logger.error(f"CONNECTION ERROR for {match_id}")
        return None
    except Exception as e:
        logger.error(f"HTTP error for {match_id}: {type(e).__name__}")
        return None



def get_league_country_from_config():
    """Config.json'dan ülke ve lig bilgilerini çeker."""
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        
        ligler = config_data.get('ligler', [])
        if ligler:
            # İlk lige odaklan (birden fazla varsa ilkini al)
            first_league = ligler[0]
            # "Algeria - Ligue 1" formatından ülke ve lig adını ayır
            if ' - ' in first_league:
                country, league = first_league.split(' - ', 1)
                return country.strip(), league.strip()
            else:
                return "Unknown", first_league
        
        return "Unknown", "Unknown"
    except Exception as e:
        logger.warning(f"Config.json'dan lig bilgisi alınamadı: {e}")
        return "Unknown", "Unknown"

async def block_agressive(route):
    """Resim, font, medya ve gereksiz kaynakları engeller."""
    if route.request.resource_type in ["image", "media", "font", "stylesheet"]:
        await route.abort()
    else:
        await route.continue_()

async def scrape_summary_page(page: Page, match_id: str, max_retries: int = 3):
    """
    Scrapes the summary page of a match to get basic info.
    This still requires Playwright because the summary data is not in the odds API.
    Includes retry logic for better reliability.
    """
    url = f"https://www.flashscore.com/match/{match_id}/#/match-summary"
    
    for attempt in range(1, max_retries + 1):
        try:
            # Optimized navigation: wait for commit only, then wait for selector
            # This is much faster than waiting for full domcontentloaded
            await page.goto(url, timeout=30000, wait_until="commit")
            
            # Wait for the main content - this is the real indicator
            await page.wait_for_selector('div.duelParticipant', timeout=30000)
            # Wait for score details
            # await page.wait_for_selector('div.detailScore__wrapper', timeout=20000) # Optional/Secondary
            
            # Small delay to ensure JS rendering is complete
            # await page.wait_for_timeout(100)
            await page.wait_for_timeout(150)
            break  # Success, exit retry loop
            
        except Exception as e:
            if attempt < max_retries:
                wait_time = attempt * 2  # Exponential backoff: 2s, 4s, 6s
                logger.warning(f"[Retry {attempt}/{max_retries}] Match {match_id}: {str(e)[:50]}... waiting {wait_time}s")
                await page.wait_for_timeout(wait_time * 1000)
            else:
                logger.error(f"Could not load summary page for {match_id} after {max_retries} attempts: {e}")
                return {}

    html = await page.content()
    soup = BeautifulSoup(html, "lxml")
    
    try:
        data = {}
        # Web sayfasından ülke ve lig bilgilerini breadcrumb'dan almaya çalış
        country, league = "", ""
        breadcrumbs = soup.select('[data-testid="wcl-breadcrumbsItem"] a')
        
        if len(breadcrumbs) >= 3:
            # Genelde: 1. Spor (Football), 2. Ülke (England), 3. Lig (Premier League)
            country = breadcrumbs[1].text.strip()
            league = breadcrumbs[2].text.strip()
            # Lig isminde bazen " - Round X" gibi ekler olabilir, temizleyelim
            if " - " in league:
                league = league.split(" - ")[0]
        
        # Eğer breadcrumb'dan alınamazsa eski yöntemi dene (yedek)
        if not country or not league:
            country_element = soup.select_one('span.tournamentHeader__country a')
            if country_element:
                country = country_element.text.strip()
            
            league_element = soup.select_one('span.tournamentHeader__country ~ a')
            if league_element:
                league = league_element.text.strip()
        
        # Eğer hala alınamazsa config'den al
        if not country or not league:
            config_country, config_league = get_league_country_from_config()
            country = country or config_country
            league = league or config_league
        
        home_team_element = soup.select_one('div.duelParticipant__home a.participant__participantName')
        home_team = home_team_element.text.strip() if home_team_element else ""

        away_team_element = soup.select_one('div.duelParticipant__away a.participant__participantName')
        away_team = away_team_element.text.strip() if away_team_element else ""
        
        start_time_div = soup.select_one('div.duelParticipant__startTime div')
        date_str, time_str = "", ""
        if start_time_div:
            parts = start_time_div.text.strip().split(' ')
            if len(parts) >= 2:
                date_str, time_str = parts[0], parts[1]

        # Tarih verilerini ayrıştır
        gun, ay, yil = "", "", ""
        day_of_week = ""
        if date_str:
            try:
                # 02.05.2024 formatından gün, ay, yıl çıkar
                parts = date_str.split('.')
                if len(parts) == 3:
                    gun = parts[0].zfill(2)  # 2 -> 02
                    ay = parts[1].zfill(2)   # 5 -> 05  
                    yil = parts[2]           # 2024
                
                date_obj = datetime.strptime(date_str, "%d.%m.%Y")
                day_english = date_obj.strftime('%A')
                
                # İngilizce günleri Türkçeye çevir
                day_turkish_mapping = {
                    "Monday": "Pazartesi",
                    "Tuesday": "Salı", 
                    "Wednesday": "Çarşamba",
                    "Thursday": "Perşembe",
                    "Friday": "Cuma",
                    "Saturday": "Cumartesi",
                    "Sunday": "Pazar"
                }
                day_of_week = day_turkish_mapping.get(day_english, day_english)
                
            except ValueError:
                logger.warning(f"Could not parse date: {date_str}")

        home_score_element = soup.select_one('div.detailScore__wrapper span:nth-child(1)')
        home_score = home_score_element.text.strip() if home_score_element else ""

        away_score_element = soup.select_one('div.detailScore__wrapper span:nth-child(3)')
        away_score = away_score_element.text.strip() if away_score_element else ""

        def is_valid_ht_score(s):
            """Helper to check if a string is a plausible half-time score."""
            return s and '-' in s and any(c.isdigit() for c in s)

        ht_score_raw = ""

        # Strategy 1: Find the specific data-testid element (most reliable)
        ht_score_span = soup.select_one('span[data-testid="wcl-scores-overline-02"] div')
        if ht_score_span:
            potential_score = ht_score_span.text.strip()
            if is_valid_ht_score(potential_score):
                ht_score_raw = potential_score

        # Strategy 2: Find "Half Time" summary element
        if not ht_score_raw:
            ht_score_element = soup.find('div', class_='smh__template', string=lambda t: t and 'Half Time' in t)
            if ht_score_element:
                next_sibling = ht_score_element.find_next_sibling('div')
                if next_sibling:
                    potential_score = next_sibling.text.strip()
                    if is_valid_ht_score(potential_score):
                        ht_score_raw = potential_score

        # Strategy 3: Find score in parentheses next to the main score
        if not ht_score_raw:
            score_wrapper = soup.select_one("div.detailScore__wrapper")
            if score_wrapper:
                parent_container = score_wrapper.find_parent('div')
                if parent_container:
                    sibling = parent_container.find_next_sibling('div')
                    if sibling and sibling.text.strip().startswith('('):
                        potential_score = sibling.text.strip().replace('(', '').replace(')', '')
                        if is_valid_ht_score(potential_score):
                            ht_score_raw = potential_score

        ht_score = ht_score_raw.replace("HT: ", "").strip()

        # Hafta bilgisini "Round X" formatından çek
        week = ""
        
        # Yeni breadcrumb yapısından Round bilgisini çek
        # İlk strateji: data-testid="wcl-scores-overline-03" içerisinde Round arayalım
        breadcrumb_elements = soup.select('[data-testid="wcl-scores-overline-03"]')
        
        for element in breadcrumb_elements:
            element_text = element.text.strip()
            if "Round" in element_text:
                round_part = element_text.split("Round")[-1].strip()
                import re
                match = re.search(r'(\d+)', round_part)
                if match:
                    week = match.group(1)
                    break
        
        if not week:
            breadcrumb_container = soup.select_one('.detail__breadcrumbs')
            if breadcrumb_container:
                all_text = breadcrumb_container.get_text()
                if "Round" in all_text:
                    import re
                    match = re.search(r'Round\s*(\d+)', all_text)
                    if match:
                        week = match.group(1)

        # Sezon bilgisini yıldan çıkar (2024-2025 sezonu için 2024 yılında başladı)
        season = ""
        if date_str:
            try:
                date_obj = datetime.strptime(date_str, "%d.%m.%Y")
                year = date_obj.year
                # Sezonlar genelde Ağustos'ta başlar, Haziran'da biter
                if date_obj.month >= 8:  # Ağustos-Aralık 
                    season = f"{year}-{year+1}"
                else:  # Ocak-Temmuz
                    season = f"{year-1}-{year}"
            except ValueError:
                pass
                
        # Calculate derived data
        iy_sonucu, ms_sonucu, iy_ms, alt_ust_2_5, ust_3_5, kg_var_yok, iy_alt_ust_0_5, iy_alt_ust_1_5 = [""] * 8
        
        if home_score and away_score:
            h_s, a_s = int(home_score), int(away_score)
            ms_sonucu = "MS 1" if h_s > a_s else "MS 2" if a_s > h_s else "MS 0"
            alt_ust_2_5 = "2.5 ÜST" if (h_s + a_s) > 2.5 else "2.5 ALT"
            ust_3_5 = "3.5 ÜST" if (h_s + a_s) > 3.5 else "3.5 ALT"
            kg_var_yok = "KG VAR" if h_s > 0 and a_s > 0 else "KG YOK"

        if ht_score and '-' in ht_score:
            try:
                ht_h_s, ht_a_s = [int(x.strip()) for x in ht_score.split('-')]
                iy_sonucu = "İY 1" if ht_h_s > ht_a_s else "İY 2" if ht_a_s > ht_h_s else "İY 0"
                iy_alt_ust_0_5 = "İY 0.5 ÜST" if (ht_h_s + ht_a_s) > 0.5 else "İY 0.5 ALT"
                iy_alt_ust_1_5 = "İY 1.5 ÜST" if (ht_h_s + ht_a_s) > 1.5 else "İY 1.5 ALT"
                if iy_sonucu and ms_sonucu:
                    iy_ms = f"{iy_sonucu.replace(' ', '')}/{ms_sonucu.replace(' ', '')}"
            except (ValueError, IndexError):
                logger.warning(f"Could not parse half-time score components from '{ht_score}' for match {match_id}")

        data = {
            "TARİH": date_str,
            "GÜN": gun,              # 02 (gün sayısı) - C sütunu
            "AY": ay,                # 05 (ay sayısı) - D sütunu
            "YIL": yil,              # 2024 (yıl) - E sütunu
            "GÜN_ADI": day_of_week,  # Pazartesi (Türkçe gün adı) - F sütunu
            "SAAT": time_str,        # G sütunu
            "HAFTA": week,           # H sütunu
            "SEZON": season,         # I sütunu
            "ÜLKE": country,         # J sütunu
            "LİG": league,           # K sütunu
            "EV SAHİBİ": home_team,
            "DEPLASMAN": away_team,
            "MATCH_ID": match_id,
            "MS": f"{home_score}-{away_score}" if home_score and away_score else "",
            "İY": ht_score,
            "İY SONUCU": iy_sonucu,
            "MS SONUCU": ms_sonucu,
            "İY-MS": iy_ms,
            "2.5 ALT ÜST": alt_ust_2_5,
            "3.5 ÜST": ust_3_5,
            "KG VAR/YOK": kg_var_yok,
            "İY 0.5 ALT ÜST": iy_alt_ust_0_5,
            "İY 1.5 ALT ÜST": iy_alt_ust_1_5,
        }
        return data
    except Exception as e:
        logger.error(f"Error parsing summary for match {match_id}: {e}")
        return {}

def _get_api_url(event_id):
    """Helper to create the API URL with proper parameters."""
    return f"{API_URL}?_hash=oce&eventId={event_id}&projectId=5&geoIpCode=US&geoIpSubdivisionCode=USCA"

# Shared headers for all API requests
API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.flashscore.com",
    "Referer": "https://www.flashscore.com/"
}

async def fetch_odds_single_call(client: httpx.AsyncClient, event_id: str, bookmakers: list, bet_types: dict = None) -> dict:
    """
    OPTIMIZED: Fetches odds data with SINGLE API call per match.
    The API returns ALL bookmaker data in one response - no need for separate calls!
    This is 5-10x faster than calling once per bookmaker.
    """
    api_url = _get_api_url(event_id)
    max_retries = 3  # Reduced retries since we're not doing exponential backoff
    
    for attempt in range(max_retries):
        try:
            response = await client.get(api_url, headers=API_HEADERS, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Parse ALL bookmakers from single response
                all_odds = {}
                for bookmaker_name in bookmakers:
                    bookmaker_id = BOOKMAKER_MAPPING.get(bookmaker_name)
                    if bookmaker_id:
                        bookmaker_odds = parse_odds_data(data, bookmaker_name, bookmaker_id, bet_types)
                        all_odds.update(bookmaker_odds)
                
                return all_odds
                
            elif response.status_code >= 500 and attempt < max_retries - 1:
                await asyncio.sleep(0.5 * (attempt + 1))  # Short backoff
                continue
            else:
                logger.warning(f"Odds API failed for {event_id}: HTTP {response.status_code}")
                return {}
                
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(0.5)
                continue
            logger.error(f"Odds fetch error for {event_id}: {e}")
            return {}
    
    return {}



async def fetch_odds_for_bookmaker(client: httpx.AsyncClient, event_id: str, bookmaker_name: str, bookmaker_id: int, bet_types: dict = None):
    """Fetches all available odds for a single bookmaker for a given match using the new API format."""
    import asyncio
    
    api_url = _get_api_url(event_id)
    max_retries = 5  # Increased retries
    
    # Base headers to mimic browser request
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://www.flashscore.com",
        "Referer": "https://www.flashscore.com/"
    }
    
    for attempt in range(max_retries):
        try:
            # Rate limiting - increase backoff
            if attempt > 0:
                await asyncio.sleep(1 + (3 ** attempt))  # Exponential backoff: 4s, 10s, 28s...
            
            response = await client.get(api_url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                parsed_odds = parse_odds_data(data, bookmaker_name, bookmaker_id, bet_types)
                return parsed_odds
            elif response.status_code == 500 and attempt < max_retries - 1:
                logger.warning(f"API 500 error for {event_id}/{bookmaker_name}, retrying... (attempt {attempt + 1}/{max_retries})")
                continue
            else:
                logger.error(f"API request failed for {event_id}/{bookmaker_name}: {response.status_code}")
                # Son denemeyse failed match olarak kaydet
                if attempt == max_retries - 1:
                    add_failed_match(event_id, "API_ERROR", f"HTTP {response.status_code}", [bookmaker_name])
                return {}
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Request failed for {event_id}/{bookmaker_name}, retrying... (attempt {attempt + 1}/{max_retries}): {e}")
                continue
            else:
                logger.error(f"Request failed for {event_id}/{bookmaker_name}: {e}")
                # Son denemeyse failed match olarak kaydet
                add_failed_match(event_id, "EXCEPTION", str(e), [bookmaker_name])
                return {}
    
    return {}

def parse_odds_data(response_data: dict, bookmaker: str, bookmaker_id: int, bet_types: dict = None) -> dict:
    """Parses the JSON response from the new API format into a flat dictionary consistent with excel_writer."""
    
    odds_data = {}
    
    # Convert config.json bet_types to API format
    if bet_types is None or not bet_types:
        from config import BET_TYPE_MAPPING
        active_bet_types = list(BET_TYPE_MAPPING.values())
    else:
        from config import ALL_BET_TYPES
        active_bet_types = [ALL_BET_TYPES[k] for k, v in bet_types.items() if v and k in ALL_BET_TYPES]
    
    # Store participant IDs for Asian Handicap logic
    participant_ids = []

    # Bahis türlerini zamana göre gruplamak için yeni yapı
    odds_by_scope = {
        "full_time": [],
        "first_half": [],
        "second_half": []
    }

    try:
        # Get the odds data from the new API response structure
        find_odds = response_data.get('data', {}).get('findOddsByEventId', {})
        event_odds_list = find_odds.get('odds', [])
        if not event_odds_list:
            return {}

        # Filter odds for this specific bookmaker
        bookmaker_entries = [odds for odds in event_odds_list if odds.get('bookmakerId') == bookmaker_id]
        
        for odds_entry in bookmaker_entries:

            betting_type = odds_entry.get('bettingType')
            betting_scope = odds_entry.get('bettingScope')
            odds_items = odds_entry.get('odds', [])

            # Oranları zaman kapsamına göre grupla
            if betting_scope == "FULL_TIME":
                odds_by_scope["full_time"].append(odds_entry)
            elif betting_scope == "FIRST_HALF":
                odds_by_scope["first_half"].append(odds_entry)
            elif betting_scope == "SECOND_HALF":
                odds_by_scope["second_half"].append(odds_entry)
            
            # ✅ SADECE AKTİF BET TİPLERİNİ İŞLE
            if betting_type not in active_bet_types:
                logger.debug(f"Skipping {betting_type} for {bookmaker} (not in active bet types)")
                continue

            # Varsayılan scope ataması yap, scopeless bet type'lar için çökmesin
            if not betting_scope:
                betting_scope = "FULL_TIME"

            # Parse HOME_DRAW_AWAY (1x2) using eventParticipantId logic
            if betting_type == "HOME_DRAW_AWAY":
                # Bu bet tipi full_time için scope prefix'i kullanmaz
                prefix = f"{bookmaker}_"
                if betting_scope == "FIRST_HALF":
                    prefix = f"{bookmaker}_first_half_"
                elif betting_scope == "SECOND_HALF":
                    prefix = f"{bookmaker}_second_half_"

                # Group by participant ID to identify correct positions
                home_item = None
                away_item = None
                draw_item = None
                
                # ✅ API'deki sıralamayı kullan - ilk gelen ev sahibi, ikinci deplasman
                participant_order = []
                for item in odds_items:
                    participant_id = item.get('eventParticipantId')
                    if participant_id and participant_id not in participant_order:
                        participant_order.append(participant_id)
                
                # Store participant IDs for Asian Handicap use
                if not participant_ids and participant_order:
                    participant_ids.extend(participant_order)
                    if len(participant_ids) >= 2:
                        odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
                        odds_data['AWAY_PARTICIPANT_ID'] = participant_ids[1]
                    elif len(participant_ids) == 1:
                        odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
                
                for item in odds_items:
                    participant_id = item.get('eventParticipantId')
                    
                    if participant_id is None:
                        # null participant = Draw
                        draw_item = item
                    elif len(participant_order) >= 2:
                        if participant_id == participant_order[0]:
                            # İlk sıradaki participant = Home
                            home_item = item
                        elif participant_id == participant_order[1]:
                            # İkinci sıradaki participant = Away
                            away_item = item
                    elif len(participant_order) == 1:
                        # Sadece bir participant varsa, ev sahibi kabul et
                        if participant_id == participant_order[0]:
                            home_item = item
                
                # Write odds data
                if home_item:
                    odds_data[f"opening_{prefix}home"] = home_item.get('opening')
                    odds_data[f"{prefix}home"] = home_item.get('value')
                
                if draw_item:
                    odds_data[f"opening_{prefix}draw"] = draw_item.get('opening')
                    odds_data[f"{prefix}draw"] = draw_item.get('value')
                
                if away_item:
                    odds_data[f"opening_{prefix}away"] = away_item.get('opening')
                    odds_data[f"{prefix}away"] = away_item.get('value')
            
            # Parse OVER_UNDER using handicap.value and selection
            elif betting_type == "OVER_UNDER":
                # Bu bet tipi full_time için scope prefix'i kullanmaz
                prefix = f"{bookmaker}_"
                if betting_scope == "FIRST_HALF":
                    prefix = f"{bookmaker}_first_half_"
                elif betting_scope == "SECOND_HALF":
                    prefix = f"{bookmaker}_second_half_"

                for item in odds_items:
                    handicap_obj = item.get('handicap', {})
                    handicap_value = handicap_obj.get('value') if handicap_obj else None
                    selection_type = item.get('selection')
                    
                    if handicap_value is not None and selection_type:
                        # Format handicap value (e.g., "0.5" -> "0_5")
                        formatted_handicap = str(handicap_value).replace('.', '_').replace('-', 'minus_').replace('+', 'plus_')
                        key_suffix = f"{formatted_handicap}_{selection_type.lower()}"
                        odds_data[f"opening_{prefix}{key_suffix}"] = item.get('opening')
                        odds_data[f"{prefix}{key_suffix}"] = item.get('value')
            
            # Parse ASIAN_HANDICAP using handicap.value and eventParticipantId
            elif betting_type == "ASIAN_HANDICAP":
                # Bu bet tipi veriyi farklı bir yapıda toplar, bu blokta prefix kullanmaz
                
                # ✅ API'deki sıralamayı kullan - ilk gelen ev sahibi, ikinci deplasman
                participant_order = []
                for item in odds_items:
                    participant_id = item.get('eventParticipantId')
                    if participant_id and participant_id not in participant_order:
                        participant_order.append(participant_id)
                
                # Eğer ana participant_ids listesi boşsa, bu bet türünden doldur
                if not participant_ids and participant_order:
                    participant_ids.extend(participant_order)
                    if len(participant_ids) >= 2:
                        odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
                        odds_data['AWAY_PARTICIPANT_ID'] = participant_ids[1]
                    elif len(participant_ids) == 1:
                        odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
                
                # Processed handicap-participant combinations to avoid duplicates
                processed_combinations = set()
                
                for item in odds_items:
                    if not item.get('active', True):
                        continue
                        
                    handicap_obj = item.get('handicap', {})
                    handicap_value = handicap_obj.get('value') if handicap_obj else None
                    participant_id = item.get('eventParticipantId')
                    
                    if handicap_value is not None and participant_id:
                        # Takım adını belirle
                        home_id = odds_data.get('HOME_PARTICIPANT_ID')
                        away_id = odds_data.get('AWAY_PARTICIPANT_ID')

                        team_suffix = ""
                        if participant_id == home_id:
                            team_suffix = "home"
                        elif participant_id == away_id:
                            team_suffix = "away"
                        else:
                            continue # Bu ID ne ev sahibi ne de deplasman, atla
                        
                        is_away = (team_suffix == "away")
                        
                        # Deplasman takımı için, handikap 0.0 DEĞİLSE değeri tersine çevir.
                        # 0.0 handikapı olduğu gibi kalır.
                        if is_away and float(handicap_value) != 0.0:
                            target_handicap = str(-float(handicap_value))
                        else:
                            target_handicap = handicap_value
                        
                        # Anahtar için handikap formatı
                        formatted_handicap = str(target_handicap).replace('.', '_').replace('-', 'minus_')
                        
                        # Kapsam için prefix
                        prefix = f"{bookmaker}_"
                        if betting_scope == "FIRST_HALF":
                            prefix = f"{bookmaker}_first_half_"
                        
                        key_suffix = f"ah_{formatted_handicap}_{team_suffix}"
                        odds_data[f"opening_{prefix}{key_suffix}"] = item.get('opening')
                        odds_data[f"{prefix}{key_suffix}"] = item.get('value')

            # Parse BOTH_TEAMS_TO_SCORE using bothTeamsToScore field
            elif betting_type == "BOTH_TEAMS_TO_SCORE":
                # Bu bet tipi full_time için scope prefix'i kullanmaz
                prefix = f"{bookmaker}_"
                if betting_scope == "FIRST_HALF":
                    prefix = f"{bookmaker}_first_half_"
                elif betting_scope == "SECOND_HALF":
                    prefix = f"{bookmaker}_second_half_"

                for item in odds_items:
                    # Skip inactive items
                    if not item.get('active', True):
                        continue
                        
                    btts_value = item.get('bothTeamsToScore')
                    if btts_value is not None:
                        # Add key format (scope is already in prefix)
                        key_suffix = f"btts_{str(btts_value).lower()}"
                        
                        odds_data[f"opening_{prefix}{key_suffix}"] = item.get('opening')
                        odds_data[f"{prefix}{key_suffix}"] = item.get('value')
            
            # Parse DRAW_NO_BET using eventParticipantId (both home and away have IDs)
            elif betting_type == "DRAW_NO_BET":
                # Bu bet tipi full_time için scope prefix'i KULLANMAZ
                prefix = f"{bookmaker}_"
                if betting_scope == "FIRST_HALF":
                    prefix = f"{bookmaker}_first_half_"
                elif betting_scope == "SECOND_HALF":
                    prefix = f"{bookmaker}_second_half_"

                # ✅ API'deki sıralamayı kullan - ilk gelen ev sahibi, ikinci deplasman
                participant_order = []
                for item in odds_items:
                    participant_id = item.get('eventParticipantId')
                    if participant_id and participant_id not in participant_order:
                        participant_order.append(participant_id)

                # Eğer ana participant_ids listesi boşsa, bu bet türünden doldur
                if not participant_ids and participant_order:
                    participant_ids.extend(participant_order)
                    if len(participant_ids) >= 2:
                        odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
                        odds_data['AWAY_PARTICIPANT_ID'] = participant_ids[1]
                    elif len(participant_ids) == 1:
                        odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
                
                for item in odds_items:
                    # Skip inactive items
                    if not item.get('active', True):
                        continue
                        
                    participant_id = item.get('eventParticipantId')
                    
                    team_suffix = ""
                    if participant_id and len(participant_order) >= 2:
                        if participant_id == participant_order[0]:
                            team_suffix = "home"
                        elif participant_id == participant_order[1]:
                            team_suffix = "away"
                        else:
                            continue
                    elif participant_id and len(participant_order) == 1:
                        team_suffix = "home"
                    else:
                        continue

                    # Add key format (scope is already in prefix)
                    key_suffix = f"dnb_{team_suffix}"
                    
                    odds_data[f"opening_{prefix}{key_suffix}"] = item.get('opening')
                    odds_data[f"{prefix}{key_suffix}"] = item.get('value')
            
            # Parse DOUBLE_CHANCE using eventParticipantId
            elif betting_type == "DOUBLE_CHANCE":
                # Bu bet tipi full_time için scope prefix'i kullanmaz
                prefix = f"{bookmaker}_"
                if betting_scope == "FIRST_HALF":
                    prefix = f"{bookmaker}_first_half_"
                elif betting_scope == "SECOND_HALF":
                    prefix = f"{bookmaker}_second_half_"

                # ✅ API'deki sıralamayı kullan - ilk gelen ev sahibi, ikinci deplasman
                participant_order = []
                for item in odds_items:
                    participant_id = item.get('eventParticipantId')
                    if participant_id and participant_id not in participant_order:
                        participant_order.append(participant_id)
                
                # Eğer ana participant_ids listesi boşsa, bu bet türünden doldur
                if not participant_ids and participant_order:
                    participant_ids.extend(participant_order)
                    if len(participant_ids) >= 2:
                        odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
                        odds_data['AWAY_PARTICIPANT_ID'] = participant_ids[1]
                    elif len(participant_ids) == 1:
                        odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
                
                for item in odds_items:
                    # Skip inactive items
                    if not item.get('active', True):
                        continue
                        
                    participant_id = item.get('eventParticipantId')
                    
                    # Determine Double Chance type based on participant ID
                    # API'den gelen sıralama: null=X2, first_participant=1X, second_participant=12
                    dc_type = ""
                    if participant_id is None:
                        dc_type = "X2"  # Beraberlik VEYA deplasman kazanır
                    elif len(participant_order) >= 2:
                        if participant_id == participant_order[0]:
                            dc_type = "1X"  # Ev sahibi kazanır VEYA beraberlik
                        elif participant_id == participant_order[1]:
                            dc_type = "12"  # Ev sahibi kazanır VEYA deplasman kazanır
                        else:
                            continue
                    elif len(participant_order) == 1:
                        dc_type = "1X"
                    else:
                        continue
                    
                    # Add key format (scope is already in prefix)
                    key_suffix = f"dc_{dc_type}"
                    
                    odds_data[f"opening_{prefix}{key_suffix}"] = item.get('opening')
                    odds_data[f"{prefix}{key_suffix}"] = item.get('value')
                    
            
            # Parse EUROPEAN_HANDICAP using handicap.value and eventParticipantId
            elif betting_type == "EUROPEAN_HANDICAP":
                # Kapsam için prefix
                prefix = f"{bookmaker}_"
                if betting_scope == "FIRST_HALF":
                    prefix = f"{bookmaker}_first_half_"

                # Takım ID'lerini al
                home_id = odds_data.get('HOME_PARTICIPANT_ID')
                away_id = odds_data.get('AWAY_PARTICIPANT_ID')
                
                for item in odds_items:
                    if not item.get('active', True):
                        continue
                        
                    handicap_obj = item.get('handicap', {})
                    handicap_value = handicap_obj.get('value') if handicap_obj else None
                    participant_id = item.get('eventParticipantId')

                    if handicap_value is not None:
                        # Takım adını belirle (home, away, draw)
                        team_suffix = ""
                        is_home = participant_id == home_id
                        is_away = participant_id == away_id
                        is_draw = participant_id is None

                        if is_home: team_suffix = "home"
                        elif is_away: team_suffix = "away"
                        elif is_draw: team_suffix = "draw"
                        else: continue

                        # Deplasman için handikapı çevir
                        target_handicap = handicap_value if is_home or is_draw else str(-float(handicap_value))

                        # Anahtar için handikap formatı (+1 -> plus1, -1 -> minus1)
                        handicap_float = float(target_handicap)
                        handicap_key = ""
                        if handicap_float > 0:
                            handicap_key = f"plus{int(handicap_float)}"
                        else:
                            handicap_key = f"minus{abs(int(handicap_float))}"

                        key_suffix = f"eh_{handicap_key}_{team_suffix}"
                        odds_data[f"opening_{prefix}{key_suffix}"] = item.get('opening')
                        odds_data[f"{prefix}{key_suffix}"] = item.get('value')
            
            # Parse ODD_OR_EVEN using selection field
            elif betting_type == "ODD_OR_EVEN":
                # Bu bet tipi full_time için scope prefix'i KULLANMAZ, diğerleri kullanır
                prefix = f"{bookmaker}_" # Varsayılan (full_time için)
                if betting_scope == "FIRST_HALF":
                    prefix = f"{bookmaker}_first_half_"
                elif betting_scope == "SECOND_HALF":
                    prefix = f"{bookmaker}_second_half_"

                for item in odds_items:
                    # Skip inactive items
                    if not item.get('active', True):
                        continue
                        
                    selection = item.get('selection')
                    if selection:
                        key_suffix = selection.lower()
                        odds_data[f"opening_{prefix}{key_suffix}"] = item.get('opening')
                        odds_data[f"{prefix}{key_suffix}"] = item.get('value')
            
            # Parse CORRECT_SCORE using score field (scope-aware)
            elif betting_type == "CORRECT_SCORE":
                # Bu bet tipi full_time için 'full_time' prefix'i KULLANIR
                prefix = f"{bookmaker}_full_time_"
                if betting_scope == "FIRST_HALF":
                    prefix = f"{bookmaker}_first_half_"
                elif betting_scope == "SECOND_HALF":
                    prefix = f"{bookmaker}_second_half_"

                for item in odds_items:
                    # Skip inactive items
                    if not item.get('active', True):
                        continue
                        
                    score = item.get('score')
                    if score:
                        # Format score (e.g., "3:1" -> "3_1")
                        formatted_score = str(score).replace(':', '_').replace('/', '_').replace('-', '_')
                        
                        # Add key format (scope is already in prefix)
                        key_suffix = formatted_score
                        
                        odds_data[f"opening_{prefix}{key_suffix}"] = item.get('opening')
                        odds_data[f"{prefix}{key_suffix}"] = item.get('value')
            
            # Parse HALF_FULL_TIME (always full-time regardless of scope)
            elif betting_type == "HALF_FULL_TIME":
                # Bu bet tipinin scope'u olmaz, kendi özel anahtarını oluşturur
                for item in odds_items:
                    # Skip inactive items
                    if not item.get('active', True):
                        continue
                    
                    winner = item.get('winner')
                    if winner:
                        # Format winner "1/1" -> "1_1", "X/1" -> "X_1"
                        formatted_winner = str(winner).replace('/', '_')
                        
                        # Key format is always full-time
                        key_prefix = f"{bookmaker}_" # No scope prefix needed
                        key_suffix = f"ht_ft_{formatted_winner}"

                        odds_data[f"opening_{key_prefix}{key_suffix}"] = item.get('opening')
                        odds_data[f"{key_prefix}{key_suffix}"] = item.get('value')
                        

            
    except (KeyError, TypeError, IndexError) as e:
        logger.debug(f"Could not parse data for {bookmaker}: {e}")
    
    # ESKİ GRUPLAMA MANTIĞI KALDIRILDI - Artık gerek yok
    # Asian Handicap verilerini `excel_writer`'ın beklediği formata getir
    # if config.BET_TYPE_SELECTION.get("asian-handicap"): ...
    # European Handicap verilerini `excel_writer`'ın beklediği formata getir
    # if config.BET_TYPE_SELECTION.get("european-handicap"): ...

    # Add participant IDs to odds_data for Asian Handicap logic - ARTIK GEREKLİ DEĞİL, YUKARI TAŞINDI
    # if len(participant_ids) >= 2:
    #     odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
    #     odds_data['AWAY_PARTICIPANT_ID'] = participant_ids[1]
    # elif len(participant_ids) == 1:
    #     odds_data['HOME_PARTICIPANT_ID'] = participant_ids[0]
    
    return odds_data

async def fetch_all_odds_data(event_id: str, bookmakers: list, bet_types: dict = None) -> dict:
    """Fetches all odds data for a given match from the API for all specified bookmakers."""
    import asyncio
    
    async with httpx.AsyncClient(http2=False, timeout=60) as client:  # Timeout artırıldı
        tasks = []
        for bookmaker_name in bookmakers:
            bookmaker_id = BOOKMAKER_MAPPING.get(bookmaker_name)
            if bookmaker_id:
                tasks.append(fetch_odds_for_bookmaker(client, event_id, bookmaker_name, bookmaker_id, bet_types))
            else:
                logger.warning(f"Bookmaker '{bookmaker_name}' not found in BOOKMAKER_MAPPING.")
        
        # All bookmaker data comes from single API call - no rate limiting needed
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
    final_odds = {}
    has_data = False
    
    for res in results:
        if isinstance(res, dict):
            final_odds.update(res)
            if res:  # Eğer boş dict değilse
                has_data = True
        elif isinstance(res, Exception):
            logger.error(f"An error occurred during bookmaker odds fetching: {res}")
    
    # Eğer hiç veri alınamadıysa failed match olarak kaydet
    if not has_data or not final_odds:
        add_failed_match(event_id, "NO_DATA", "No odds data retrieved from any bookmaker", bookmakers)
        logger.warning(f"Match {event_id} failed - no data from any bookmaker")
    else:
        # Başarılı olduğu için failed listesinden çıkar (varsa)
        remove_successful_match(event_id)
            
    return final_odds