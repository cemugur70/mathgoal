@echo off
echo [1/2] Python paketleri yükleniyor...
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo HATA: pip install -r requirements.txt başarısız oldu.
    exit /b %errorlevel%
)

echo [2/2] Playwright browser dosyaları yükleniyor...
playwright install

if %errorlevel% neq 0 (
    echo HATA: playwright install başarısız oldu.
    exit /b %errorlevel%
)

echo Tüm işlemler başarıyla tamamlandı.
pause
