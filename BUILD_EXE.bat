@echo off
REM ======================================
REM Flashscore Bot - Windows EXE Builder
REM ======================================

echo.
echo ==========================================
echo     FLASHSCORE BOT EXE BUILDER
echo ==========================================
echo.

REM Check if Python is installed (use py launcher on Windows)
py --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Python bulunamadi! Lutfen Python yukleyin.
    echo https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Python bulundu:
py --version
echo.

REM Step 1: Install ALL requirements from requirements.txt
echo [1/5] Tum bagimliliklar yukleniyor (requirements.txt)...
echo Bu adim biraz zaman alabilir, lutfen bekleyin...
py -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [UYARI] Bazi paketler yuklenemedi, devam ediliyor...
)
echo Bagimliliklar yuklendi!

REM Step 2: Install PyInstaller
echo.
echo [2/5] PyInstaller yukleniyor...
py -m pip install pyinstaller --quiet
echo PyInstaller hazir!

REM Step 3: Install Pillow for icon conversion
echo.
echo [3/5] Pillow (icon icin) yukleniyor...
py -m pip install pillow --quiet
echo Pillow hazir!

REM Step 4: Convert PNG to ICO
echo.
echo [4/5] Icon hazirlaniyor (top.png -> icon.ico)...
py -c "from PIL import Image; img = Image.open('top.png'); img.save('icon.ico', format='ICO', sizes=[(256,256), (128,128), (64,64), (48,48), (32,32), (16,16)])" 2>nul
if exist icon.ico (
    echo Icon basariyla olusturuldu!
) else (
    echo Mevcut icon.ico kullanilacak
)

REM Step 5: Build EXE
echo.
echo [5/5] EXE olusturuluyor...
echo Bu islem 3-10 dakika surebilir, lutfen bekleyin!
echo.
py -m PyInstaller --clean --noconfirm flashscore_bot.spec

if exist "dist\FlashscoreBot.exe" (
    echo.
    echo ==========================================
    echo  ^>^>^> BASARILI! ^<^<^<
    echo.
    echo  EXE dosyasi olusturuldu:
    echo  dist\FlashscoreBot.exe
    echo.
    echo  Boyut:
    for %%I in (dist\FlashscoreBot.exe) do echo  %%~zI bytes
    echo.
    echo ==========================================
    echo.
    echo NOT: Playwright tarayicisi icin bir kez calistirin:
    echo      playwright install chromium
    echo.
) else (
    echo.
    echo ==========================================
    echo  [HATA] EXE olusturulamadi!
    echo  Yukaridaki hata mesajlarini kontrol edin.
    echo ==========================================
)

pause
