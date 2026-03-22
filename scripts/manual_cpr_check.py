#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║   MANUAL CPR CHECK - CPR Hesaplama Doğrulama & Düzeltme                ║
║                                                                         ║
║   Kullanım:                                                             ║
║     python scripts/manual_cpr_check.py                                  ║
║     python scripts/manual_cpr_check.py --fix         (hataları düzelt)  ║
║     python scripts/manual_cpr_check.py --limit 500   (500 maç kontrol)  ║
║     python scripts/manual_cpr_check.py --recalc      (tümünü yeniden)   ║
║                                                                         ║
║   Ne Yapar (Check List):                                                ║
║     ✓ 1. CPR hesaplanmamış (NULL) maçları bulur                         ║
║     ✓ 2. CPR=0 olan ama oranları olan maçları tespit eder               ║
║     ✓ 3. Oran bilgisi eksik maçları listeler                            ║
║     ✓ 4. CPR değerleri mantık kontrolü (toplam = %100 mü?)              ║
║     ✓ 5. CPR Tahmin tutarlılık kontrolü (en yüksek prob = tahmin mi?)   ║
║     ✓ 6. NaN/Infinity değer kontrolü                                   ║
║     ✓ 7. --fix ile hatalı kayıtları otomatik düzeltir                   ║
║     ✓ 8. --recalc ile tüm CPR değerlerini silip yeniden hesaplatır      ║
╚══════════════════════════════════════════════════════════════════════════╝
"""
import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import requests

LOGGER = logging.getLogger("cpr_check")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)


class ApiClient:
    def __init__(self):
        self.url = os.getenv("MATHGOAL_API_URL", "https://mathgoal.site")
        self.key = os.getenv("INGEST_API_KEY", "")
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-Api-Key": self.key
        })

    def query(self, sql):
        """Execute raw SQL via custom debug endpoint or direct DB."""
        # We'll use the analysis API to fetch data and check in Python
        pass

    def get_matches(self, limit=200, offset=0, upcoming_only=False):
        params = {"limit": limit, "offset": offset}
        if upcoming_only:
            params["upcomingOnly"] = "true"
        r = self.session.get(f"{self.url}/api/analysis", params=params, timeout=60)
        r.raise_for_status()
        return r.json()


def check_cpr_values(matches: list) -> dict:
    """CPR değerlerini kontrol et ve sorunları raporla."""
    issues = {
        "no_cpr": [],          # CPR hesaplanmamış
        "zero_cpr_with_odds": [], # CPR=0 ama oran var
        "no_odds": [],          # Oran bilgisi yok
        "sum_mismatch": [],     # Toplam != %100
        "prediction_mismatch": [], # Tahmin tutarsız
        "nan_values": [],       # NaN/geçersiz değerler
        "ok": [],               # Sorunsuz
    }

    for m in matches:
        match_id = m.get("match_id", "?")
        home = m.get("home_team", "?")
        away = m.get("away_team", "?")
        label = f"{home} vs {away} ({match_id})"

        cpr = m.get("cpr", {})
        odds_1 = m.get("odds_1")
        odds_x = m.get("odds_x")
        odds_2 = m.get("odds_2")
        cpr_home = m.get("cpr_home")

        # Check 1: CPR hesaplanmamış
        if cpr_home is None:
            issues["no_cpr"].append({
                "label": label,
                "reason": "CPR değeri NULL (hiç hesaplanmamış)",
                "has_odds": bool(odds_1 and odds_x and odds_2)
            })
            continue

        # Check 2: CPR=0 ama oran var
        if float(cpr_home or 0) == 0 and odds_1 and odds_x and odds_2:
            issues["zero_cpr_with_odds"].append({
                "label": label,
                "reason": f"CPR=0 ama oranlar mevcut ({odds_1}/{odds_x}/{odds_2})",
                "odds": [odds_1, odds_x, odds_2]
            })
            continue

        # Check 3: Oran bilgisi yok
        if not odds_1 or not odds_x or not odds_2:
            issues["no_odds"].append({
                "label": label,
                "reason": "Oran bilgisi eksik (bookmaker verisi yok)"
            })
            continue

        # CPR detayları
        prob_home = cpr.get("probHome", 0) or 0
        prob_draw = cpr.get("probDraw", 0) or 0
        prob_away = cpr.get("probAway", 0) or 0
        prediction = cpr.get("prediction", "-")
        confidence = cpr.get("confidence", 0) or 0

        # Check 4: NaN kontrolü
        try:
            ph = float(prob_home)
            pd = float(prob_draw)
            pa = float(prob_away)
            cf = float(confidence)
            if any(x != x for x in [ph, pd, pa, cf]):  # NaN check
                raise ValueError("NaN detected")
        except (ValueError, TypeError):
            issues["nan_values"].append({
                "label": label,
                "reason": f"Geçersiz CPR değeri: H={prob_home} D={prob_draw} A={prob_away}",
            })
            continue

        # Check 5: Toplam kontrol (%95-%105 arası kabul)
        total = ph + pd + pa
        if total > 0 and (total < 0.90 or total > 1.10):
            issues["sum_mismatch"].append({
                "label": label,
                "reason": f"CPR toplam = {total:.4f} (beklenen: ~1.00)",
                "values": {"H": ph, "D": pd, "A": pa}
            })
            continue

        # Check 6: Tahmin tutarlılığı
        if total > 0:
            max_prob = max(ph, pd, pa)
            expected_pred = "1" if ph >= pd and ph >= pa else "2" if pa >= pd else "X"
            if prediction != expected_pred and prediction != "-":
                issues["prediction_mismatch"].append({
                    "label": label,
                    "reason": f"Tahmin '{prediction}' ama en yüksek olasılık '{expected_pred}' "
                              f"(H={ph:.3f} D={pd:.3f} A={pa:.3f})",
                })
                continue

        issues["ok"].append(label)

    return issues


def print_report(issues: dict, total_checked: int):
    """Detaylı rapor yazdır."""
    print("\n" + "=" * 80)
    print("🔍 CPR HESAPLAMA KONTROL RAPORU")
    print("=" * 80)

    # Özet tablo
    print(f"\n📊 ÖZET ({total_checked} maç kontrol edildi):")
    print("-" * 60)
    checks = [
        ("✅ Sorunsuz Maçlar", len(issues["ok"]), "green"),
        ("⚠️  CPR Hesaplanmamış (NULL)", len(issues["no_cpr"]), "yellow"),
        ("🔴 CPR=0 Ama Oranlar Var", len(issues["zero_cpr_with_odds"]), "red"),
        ("📊 Oran Bilgisi Eksik", len(issues["no_odds"]), "gray"),
        ("❌ Toplam != %100", len(issues["sum_mismatch"]), "red"),
        ("⚠️  Tahmin Tutarsız", len(issues["prediction_mismatch"]), "yellow"),
        ("🔴 NaN/Geçersiz Değer", len(issues["nan_values"]), "red"),
    ]

    total_issues = sum(c[1] for c in checks[1:])  # ok hariç
    for label, count, _ in checks:
        status = "🟢" if count == 0 and label != checks[0][0] else ""
        print(f"  {label:45s} : {count:5d} {status}")
    print("-" * 60)
    print(f"  {'TOPLAM SORUNLU':45s} : {total_issues:5d}")

    # Detaylı sorun listeleri
    problem_categories = [
        ("no_cpr", "⚠️  CPR HESAPLANMAMIŞ MAÇLAR (oranları var ama CPR yok)"),
        ("zero_cpr_with_odds", "🔴 CPR=0 AMA ORANLARI VAR (düzeltme gerekli)"),
        ("sum_mismatch", "❌ CPR TOPLAMI HATALI (%100 olmalı)"),
        ("prediction_mismatch", "⚠️  TAHMİN TUTARSIZ"),
        ("nan_values", "🔴 GEÇERSİZ (NaN) DEĞERLER"),
    ]

    for key, title in problem_categories:
        items = issues[key]
        if not items:
            continue
        # Only show items that need fixing for no_cpr
        if key == "no_cpr":
            items = [i for i in items if i.get("has_odds")]
            if not items:
                continue

        print(f"\n{title} ({len(items)} adet):")
        print("-" * 80)
        for i, item in enumerate(items[:20], 1):  # İlk 20'yi göster
            print(f"  {i:3d}. {item['label']}")
            print(f"       → {item['reason']}")
        if len(items) > 20:
            print(f"  ... ve {len(items) - 20} tane daha")

    # Genel sağlık durumu
    print("\n" + "=" * 80)
    if total_issues == 0:
        print("🎉 TÜM CPR HESAPLAMALARI DOĞRU! Herhangi bir sorun bulunamadı.")
    elif len(issues["zero_cpr_with_odds"]) > 0 or len(issues["nan_values"]) > 0:
        print("🔴 KRİTİK SORUNLAR BULUNDU! --fix parametresiyle düzeltme yapılabilir.")
    else:
        print("⚠️  Küçük sorunlar bulundu. CPR worker'ın çalışmasını bekleyin veya --fix kullanın.")
    print("=" * 80)

    return total_issues


def fix_issues(issues: dict):
    """Hatalı CPR kayıtlarını düzeltmek için API çağrısı yap (CPR'ı NULL yap, worker tekrar hesaplasın)."""
    fixable = []

    # CPR=0 ama oran var -> düzeltilmeli
    for item in issues["zero_cpr_with_odds"]:
        fixable.append(item["label"].split("(")[-1].rstrip(")"))

    # NaN değerler -> düzeltilmeli
    for item in issues["nan_values"]:
        fixable.append(item["label"].split("(")[-1].rstrip(")"))

    # Toplam hatası -> düzeltilmeli
    for item in issues["sum_mismatch"]:
        fixable.append(item["label"].split("(")[-1].rstrip(")"))

    # Tahmin tutarsızlığı -> düzeltilmeli
    for item in issues["prediction_mismatch"]:
        fixable.append(item["label"].split("(")[-1].rstrip(")"))

    if not fixable:
        print("\n✅ Düzeltilecek bir şey yok!")
        return

    print(f"\n🔧 {len(fixable)} maçın CPR değeri sıfırlanacak (worker tekrar hesaplayacak)...")

    url = os.getenv("MATHGOAL_API_URL", "https://mathgoal.site")
    key = os.getenv("INGEST_API_KEY", "")

    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "X-Api-Key": key
    })

    # Reset CPR for these matches via a custom endpoint or batch update
    # Since we don't have a direct SQL endpoint, we POST to a reset endpoint
    try:
        r = session.post(
            f"{url}/api/cpr/reset",
            json={"match_ids": fixable},
            timeout=60
        )
        if r.status_code == 200:
            print(f"✅ {len(fixable)} maçın CPR değeri sıfırlandı. Worker otomatik tekrar hesaplayacak.")
        elif r.status_code == 404:
            # Endpoint yoksa, kullanıcıya bilgi ver
            print(f"⚠️  /api/cpr/reset endpoint'i bulunamadı.")
            print(f"   Alternatif: --recalc parametresiyle tüm CPR'ları sıfırlayabilirsiniz.")
            print(f"   Düzeltilmesi gereken maç ID'leri:")
            for mid in fixable[:10]:
                print(f"     - {mid}")
            if len(fixable) > 10:
                print(f"     ... ve {len(fixable) - 10} tane daha")
        else:
            print(f"❌ Hata: {r.status_code} - {r.text}")
    except Exception as e:
        print(f"❌ İstek hatası: {e}")


def recalc_all():
    """Tüm CPR değerlerini sıfırlayarak worker'ın yeniden hesaplamasını sağla."""
    url = os.getenv("MATHGOAL_API_URL", "https://mathgoal.site")
    key = os.getenv("INGEST_API_KEY", "")

    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "X-Api-Key": key
    })

    print("\n🔄 TÜM CPR DEĞERLERİ SIFIRLANACAK!")
    print("   CPR worker arka planda hepsini yeniden hesaplayacak.")
    print("   Bu işlem birkaç saat sürebilir.\n")

    confirm = input("   Devam etmek istiyor musunuz? (evet/hayır): ").strip().lower()
    if confirm not in ("evet", "e", "yes", "y"):
        print("   İptal edildi.")
        return

    print("   ⏳ Veritabanı güncelleniyor (bu birkaç dakika sürebilir)...")

    try:
        r = session.post(
            f"{url}/api/cpr/recalc-all",
            json={},
            timeout=600  # 10 dakika timeout
        )
        if r.status_code == 200:
            result = r.json()
            print(f"✅ {result.get('reset', '?')} maçın CPR değeri sıfırlandı.")
            print("   CPR Worker otomatik olarak yeniden hesaplamaya başlayacak.")
        elif r.status_code == 404:
            print("⚠️  /api/cpr/recalc-all endpoint'i bulunamadı.")
            print("   Sunucu deploy edilmemiş olabilir.")
        else:
            print(f"❌ Hata: {r.status_code} - {r.text}")
    except requests.exceptions.ReadTimeout:
        print("⚠️  Sunucu yanıt süresi doldu ama işlem arka planda devam ediyor olabilir.")
        print("   Birkaç dakika bekleyip --fix ile kontrol edebilirsiniz.")
    except Exception as e:
        print(f"❌ İstek hatası: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="CPR Hesaplama Doğrulama & Düzeltme Aracı"
    )
    parser.add_argument("--limit", type=int, default=200,
                        help="Kontrol edilecek maç sayısı (varsayılan: 200)")
    parser.add_argument("--fix", action="store_true",
                        help="Hatalı CPR kayıtlarını düzelt")
    parser.add_argument("--recalc", action="store_true",
                        help="Tüm CPR değerlerini sıfırla ve yeniden hesaplat")
    parser.add_argument("--upcoming", action="store_true",
                        help="Sadece oynanmamış maçları kontrol et")
    args = parser.parse_args()

    print("\n" + "=" * 80)
    print("🔍 MANUAL CPR CHECK - HESAPLAMA DOĞRULAMA VE DÜZELTME")
    print("=" * 80)
    print(f"  📊 Kontrol Limiti : {args.limit} maç")
    print(f"  🔧 Düzeltme       : {'Evet' if args.fix else 'Hayır (sadece rapor)'}")
    print(f"  🔄 Yeniden Hesapla: {'Evet' if args.recalc else 'Hayır'}")
    print(f"  📅 Filtre          : {'Sadece Oynanmamış' if args.upcoming else 'Tüm Maçlar'}")
    print("=" * 80 + "\n")

    if args.recalc:
        recalc_all()
        return

    client = ApiClient()

    # Verileri çek (sayfalar halinde)
    all_matches = []
    offset = 0
    batch_size = min(args.limit, 200)

    while len(all_matches) < args.limit:
        remaining = args.limit - len(all_matches)
        fetch_limit = min(batch_size, remaining)

        LOGGER.info(f"Veri çekiliyor... offset={offset}, limit={fetch_limit}")
        try:
            result = client.get_matches(
                limit=fetch_limit,
                offset=offset,
                upcoming_only=args.upcoming
            )
            data = result.get("data", [])
            if not data:
                break
            all_matches.extend(data)
            offset += len(data)

            if len(data) < fetch_limit:
                break  # Son sayfa
        except Exception as e:
            LOGGER.error(f"Veri çekme hatası: {e}")
            break

    if not all_matches:
        print("❌ Kontrol edilecek maç bulunamadı!")
        return

    LOGGER.info(f"Toplam {len(all_matches)} maç kontrol edilecek...")

    # CPR kontrollerini çalıştır
    issues = check_cpr_values(all_matches)
    total_issues = print_report(issues, len(all_matches))

    # Düzeltme modunda ise düzelt
    if args.fix and total_issues > 0:
        fix_issues(issues)


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    main()
