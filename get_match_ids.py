#!/usr/bin/env python3
"""
Match ID'leri almak için farklı yöntemler
"""
import asyncio
import httpx
import json
import re
from datetime import datetime, timedelta
from playwright.async_api import async_playwright
from utils import get_logger

logger = get_logger(__name__)

class MatchIDCollector:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.flashscore.co.uk/'
        }

    async def method_1_from_api_calls(self):
        """
        Yöntem 1: Mevcut API çağrılarından match ID'leri topla
        - Çalışan maç ID'lerinden API responses'larda başka ID'ler arayabiliriz
        """
        logger.info("🔍 Yöntem 1: API responses'dan match ID'leri toplama...")
        
        known_ids = ["SS3W5yS8", "SzMTfjaE", "2HAOuQoD", "pYP9mZXF", "Sbvsb71s"]
        found_ids = set()
        
        async with httpx.AsyncClient(timeout=30, headers=self.headers) as client:
            for match_id in known_ids:
                try:
                    # FlashScore API'dan data çek
                    api_url = f"https://global.ds.lsapp.eu/odds/pq_graphql?_hash=oce&eventId={match_id}&projectId=5&geoIpCode=US&geoIpSubdivisionCode=USCA"
                    response = await client.get(api_url)
                    
                    if response.status_code == 200:
                        content = response.text
                        # Response'da gizli match ID'leri ara
                        patterns = [
                            r'"eventId":"([A-Za-z0-9]{8})"',
                            r'eventId[":=\s]*([A-Za-z0-9]{8})',
                            r'matchId[":=\s]*([A-Za-z0-9]{8})',
                            r'"id":"([A-Za-z0-9]{8})"'
                        ]
                        
                        for pattern in patterns:
                            matches = re.findall(pattern, content)
                            found_ids.update(matches)
                            
                except Exception as e:
                    logger.debug(f"API error for {match_id}: {e}")
        
        found_ids.discard(match_id)  # Aynısını çıkar
        logger.info(f"✅ Yöntem 1: {len(found_ids)} yeni ID bulundu: {list(found_ids)[:5]}...")
        return list(found_ids)

    async def method_2_network_monitoring(self):
        """
        Yöntem 2: FlashScore'da network trafiğini izle
        - Sayfayı açıp API çağrılarını yakala
        """
        logger.info("🕵️ Yöntem 2: Network monitoring ile ID toplama...")
        
        found_ids = set()
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Network isteklerini izle
            api_calls = []
            
            async def handle_response(response):
                if 'flashscore' in response.url or 'lsapp.eu' in response.url:
                    try:
                        if response.status == 200:
                            content = await response.text()
                            if len(content) > 100:  # Gerçek API response
                                api_calls.append({
                                    'url': response.url,
                                    'content': content[:500]  # İlk 500 karakter
                                })
                    except:
                        pass
            
            page.on('response', handle_response)
            
            # FlashScore ana sayfaya git
            try:
                await page.goto("https://www.flashscore.co.uk/", timeout=30000)
                await asyncio.sleep(5)  # Network trafiğini bekle
                
                # Bugünün sonuçlarına git
                today = datetime.now().strftime("%Y-%m-%d")
                await page.goto(f"https://www.flashscore.co.uk/results/{today}/", timeout=30000)
                await asyncio.sleep(5)
                
            except Exception as e:
                logger.warning(f"Sayfa yüklenme hatası: {e}")
            
            await browser.close()
            
            # API calls'ları analiz et
            for call in api_calls:
                patterns = [
                    r'"eventId":"([A-Za-z0-9]{8})"',
                    r'g_1_([A-Za-z0-9]{8})',
                    r'eventId[":=\s]*([A-Za-z0-9]{8})'
                ]
                
                for pattern in patterns:
                    matches = re.findall(pattern, call['content'])
                    found_ids.update(matches)
        
        logger.info(f"✅ Yöntem 2: {len(found_ids)} ID bulundu network'ten")
        return list(found_ids)

    async def method_3_flashscore_feed_api(self):
        """
        Yöntem 3: FlashScore'un feed API'sini dene
        - Farklı endpoint'leri test et
        """
        logger.info("📡 Yöntem 3: FlashScore feed API'si deneniyor...")
        
        found_ids = set()
        today = datetime.now()
        
        # Farklı date formatları
        dates = [
            today.strftime("%Y%m%d"),          # 20250118
            today.strftime("%Y-%m-%d"),        # 2025-01-18
            today.strftime("%d-%m-%Y"),        # 18-01-2025
        ]
        
        # Test edilecek endpoint'ler
        endpoints = [
            "https://d.flashscore.com/x/feed/f_{date}",
            "https://d.flashscore.com/x/feed/dt_{date}",
            "https://www.flashscore.co.uk/x/feed/f_{date}",
        ]
        
        async with httpx.AsyncClient(timeout=30, headers=self.headers) as client:
            for endpoint_template in endpoints:
                for date_str in dates:
                    endpoint = endpoint_template.format(date=date_str)
                    try:
                        response = await client.get(endpoint)
                        if response.status_code == 200:
                            content = response.text
                            if len(content) > 50:
                                logger.info(f"✅ API endpoint çalışıyor: {endpoint}")
                                
                                # Match ID'leri extract et
                                patterns = [
                                    r'~AA¬([A-Za-z0-9]{8})¬',
                                    r'g_1_([A-Za-z0-9]{8})',
                                    r'"eventId":"([A-Za-z0-9]{8})"'
                                ]
                                
                                for pattern in patterns:
                                    matches = re.findall(pattern, content)
                                    found_ids.update(matches)
                                    
                    except Exception as e:
                        logger.debug(f"Endpoint failed: {endpoint} - {e}")
        
        logger.info(f"✅ Yöntem 3: {len(found_ids)} ID bulundu feed API'den")
        return list(found_ids)

    async def method_4_minimal_dom_scraping(self):
        """
        Yöntem 4: Minimal DOM scraping (sadece match ID'leri için)
        - Old/future main'deki gibi ama sadece ID toplama
        """
        logger.info("🎯 Yöntem 4: Minimal DOM scraping...")
        
        found_ids = set()
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Son 3 günün tarihlerini test et
            for days_back in range(3):
                date = datetime.now() - timedelta(days=days_back)
                date_str = date.strftime("%Y-%m-%d")
                url = f"https://www.flashscore.co.uk/results/{date_str}/"
                
                try:
                    await page.goto(url, timeout=30000)
                    await asyncio.sleep(2)
                    
                    # Match elementlerini bul
                    match_elements = await page.locator("div[id*='g_1_']").all()
                    
                    for element in match_elements:
                        try:
                            element_id = await element.get_attribute("id")
                            if element_id and "g_1_" in element_id:
                                match_id = element_id.split("_")[-1]
                                if len(match_id) == 8:  # FlashScore ID format
                                    found_ids.add(match_id)
                        except:
                            continue
                            
                except Exception as e:
                    logger.debug(f"DOM scraping error for {date_str}: {e}")
            
            await browser.close()
        
        logger.info(f"✅ Yöntem 4: {len(found_ids)} ID bulundu DOM'dan")
        return list(found_ids)

async def collect_all_match_ids():
    """Tüm yöntemleri dene ve birleştir"""
    collector = MatchIDCollector()
    
    logger.info("🚀 Match ID toplama başlıyor...")
    
    all_methods = [
        collector.method_1_from_api_calls(),
        collector.method_2_network_monitoring(), 
        collector.method_3_flashscore_feed_api(),
        collector.method_4_minimal_dom_scraping()
    ]
    
    # Tüm yöntemleri paralel çalıştır
    results = await asyncio.gather(*all_methods, return_exceptions=True)
    
    # Sonuçları birleştir
    all_ids = set()
    for i, result in enumerate(results):
        if isinstance(result, list):
            all_ids.update(result)
            logger.info(f"Yöntem {i+1}: {len(result)} ID")
        else:
            logger.warning(f"Yöntem {i+1}: Hata - {result}")
    
    # Geçerli ID'leri filtrele (8 karakter, alphanumeric)
    valid_ids = [
        id for id in all_ids 
        if len(id) == 8 and id.isalnum()
    ]
    
    logger.info(f"🎉 Toplam {len(valid_ids)} geçerli match ID bulundu!")
    
    # JSON'a kaydet
    output = {
        "timestamp": datetime.now().isoformat(),
        "total_count": len(valid_ids),
        "match_ids": valid_ids
    }
    
    with open("collected_match_ids.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    logger.info("💾 Match ID'ler 'collected_match_ids.json' dosyasına kaydedildi")
    return valid_ids

if __name__ == "__main__":
    asyncio.run(collect_all_match_ids())
