# MVP teslim matrisi · 13 Kasım 2026

Kaynak, masaüstündeki MVP Backlog v1.1. Kanıtlı durum ilgili kontrolün kapsamını belirtir. Yayın kabulü ayrıca izlenir.

| Backlog | Durum | Kanıt veya kalan iş |
| --- | --- | --- |
| FND-01 | Kanıtlı | Temel Next.js ve .NET kontrolleri `cf15bb0` üzerinde geçti. Güncel birleşik SHA için CI sonucu bekleniyor. |
| FND-02/03/05 | Kısmi | Yerel SQL migration ve kimlik testleri geçti. Outbox var. Ortam ayrımı ve işlerin yayın ortamındaki doğrulaması açık. |
| FND-04 | Açık | Kritik ürün işlemlerinde audit ve correlation ID kabulü. |
| FND-06 | Kanıtlı · yerel | Ayrı test DB'sine checksum ile geri yükleme ve `DBCC CHECKDB` geçti. Staging restore provası açık. |
| AUTH-01/02 | Kısmi | Gerçek API, SQL ve Mailpit STARTTLS ile kayıt, doğrulama öncesi giriş reddi, doğrulama ve oturum geçti. Gerçek tarayıcı ve yayın ortamı kabulü açık. |
| AUTH-03 | Açık | Profil ve hesap ayarları. |
| PORT-01–04, TEN-01/02 | Kısmi | Mülk, birim ve kiracı API'leri ile SQL izolasyon testi mevcut. Güncel arayüz, doluluk ve tüm mutasyonların birleşik kabulü açık. |
| LEASE-01–04 | Kısmi | `LeaseLedger` yerelde uygulandı. Sözleşme ve bedel uçları canlı OpenAPI'de. Arayüz ve kritik tarayıcı koşusu açık. |
| LEASE-05 | Açık | Yenileme ve ek protokol akışı. |
| CHG-01–04, PAY-01–05 | Kısmi | Backend doğrulamasında 22 Release ve 3 gerçek SQL testi geçti. `PaymentsLedger` ve `ChargeCorrections` yerelde uygulandı. Alacak ve tahsilat kontratı canlı OpenAPI'de. UI ve gerçek tarayıcı kabulü açık. |
| DEP-01/02, EXP-01/02, DOC-01/02 | Açık | Depozito hareketi, gider ve özel R2 belge akışlarının kabulü. |
| RPT-01–04, NTF-01/02, SAAS-01/02 | Açık | Raporlama ve CSV, bildirim tercihleri/teslimi ve pilot kota/aktivasyon akışları. |
| QA-01/02 | Kısmi | Backend SQL koşusu iki hesaplı IDOR, sözleşme yarışı, alacak üretimi tekrar güvenliği ve tahsilat dağıtım yarışını kapsadı. Belge erişimi ve güncel birleşik sürüm kabulü açık. |
| QA-03/04 | Kısmi | Mevcut Playwright kabuk/BFF testleri test API'si kullanıyor. Gerçek API ile onboarding → tahsilat → yenileme, video, cihaz ve yük kabulü açık. |
| REL-01/02 | Harici engel / açık | Hukuk/politika onayı ve pilot kabulü gerekir. Yayın önkoşulları ve prova adımları runbook'ta. |
| ARCH-01/03/05 | Kısmi | Next.js 16 ve Identity/BFF mevcut. Görsel kabul video ADR'sine göre yapılır. |
| ARCH-02/04/06 | Kısmi | OpenAPI üretim komutu mevcut. Kontrat uyumluluğu, R2 tarayıcı testi ve Vercel/IIS staging provası açık. |
| FUT-01–04 | MVP sonrası | Banka mutabakatı, kiracı portalı, ticari özel hesaplar ve abonelik tahsilatı. |

[Doğrulama kaydı](recovery-status.md) · [Yayın kılavuzu](release-runbook.md) · [SQL geri yükleme tatbikatı](sql-backup-restore.md)
