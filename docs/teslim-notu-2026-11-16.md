# 16 Kasım 2026 · Teslim notu

Dayanak: şirketin MVP PRD v1.1 §6, §11 ve §13; Technical Design v1.1 §9–10; MVP Backlog v1.1. Bu tablo [ilk denetimdeki](requirements-audit.md) tarihsel boşluk listesini günceller. CI kanıtı ile sahadaki kabul ayrı tutulur.

| Gereksinim | Depodaki kanıt | Kalan kabul |
| --- | --- | --- |
| FR-01, AUTH-01/02, FND-05 | Identity, doğrulama ve parola sıfırlama; SQL outbox; HTML ve düz metin şablonları. | Yeni şablonların gerçek posta kutusunda teslim ve bağlantı kontrolü, API yeni imajla başladıktan sonra. |
| FR-02–09, FR-11, PORT-04, LEASE-05, RPT-04 | Mülk/birim arşivi, sözleşme yenileme, kira ve tahsilat, depozito, gider, nakit akışı ve ödeme CSV'si. [Gerçek SQL ve tarayıcı CI koşusu](https://github.com/erenntokgoz/mulk-yonetimi/actions/runs/43694853694) doğrulanmış pilot kullanıcısıyla başlar. | Pilot kabulünde gerçek tarayıcıyla kayıt, posta bağlantısı ve operatör aktivasyonunu ayrıca yürüt. |
| FR-13/14, SAAS-01/02, FND-03/04, QA-02 | Pilot onayı ve kota, audit gerekçesi/correlation ID, SQL Server'da iki hesapla yetkisiz erişim ve finans eşzamanlılık senaryoları. | Canlı pilot operatörüyle onay, kota ve olay izini örnek bir pilot hesapta kontrol et. |
| FR-10, DOC-01/02, ARCH-04, RG-05, TD-9-d | Private R2 imzalı URL, kota ve tarama kapısı; tenant izolasyonu ve scanner protokol testleri. Gerçek R2 testi kimlik bilgileri olmadığında CI'da atlanır. | Operatörün önceki notunda private bucket ve CORS mevcut. Canlı ClamAV, uçtan uca PUT/GET, süre bitimi, yanlış origin ve tarayıcı kesintisi kanıtı gerekli. Kapı hata halinde kapalı kalır. |
| FND-02/06, REL-02, RG-07 | Sürümlü idempotent migration, yerel SQL yedek/restore tatbikatı, [yayın ve geri dönüş planı](release-readiness.md). | Ayrı staging kaynaklarıyla prova ve Azure SQL PITR geri yükleme ölçümü yapılmadı. RPO/RTO hedefini operatör kabul edip ölçmeli. |
| QA-03/04, RG-01/09, TD-9 | SQL destekli tarayıcı akışı, komponent, mobil, klavye, axe ve görsel regresyon; OpenAPI istemci drift kontrolü. | PRD'deki üç pilot kullanıcı senaryosunun kaydı, geniş cihaz/tarayıcı matrisi ve yük ölçümü eksik. |
| REL-01, RG-08 | Hukuki metinler ve iletişim sayfası ürün sahibinin isteğiyle ertelendi. | Politika/hukuk kabulü açık. |

Google ile giriş, parola ve e-posta akışına ek bir oturum açma seçeneğidir. Canlı kabul için Google yapılandırmasını ve API'yi önce hazırla; Google düğmesi etkin frontend'i sonra yayımla. Test ortamındaki sağlayıcı yanıtı gerçek Google oturumunu kanıtlamaz.

## Kısa demo

1. Ayrı bir etkin pilot hesabıyla giriş yap; ilk kurulum adımlarından mülk, birim ve kiracı ekle.
2. Sözleşmeyi oluştur ve etkinleştir. Kira alacağına bir tahsilat işle, dağıtılan ve bekleyen tutarları karşılaştır.
3. Sözleşmeyi yenile. Önceki dönemi, rapor tarih filtresini ve CSV çıktısını göster.
4. Koyu/açık tema, mobil menü ve klavyeyle onay penceresini göster. E-posta için [yerel önizlemeyi](local-email.md) kullan; üretim teslimatı doğrulanmadıysa açıkça belirt.
5. R2/tarama veya Google kapısı doğrulanmadıysa o adımı atla. Demo verisini gerçek kiracı verilerinden ayrı tut.

Kalan üretim kapıları [yayın kontrol listesindedir](release-readiness.md). HTTPS ve health yanıtı çalışan servisi gösterir; deploy edilen SHA'yı, posta teslimini veya pilot kabulünü kanıtlamaz.
