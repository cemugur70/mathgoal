#!/usr/bin/env python3
"""
Failed Match Manager - Başarısız match ID'lerini yönetir
"""
import json
import os
from datetime import datetime
from typing import List, Dict, Set
from utils import get_logger

logger = get_logger(__name__)

FAILED_MATCHES_FILE = "failed_matches.json"

class FailedMatchManager:
    def __init__(self):
        self.failed_matches = self.load_failed_matches()
    
    def load_failed_matches(self) -> Dict:
        """Başarısız match'leri yükle"""
        if os.path.exists(FAILED_MATCHES_FILE):
            try:
                with open(FAILED_MATCHES_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed matches dosyası okunamadı: {e}")
                return {}
        return {}
    
    def save_failed_matches(self):
        """Başarısız match'leri kaydet"""
        try:
            with open(FAILED_MATCHES_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.failed_matches, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed matches dosyası kaydedilemedi: {e}")
    
    def add_failed_match(self, match_id: str, error_type: str, error_message: str = "", bookmakers: List[str] = None):
        """Başarısız match ekle"""
        timestamp = datetime.now().isoformat()
        
        if match_id not in self.failed_matches:
            self.failed_matches[match_id] = {
                "first_failed": timestamp,
                "attempts": 0,
                "errors": [],
                "bookmakers": bookmakers or []
            }
        
        self.failed_matches[match_id]["attempts"] += 1
        self.failed_matches[match_id]["last_failed"] = timestamp
        self.failed_matches[match_id]["errors"].append({
            "timestamp": timestamp,
            "type": error_type,
            "message": error_message
        })
        
        # Son 10 hatayı tut
        if len(self.failed_matches[match_id]["errors"]) > 10:
            self.failed_matches[match_id]["errors"] = self.failed_matches[match_id]["errors"][-10:]
        
        self.save_failed_matches()
        logger.warning(f"Failed match eklendi: {match_id} - {error_type}")
    
    def remove_successful_match(self, match_id: str):
        """Başarılı olan match'i listeden çıkar"""
        if match_id in self.failed_matches:
            del self.failed_matches[match_id]
            self.save_failed_matches()
            logger.info(f"Başarılı match listeden çıkarıldı: {match_id}")
    
    def get_failed_matches(self, max_attempts: int = 5) -> List[str]:
        """Belirli deneme sayısından az olan başarısız match'leri getir"""
        return [
            match_id for match_id, data in self.failed_matches.items()
            if data["attempts"] < max_attempts
        ]
    
    def get_failed_matches_with_details(self) -> Dict:
        """Detaylı başarısız match bilgilerini getir"""
        return self.failed_matches.copy()
    
    def clear_all_failed_matches(self):
        """Tüm başarısız match'leri temizle"""
        self.failed_matches = {}
        self.save_failed_matches()
        logger.info("Tüm başarısız match'ler temizlendi")
    
    def get_stats(self) -> Dict:
        """İstatistikleri getir"""
        if not self.failed_matches:
            return {
                "total_failed": 0,
                "retryable": 0,
                "max_attempts_reached": 0
            }
        
        retryable = len(self.get_failed_matches())
        max_attempts_reached = len(self.failed_matches) - retryable
        
        return {
            "total_failed": len(self.failed_matches),
            "retryable": retryable,
            "max_attempts_reached": max_attempts_reached
        }

# Global instance
failed_match_manager = FailedMatchManager()

def add_failed_match(match_id: str, error_type: str, error_message: str = "", bookmakers: List[str] = None):
    """Başarısız match ekle - kolay kullanım için"""
    failed_match_manager.add_failed_match(match_id, error_type, error_message, bookmakers)

def remove_successful_match(match_id: str):
    """Başarılı match'i çıkar - kolay kullanım için"""
    failed_match_manager.remove_successful_match(match_id)

def get_failed_matches(max_attempts: int = 5) -> List[str]:
    """Retry edilebilir match'leri getir - kolay kullanım için"""
    return failed_match_manager.get_failed_matches(max_attempts)

def get_failed_matches_stats() -> Dict:
    """İstatistikleri getir - kolay kullanım için"""
    return failed_match_manager.get_stats()
