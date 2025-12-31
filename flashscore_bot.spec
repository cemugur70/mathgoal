# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for Flashscore Bot
Creates a single executable with all dependencies bundled
"""

import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all necessary data files
added_files = [
    ('TEMPLATE_FLASHSCORE.xlsx', '.'),
    ('league_list.json', '.'),
    ('config.json', '.'),
    ('all_columns.txt', '.'),
    ('top.png', '.'),
    ('icon.ico', '.'),
]

# Collect all Python scripts that are imported dynamically
hidden_imports = [
    'customtkinter',
    'pandas',
    'openpyxl',
    'xlsxwriter',
    'httpx',
    'requests',
    'bs4',
    'playwright',
    'playwright.async_api',
    'asyncio',
    'json',
    're',
    'threading',
    'queue',
    'subprocess',
    'tkinter',
    'tkinter.messagebox',
    # Our modules
    'config',
    'utils',
    'common_scraper',
    'fast_scraper',
    'hybrid_scraper',
    'excel_writer',
    'data_processor',
    'column_template',
    'mapping',
    'progress_tracker',
    'failed_matches_manager',
    'season_main',
    'old_main',
    'future_main',
    'hybrid_main',
    'fast_future_scraper',
    'get_match_ids',
    'update_league_list',
    'retry_failed_matches',
]

a = Analysis(
    ['gui_v2.py'],
    pathex=[],
    binaries=[],
    datas=added_files,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='FlashscoreBot',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window (GUI app)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico',  # App icon
)
