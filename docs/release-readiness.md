# Pilot yayın ve geri dönüş

Topoloji [ADR 003](adr/003-yayin-topolojisi.md): ayrı Vercel frontend, Ubuntu Docker API, Azure SQL ve private R2. Bu kontrol listesi operatör içindir; eldeki kodun üretimde çalıştığını iddia etmez.

## Ortam sınırı

| Ortam | Frontend/API | SQL | R2 | E-posta ve scanner |
| --- | --- | --- | --- | --- |
| Yerel | localhost | yerel SQL Server | test bucket veya kapalı | test SMTP; ClamAV test instance |
| Staging | ayrı origin ve ayrı API container | ayrı staging veritabanı ve uygulama girişi | ayrı private bucket ve bucket-scope anahtar | ayrı posta adresi, ClamAV |
| Üretim | üretim origin ve API container | `MulkYonetimi` ve ayrı en az yetkili giriş | üretim private bucket | üretim SMTP, ClamAV |

Staging için üretim connection string, cookie şifreleme anahtarları, SMTP, R2 anahtarları ve bucket kullanılmaz. `deploy/api.env.example` her ortamda ayrı `api.env` dosyasına kopyalanır; yalnız sunucuda `0600` tutulur. `Auth__FrontendOrigin` ve `AllowedHosts` ilgili ortamın alan adıdır. Staging ile üretim migration scripti aynı commit'ten üretilir; önce staging'de uygulanır. `Pilot__DefaultUnitLimit` açıkça ayarlanır; boş değer sınırsızdır. Yeni hesaplar PENDING başlar; operatör aktivasyonu ve kota değişikliği [ADR 008](adr/008-pilot-plan-and-activation.md) uyarınca yapılır.

## Kurtarma hedefi ve kabul

Pilot için **önerilen** hedef: RPO en fazla 1 saat, RTO en fazla 4 saat. Operatör bu hedefi yazılı kabul edip gerçek Azure SQL geri yükleme tatbikatıyla ölçmeden SLA sayılmaz. Azure SQL otomatik PITR varsayılan saklama süresi 7 gündür; katmana göre 1–35 gün, Basic'te 1–7 gün ayarlanabilir. İlk tam yedeği izleyen ilk log yedeği oluşana dek yeni veritabanında PITR kullanılamaz. PITR mevcut veritabanının üzerine yazmaz; aynı sunucuda yeni bir veritabanı oluşturur. Geri yükleme süresi boyuta ve hizmet durumuna bağlıdır; bu nedenle önerilen RTO garanti değildir. Kaynaklar: [otomatik yedekler](https://learn.microsoft.com/en-us/azure/azure-sql/database/automated-backups-overview), [geri yükleme](https://learn.microsoft.com/en-us/azure/azure-sql/database/recovery-using-backups), [iş sürekliliği](https://learn.microsoft.com/en-us/azure/sql-database/sql-database-business-continuity).

Yerel SQL `BACKUP`/`RESTORE VERIFYONLY`/ayrı DB `RESTORE`/`DBCC CHECKDB` tatbikatı [kanıtlandı](sql-backup-restore.md). Bu turda yerel Docker ve SQL bağlantısı bulunmadığı için yeniden çalıştırılamadı. Bu kanıt Azure SQL PITR ve üretim verisi restore kabulünün yerine geçmez.

Üretimden önce operatör: Azure portalda en erken PITR noktasını, retention ve yedek storage redundancy ayarını kaydeder; staging'de üretim benzeri ayrı DB'ye PITR yapar; restore DB'sine ayrı uygulama girişiyle bağlanıp tenant, mülk, sözleşme, alacak ve ödeme sayısını ve örnek toplamları karşılaştırır; geçen süreyi ve seçilen restore noktasının son sağlam işleme uzaklığını kaydeder; geri dönüş sırasında API connection string ve DNS/health kontrolünü prova eder. Restore DB'si incelenmeden kaynak DB silinmez.

## Go/no-go kapısı

- Aynı commit için CI frontend lint/typecheck/unit/build/Playwright ve backend unit/format/gerçek SQL isolation/concurrency/migration testleri yeşil; generated OpenAPI diff temiz.
- Staging'te kayıt → e-posta doğrulama → operatör aktivasyonu → mülk → birim → kiracı → sözleşme → tahsilat → yenileme ve CSV duman testi gerçek API/SQL ile geçti; ikinci tenant IDOR negatif sonucu kaydedildi.
- R2 private bucket, signed PUT/GET, origin kısıtı, zararlı dosya ve scanner kesintisi kabul testleri gerçek staging kaynaklarıyla geçti. Secret tarayıcıya gitmiyor.
- Azure SQL PITR restore süresi/RPO ölçümü kaydedildi; önerilen hedefler operatörce kabul edildi. Üretim env, SMTP ve domain/HTTPS/host ayarları kontrol edildi.
- Uygulanacak migration scripti idempotent ve release SHA'sına ait; Azure SQL geri dönüş noktası migration öncesi kaydedildi. İşletmeci go kararı, zaman ve SHA'yı kayıt altına aldı.

Bu kapılar tam pilot kabulü içindir. CI'da [gerçek SQL ve tarayıcı kanıtı](https://github.com/erenntokgoz/mulk-yonetimi/actions/runs/43694853694) vardır. Bununla birlikte staging, gerçek R2/tarama kabulü ve Azure restore tatbikatı açık olduğundan tam pilot kabulü **no-go** durumundadır. Güncel gereksinim ve demo özeti: [16 Kasım teslim notu](teslim-notu-2026-11-16.md).

## Rollout ve rollback

1. Yeni yazmaları durdur; SQL PITR noktasını ve frontend/API sürüm SHA'sını kaydet. Staging'de denenmiş idempotent migration scriptini üretime uygula. `docs/deploy-ubuntu-azure.md` adımlarını kullan.
2. API'yi yeni image/commit ile aç; `/health`, giriş, aktif tenant izolasyonu, mülk/birim/sözleşme, alacak/tahsilat ve rapor CSV duman testlerini yap. Ardından Vercel frontend'i aynı kontrat SHA'sıyla yayımla. 409 kota ve 423 pending akışlarını kontrol et.
3. Hata varsa trafik/yazmayı durdur; önceki API ve frontend SHA'sına dön. Veri şeması geriye uyumlu değilse yalnız kod geri dönüşü yeterli değildir: olay zamanından önceki Azure PITR noktasından **yeni** DB oluştur, veriyi doğrula, bağlantıyı yeni DB'ye geçir. PITR sonrası yazımlar kaybolur; RPO/operatör kararı ve etkilenen kayıtlar ayrıca kaydedilir.
4. Health, auth, finans toplamları, worker ve ClamAV/R2 durumunu tekrar kontrol edip olayı ve süreleri kaydet. Üretimde restore provası yapılmadıkça kurtarma kanıtı tamamlanmış sayılmaz.
