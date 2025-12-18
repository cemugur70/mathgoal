#!/usr/bin/env python3
"""
Retry Failed Matches - Başarısız match'leri tekrar dener
"""
import asyncio
import json
import sys
from datetime import datetime
from playwright.async_api import async_playwright

from common_scraper import scrape_summary_page, fetch_all_odds_data
from excel_writer import write_to_excel
from failed_matches_manager import get_failed_matches, get_failed_matches_stats, failed_match_manager
from utils import get_logger, get_user_data_path

logger = get_logger(__name__)

async def retry_single_match(page, match_id: str, bookmakers: list, bet_types: dict = None):
    """Tek bir match'i retry et"""
    try:
        logger.info(f"🔄 Retrying match: {match_id}")
        
        # Summary data çek
        common_data = await scrape_summary_page(page, match_id)
        if not common_data:
            logger.error(f"❌ {match_id}: Summary data alınamadı")
            return False
            
        # Odds data çek
        odds_data = await fetch_all_odds_data(match_id, bookmakers, bet_types)
        if not odds_data:
            logger.error(f"❌ {match_id}: Odds data alınamadı")
            return False
            
        # Excel'e yaz
        write_to_excel(get_user_data_path("YENİ FLASHSCORE.xlsx"), common_data, odds_data)
        logger.info(f"✅ {match_id}: Başarıyla retry edildi")
        return True
        
    except Exception as e:
        logger.error(f"❌ {match_id}: Retry hatası: {e}")
        return False

async def retry_failed_matches():
    """Tüm başarısız match'leri retry et"""
    # Config'i yükle
    try:
        with open(get_user_data_path("config.json"), "r", encoding="utf-8") as f:
            config = json.load(f)
        bookmakers = config.get("bookmakers", [])
        bet_types = config.get("bet_types", {})
    except Exception as e:
        logger.error(f"Config yüklenemedi: {e}")
        return
    
    if not bookmakers:
        logger.error("Bookmaker listesi boş!")
        return
    
    # Failed match'leri al
    failed_matches = get_failed_matches(max_attempts=5)  # Max 5 deneme
    stats = get_failed_matches_stats()
    
    logger.info(f"📊 Failed Match İstatistikleri:")
    logger.info(f"   Total failed: {stats['total_failed']}")
    logger.info(f"   Retryable: {stats['retryable']}")
    logger.info(f"   Max attempts reached: {stats['max_attempts_reached']}")
    
    if not failed_matches:
        logger.info("🎉 Retry edilecek başarısız match yok!")
        return
    
    logger.info(f"🔄 {len(failed_matches)} match retry edilecek...")
    
    # Browser başlat
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        )
        page = await context.new_page()
        
        successful_retries = 0
        failed_retries = 0
        
        for i, match_id in enumerate(failed_matches, 1):
            logger.info(f"[{i}/{len(failed_matches)}] Processing {match_id}")
            
            success = await retry_single_match(page, match_id, bookmakers, bet_types)
            if success:
                successful_retries += 1
            else:
                failed_retries += 1
            
            # Rate limiting
            if i < len(failed_matches):
                await asyncio.sleep(2)  # 2 saniye bekle
        
        await browser.close()
        
        logger.info(f"🎯 Retry Sonuçları:")
        logger.info(f"   ✅ Başarılı: {successful_retries}")
        logger.info(f"   ❌ Başarısız: {failed_retries}")
        logger.info(f"   📊 Başarı oranı: {successful_retries/(successful_retries+failed_retries)*100:.1f}%")

def show_failed_matches_info():
    """Failed match bilgilerini göster"""
    stats = get_failed_matches_stats()
    failed_matches_details = failed_match_manager.get_failed_matches_with_details()
    
    print("\n" + "="*60)
    print("📊 BAŞARISIZ MATCH İSTATİSTİKLERİ")
    print("="*60)
    print(f"Toplam başarısız match: {stats['total_failed']}")
    print(f"Retry edilebilir: {stats['retryable']}")
    print(f"Max deneme sayısına ulaşan: {stats['max_attempts_reached']}")
    
    if failed_matches_details:
        print("\n📋 DETAYLAR:")
        print("-" * 60)
        for match_id, details in list(failed_matches_details.items())[:10]:  # İlk 10'unu göster
            print(f"Match ID: {match_id}")
            print(f"  Deneme sayısı: {details['attempts']}")
            print(f"  İlk hata: {details['first_failed']}")
            if details['errors']:
                last_error = details['errors'][-1]
                print(f"  Son hata: {last_error['type']} - {last_error['message']}")
            print()
        
        if len(failed_matches_details) > 10:
            print(f"... ve {len(failed_matches_details) - 10} match daha")
    
    print("="*60)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--info":
        show_failed_matches_info()
    else:
        asyncio.run(retry_failed_matches())
