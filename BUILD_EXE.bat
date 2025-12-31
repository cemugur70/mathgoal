@echo off
REM ======================================
REM Flashscore Bot - Windows EXE Builder
REM ======================================

echo.
echo === FLASHSCORE BOT EXE BUILDER ===
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Python bulunamadi! Lutfen Python yukleyin.
    pause
    exit /b 1
)

REM Install PyInstaller if not present
echo [1/4] PyInstaller kontrol ediliyor...
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    echo PyInstaller yukleniyor...
    pip install pyinstaller
)

REM Install Pillow for icon conversion
echo [2/4] Pillow kontrol ediliyor...
pip show pillow >nul 2>&1
if errorlevel 1 (
    echo Pillow yukleniyor...
    pip install pillow
)

REM Convert PNG to ICO if needed
echo [3/4] Icon hazirlaniyor...
python -c "from PIL import Image; img = Image.open('top.png'); img.save('icon.ico', format='ICO', sizes=[(256,256), (128,128), (64,64), (48,48), (32,32), (16,16)])" 2>nul
if exist icon.ico (
    echo Icon basariyla olusturuldu: icon.ico
) else (
    echo Mevcut icon.ico kullanilacak
)

REM Build EXE
echo [4/4] EXE olusturuluyor (bu islem 2-5 dakika surebilir)...
echo.
pyinstaller --clean flashscore_bot.spec

if exist "dist\FlashscoreBot.exe" (
    echo.
    echo ==========================================
    echo  BASARILI! EXE olusturuldu:
    echo  dist\FlashscoreBot.exe
    echo ==========================================
    echo.
    echo Dosyayi istediginiz yere tasiyabilirsiniz.
) else (
    echo.
    echo [HATA] EXE olusturulamadi!
    echo Loglari kontrol edin.
)

pause
