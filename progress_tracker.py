"""
Progress Tracker - Real-time progress communication between scraper and GUI
Uses JSON file for inter-process communication
"""

import json
import os
from datetime import datetime
from typing import List, Dict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROGRESS_FILE = os.path.join(SCRIPT_DIR, "progress.json")
FAILED_FILE = os.path.join(SCRIPT_DIR, "failed_matches.json")


def init_progress(total_matches: int, task_name: str = "Scraping"):
    """Initialize progress tracking"""
    data = {
        "task": task_name,
        "total": total_matches,
        "processed": 0,
        "success": 0,
        "failed": 0,
        "current_match": "",
        "status": "running",
        "start_time": datetime.now().isoformat(),
        "last_update": datetime.now().isoformat(),
        "failed_matches": [],
        "retry_round": 0
    }
    _write_progress(data)
    
    # Clear failed file
    if os.path.exists(FAILED_FILE):
        os.remove(FAILED_FILE)
    
    return data


def update_progress(processed: int = None, success: int = None, failed: int = None,
                   current_match: str = None, status: str = None, retry_round: int = None):
    """Update progress values"""
    data = read_progress()
    if data is None:
        return
    
    if processed is not None:
        data["processed"] = processed
    if success is not None:
        data["success"] = success
    if failed is not None:
        data["failed"] = failed
    if current_match is not None:
        data["current_match"] = current_match
    if status is not None:
        data["status"] = status
    if retry_round is not None:
        data["retry_round"] = retry_round
    
    data["last_update"] = datetime.now().isoformat()
    _write_progress(data)


def increment_progress(success: bool = True, match_id: str = "", error_msg: str = ""):
    """Increment processed count and optionally log failure"""
    data = read_progress()
    if data is None:
        return
    
    data["processed"] += 1
    if success:
        data["success"] += 1
    else:
        data["failed"] += 1
        # Add to failed list
        data["failed_matches"].append({
            "id": match_id,
            "error": error_msg[:100],
            "time": datetime.now().isoformat()
        })
    
    data["last_update"] = datetime.now().isoformat()
    _write_progress(data)


def add_failed_match(match_id: str, error_msg: str):
    """Add a failed match to tracking"""
    try:
        if os.path.exists(FAILED_FILE):
            with open(FAILED_FILE, "r", encoding="utf-8") as f:
                failed = json.load(f)
        else:
            failed = {"matches": [], "last_update": ""}
        
        # Check if already exists
        existing_ids = [m["id"] for m in failed["matches"]]
        if match_id not in existing_ids:
            failed["matches"].append({
                "id": match_id,
                "error": error_msg[:150],
                "attempts": 1,
                "time": datetime.now().isoformat()
            })
        else:
            # Increment attempts
            for m in failed["matches"]:
                if m["id"] == match_id:
                    m["attempts"] = m.get("attempts", 1) + 1
                    m["error"] = error_msg[:150]
                    break
        
        failed["last_update"] = datetime.now().isoformat()
        
        with open(FAILED_FILE, "w", encoding="utf-8") as f:
            json.dump(failed, f, ensure_ascii=False, indent=2)
    except:
        pass


def remove_failed_match(match_id: str):
    """Remove a match from failed list (when successfully processed)"""
    try:
        if not os.path.exists(FAILED_FILE):
            return
        
        with open(FAILED_FILE, "r", encoding="utf-8") as f:
            failed = json.load(f)
        
        failed["matches"] = [m for m in failed["matches"] if m["id"] != match_id]
        failed["last_update"] = datetime.now().isoformat()
        
        with open(FAILED_FILE, "w", encoding="utf-8") as f:
            json.dump(failed, f, ensure_ascii=False, indent=2)
    except:
        pass


def get_failed_matches() -> List[Dict]:
    """Get list of all failed matches"""
    try:
        if not os.path.exists(FAILED_FILE):
            return []
        
        with open(FAILED_FILE, "r", encoding="utf-8") as f:
            failed = json.load(f)
        
        return failed.get("matches", [])
    except:
        return []


def get_failed_count() -> int:
    """Get count of failed matches"""
    return len(get_failed_matches())


def finish_progress(status: str = "completed"):
    """Mark progress as finished"""
    update_progress(status=status)


def read_progress() -> Dict:
    """Read current progress from file"""
    try:
        if not os.path.exists(PROGRESS_FILE):
            return None
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return None


def _write_progress(data: Dict):
    """Write progress to file"""
    try:
        with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except:
        pass


def get_progress_summary() -> str:
    """Get a human readable progress summary"""
    data = read_progress()
    if not data:
        return "No progress data"
    
    total = data.get("total", 0)
    processed = data.get("processed", 0)
    success = data.get("success", 0)
    failed = data.get("failed", 0)
    status = data.get("status", "unknown")
    
    if total > 0:
        pct = int(100 * processed / total)
    else:
        pct = 0
    
    return f"{processed}/{total} ({pct}%) | OK:{success} FAIL:{failed} | {status}"
