import sys
import multiprocessing
import asyncio
import gui
import season_main
import future_main
import old_main
import update_league_list
import retry_failed_matches

# Try to import match_id_manager, ignore if missing
try:
    import match_id_manager
except ImportError:
    match_id_manager = None
    
import os

if getattr(sys, 'frozen', False):
    # Set Playwright browsers path to bundled directory
    bundled_path = os.path.join(sys._MEIPASS, "ms-playwright")
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = bundled_path
    
    # Debug logging
    try:
        debug_file = os.path.join(os.path.dirname(sys.executable), "debug_log.txt")
        with open(debug_file, "w") as f:
            f.write(f"Bundled path: {bundled_path}\n")
            f.write(f"Exists: {os.path.exists(bundled_path)}\n")
            if os.path.exists(bundled_path):
                f.write(f"Contents: {os.listdir(bundled_path)}\n")
                
                # Check for specific browser
                browser_path = os.path.join(bundled_path, "chromium_headless_shell-1194", "chrome-win", "headless_shell.exe")
                f.write(f"Checking browser: {browser_path}\n")
                f.write(f"Browser exists: {os.path.exists(browser_path)}\n")
    except Exception:
        pass

def main():
    multiprocessing.freeze_support()
    
    if len(sys.argv) > 1:
        mode = sys.argv[1]
        if mode == "--season":
            asyncio.run(season_main.main())
        elif mode == "--future":
            asyncio.run(future_main.main())
        elif mode == "--old":
            asyncio.run(old_main.main())
        elif mode == "--update-leagues":
            asyncio.run(update_league_list.update_league_list())
        elif mode == "--retry":
            asyncio.run(retry_failed_matches.retry_failed_matches())
        elif mode == "--refresh-ids" and match_id_manager:
            match_id_manager.main()
    else:
        app = gui.FlashscoreApp()
        app.mainloop()

if __name__ == "__main__":
    main()
