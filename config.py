import time

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from utils import get_logger

logger = get_logger(__name__)

BOOKMAKER_MAPPING = {
    "bet365": 16 ,      # ✅ Zaten doğru
    "BetMGM": 707,      # ✅ Zaten doğru
    "Betfred": 21 ,      # ✅ Zaten doğru
    "Unibetuk": 625,      # ✅ Zaten doğru
    "Betway": 26 ,      # ✅ Zaten doğru
    "Midnite": 841,      # ✅ Zaten doğru
    "Ladbrokes": 28 ,      # ✅ Zaten doğru
    "7Bet": 895,      # ✅ Zaten doğru
    "Betfair": 429,      # ✅ Zaten doğru
    "BetUK": 263      # ✅ Zaten doğru
}

# Tüm mevcut bet tipleri (API response'ından alınan gerçek değerler)
ALL_BET_TYPES = {
    "1x2": "HOME_DRAW_AWAY",
    "over-under": "OVER_UNDER",
    "asian-handicap": "ASIAN_HANDICAP", 
    "both-teams-to-score": "BOTH_TEAMS_TO_SCORE",
    "double-chance": "DOUBLE_CHANCE",
    "draw-no-bet": "DRAW_NO_BET",
    "ht-ft": "HALF_FULL_TIME",
    "correct-score": "CORRECT_SCORE",
    "odd-even": "ODD_OR_EVEN",
    "european-handicap": "EUROPEAN_HANDICAP"
}

# Hangi bet tiplerinin çekileceğini seç (True/False) - Hızı artırmak için
BET_TYPE_SELECTION = {
    "1x2": True,
    "over-under": True,
    "asian-handicap": True,
    "both-teams-to-score": True,
    "double-chance": True,
    "draw-no-bet": True,
    "ht-ft": True,
    "correct-score": True,
    "odd-even": True,
    "european-handicap": True
}

# Aktif bet tiplerini filtrele
BET_TYPE_MAPPING = {k: v for k, v in ALL_BET_TYPES.items() if BET_TYPE_SELECTION.get(k, False)}
BET_SCOPE_MAPPING = {
    "full-time": "FULL_TIME",
    "1st-half": "FIRST_HALF",
    "2nd-half": "SECOND_HALF"
}

API_URL = "https://global.ds.lsapp.eu/odds/pq_graphql"

def get_driver(headless: bool = True, user_agent: str = None, referer: str = None) -> webdriver.Chrome:
    logger.info("Scraper başlatılıyor...")

    options = Options()

    if headless:
        options.add_argument("--headless=new")

    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")

    if user_agent:
        options.add_argument(f"user-agent={user_agent}")
    else:
        options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
            "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
        )

    service = Service()

    driver = webdriver.Chrome(service=service, options=options)

    if referer:
        driver.execute_cdp_cmd(
            'Network.enable',
            {}
        )
        driver.execute_cdp_cmd(
            'Network.setExtraHTTPHeaders',
            {
                'headers': {
                    'Referer': referer
                }
            }
        )

    logger.info("Sürücü oluşturuldu.")

    return driver

def wait_for_element(driver, selector: str, by=By.CSS_SELECTOR, timeout=10):
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_all_elements_located((by, selector))
    )

def consent_cookies(driver: webdriver, url: str):
    try:
        time.sleep(5)

        try:
            banner = driver.find_element(By.ID, "onetrust-banner-sdk")
            button = banner.find_element(By.ID, "onetrust-accept-btn-handler")
            if button:
                button.click()
        except Exception as e:
            logger.error(f"Çerez kabul etme işlemi yapılamadı! url: {url}\nHata: {e}")

        try:
            button = driver.find_element(By.CLASS_NAME, "wcl-onboardingTooltip_ZK-fP").find_element(By.CLASS_NAME, "wcl-onboardingFooter_dczV-").find_element(By.TAG_NAME, "button")

            if button:
                button.click()

        except Exception as e:
            logger.error(f"Yeni pencere bilgi penceresine tıklanırken bir hata oluştu! url: {url}\nHata: {e}")

    except Exception as e:
        logger.error(f"URL Bağlantısı sağlanamadı! {e}")