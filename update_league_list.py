import asyncio
from playwright.async_api import async_playwright
import json
from utils import get_logger

logger = get_logger(__name__)

async def update_league_list():
    async with async_playwright() as p:
        # Creating browser
        try:
            browser = await p.chromium.launch(headless = False)
            page = await browser.new_page()
            logger.info("Tarayıcı Açıldı.")
        except Exception as e:
            logger.critical(f"Tarayıcı açılmadı. KUR.bat dosyasını çalıştırın. Hata: {e}")

        base_url = "https://www.flashscore.co.uk"

        try:
            await page.goto(base_url)
            logger.info("Siteye bağlanıldı.")
        except Exception as e:
            logger.critical(f"Siteye bağlanılamadı. Hata: {e}")

        # Wait for to complete loading of website
        try:
            await page.wait_for_selector("div.lmc__menu")
            await page.wait_for_selector("div.lmc__block")
            await page.wait_for_selector("span.lmc__elementName")
            await page.wait_for_selector("span.lmc__itemMore")
            logger.info("Site yüklendi.")
        except Exception as e:
            logger.critical(f"Site yüklenemedi. Hata: {e}")

        # Clicking show more leagues button
        try:
            await page.locator("div.lmc__menu").locator("span.lmc__itemMore").click()
            await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Bütün ülkeler yüklenemedi. Daha fazla göster butonuna tıklanamadı. Hata: {e}")

        # Choosing all countries
        try:
            countries = await page.locator("div.lmc__menu").locator("div.lmc__block").all()
            league_info = [] # Storing the league info dict
            print(f"Ülkelere ulaşıldı. Toplam {len(countries)} kadar ülkeden veri çekilecek. Ligler aranıyor...")
        except Exception as e:
            logger.critical(f"Ülkelere ulaşılamadı. Hata: {e}")



        # Main loop for iterating countries
        for c, country in enumerate(countries):
            try:
                await country.click()
                await asyncio.sleep(0.25)
                countries_new = await page.locator("div.lmc__menu").locator("div.lmc__block").all()
                selected_country = countries_new[c]

                country_name = await selected_country.locator("a.lmc__element span.lmc__elementName").text_content()
                leagues = await selected_country.locator("span.lmc__template").all()

                logger.info(f"{country_name} ülkesinden {len(leagues)} adet lig verisi çekilecek.")
            except Exception as e:
                logger.warning(f"Ülkeye erişilmedi bu ülke atlanıyor. Index: {c} Hata: {e}")
                continue

            # Iterating leagues inside the country
            try:
                for l, league in enumerate(leagues):
                    league_url = await league.locator("a.lmc__templateHref").get_attribute("href")
                    league_name = await league.locator("a.lmc__templateHref").text_content()

                    # Creating dict for storing league info
                    league_element = {
                        "country": country_name,
                        "league": league_name,
                        "league_url": f"{base_url}{league_url}"
                    }
                    league_info.append(league_element)

                    logger.info(f"{country_name} - {league_name} lig listesine eklendi. {l+1}/{len(leagues)}")
            except Exception as e :
                logger.warning(f"{country_name} - 1 adet lig verisine erişilemedi atlanıyor. Index: {l} Hata: {e}")
                continue

            logger.info(f"{country_name} ülkesindeki ligler listesi eklendi. {c+1}/{len(countries)}")

        logger.info("Tüm ligler listesi güncellendi.")
        logger.info("Lig listesi dosyası oluşturuluyor...")

        # Save the league list
        with open("league_list.json", "w", encoding="utf-8") as f:
            json.dump(league_info, f, indent=4)

        logger.info("league_list.json dosyası oluşturuldu.")


# For test

if __name__ == "__main__":
    try:
        with open("league_list.json", "r", encoding="utf-8") as f:
            league_list = json.load(f)
            print(len(league_list))
        asyncio.run(update_league_list())
    except Exception as e:
        logger.error(e)

