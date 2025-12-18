import logging
import sys
import os
import io

from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

import time

# Windows terminal UTF-8 encoding fix
if sys.platform == 'win32':
    try:
        # Set console output encoding to UTF-8
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass  # Already wrapped or not available


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)  # INFO seviyesinde logla (daha az verbose)

    # Format belirle
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Console handler (terminalde de gor)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)  # Console'da sadece INFO ve ustu

    # File handler (log dosyasina da yaz)
    file_handler = logging.FileHandler("scraper.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.DEBUG)  # Dosyada tum detaylar

    # Handler'lari logger'a ekle
    if not logger.handlers:
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

    return logger


def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)


def get_user_data_path(relative_path):
    """Get path for user data (config, output), always in current working directory"""
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


def set_decimal(driver: webdriver, url: str):
    try:
        time.sleep(1)
        settings_button = driver.find_element(By.ID, "hamburger-menu").find_element(By.CLASS_NAME, "header__button")

        if settings_button:
            settings_button.click()

            button = driver.find_element(By.CLASS_NAME, "contextMenu__row")

            if button:
                button.click()

                decimal_button = driver.find_element(By.ID, "oddsFormatSettings").find_elements(By.TAG_NAME, "label")[1].find_element(By.CLASS_NAME, "radioButton__button")

                if decimal_button:
                    decimal_button.click()
    except Exception as e:
        logging.error(f"Oran tipi donusumu uygulanamadi. {e}")


from selenium.common.exceptions import TimeoutException, WebDriverException


def safe_driver_get(driver, url, timeout=20, retries=10, wait_between_retries=3):
    """
    Selenium driver.get() icin guvenli istek fonksiyonu.

    - driver: aktif selenium webdriver objesi
    - url: gidilecek adres
    - timeout: her denemede maksimum bekleme suresi (saniye)
    - retries: deneme sayisi
    - wait_between_retries: hata sonrasi bekleme suresi (saniye)
    """
    driver.set_page_load_timeout(timeout)

    for attempt in range(1, retries + 1):
        try:
            print(f"[*] Attempt {attempt}/{retries} - URL: {url}")
            driver.get(url)
            return True  # Success
        except TimeoutException:
            print(f"[!] Timeout: {url} - calling window.stop()...")
            driver.execute_script("window.stop();")
        except WebDriverException as e:
            print(f"[!] WebDriverException: {e}")
            driver.execute_script("window.stop();")
        except Exception as e:
            print(f"[!] General Error ({url}): {e}")

        time.sleep(wait_between_retries)

    print(f"[x] URL could not be loaded: {url}")
    return False  # Failed