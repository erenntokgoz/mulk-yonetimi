# Kurtarma durumu · 13 Kasım 2026

İncelenen taban `develop` / `cf15bb0`. Yerel mülk değişikliklerinin kontrolleri ayrıca belirtildi. Kapsam karşılaştırması PRD v1.1 §6 ve §13, Teknik Tasarım v1.1 §9–10 ve Backlog v1.1 üzerinden yapıldı.

## Yerel ortam

Ana sohbet WSL 3.0.5 ve Virtual Machine Platform'u etkinleştirdi. Yeniden başlatma gerekmedi. Docker Desktop yeniden başlatıldıktan sonra Linux motoru 29.8.1 erişilebilir oldu. Docker'ın CLI ve kimlik bilgisi yardımcı programları için kullanıcı kurulumunun `resources\bin` dizini PowerShell oturumunun PATH'ine eklenir.

### Kurtarma öncesi bulgular

- Windows 11 Pro 26H2, yapı `26300.9711`. `HypervisorPresent=True` ve `vmcompute` çalışıyor. BIOS değişikliği veya Windows yükseltmesi gerektiğini gösteren bir hata görülmedi.
- `wsl --version` ve `wsl --list --verbose` kod 1 ile WSL'nin kurulu olmadığını bildirdi. Windows özellik envanterinde `VirtualMachinePlatform` ve `Microsoft-Windows-Subsystem-Linux` devre dışı (`InstallState=2`). DISM kod 740 döndürdü. Bu oturum yönetici yetkisine sahip değil.
- Docker Desktop kullanıcı kurulumunda `%LOCALAPPDATA%\Programs\DockerDesktop` altında bulundu. `desktop-linux` motoru `Docker Desktop is unable to start` döndürdü. Kullanıcının paylaştığı Docker Desktop ekranı `Virtualization support not detected` uyarısı gösteriyor. Windows tarafındaki teşhis sürüyor. Podman, SQL Server servisi, `1433` / `14333` üzerinde dinleyici veya tanımlı uzak SQL bağlantısı bulunamadı.

### Kurulumu doğrulama

Normal PowerShell'de WSL ve Docker motorunu doğrulayın. [Microsoft WSL kurulumu](https://learn.microsoft.com/en-us/windows/wsl/install), [Docker Desktop kurulumu](https://docs.docker.com/desktop/setup/install/windows-install/).

```powershell
wsl --version
$env:Path = "$(Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin');$env:Path"
docker --context desktop-linux version
```

[Yerel SQL Server kurulumundaki](../README.md#yerel-sql-server) `.env` adımlarını uygulayın. Repo kökünde `docker --context desktop-linux compose up -d` ve `docker --context desktop-linux compose ps -a` çalıştırın. `sqlserver` için `healthy`, `sqlserver-init` için `Exited (0)` beklenir. Test SQL Server'ının `master` bağlantısını `MULK_SQL_TEST_ADMIN_CONNECTION` olarak yalnız işlem ortamına verin. `backend/` içinden CI ile aynı projeyi çalıştırın.

```powershell
dotnet restore tests/MulkYonetimi.IntegrationTests/MulkYonetimi.IntegrationTests.csproj --locked-mode
dotnet test tests/MulkYonetimi.IntegrationTests/MulkYonetimi.IntegrationTests.csproj --no-restore --configuration Release
```

## Güncel kontroller

| Kontrol | Sonuç |
| --- | --- |
| Backend solution | Kilitli restore, Release build ve 8/8 test geçti. |
| Backend format | Çalışma ağacında `HealthResponse.cs` CRLF nedeniyle başarısız. Git indeksi ve `eol=lf` kuralı LF kullanıyor. Aynı commit'in arşiv kopyasında solution formatı geçti. Entegrasyon projesi formatı çalışma ağacında geçti. |
| Frontend | `cf15bb0` arşiv kopyasında kilitli kurulum, lint, typecheck, 10/10 birim testi, production build ve 19/19 Playwright testi geçti. Playwright, test API sunucusunu kullanıyor. |
| Yerel gerçek SQL Server | 13 Kasım'da `sqlserver` sağlıklı, `sqlserver-init` çıkış kodu 0. Güncel çalışma ağacında Release derleme ve 3/3 SQL entegrasyon testi geçti. Yerel `MulkYonetimi` veritabanına mülk, birim ve kiracı migration'ları uygulandı. |
| CI gerçek SQL Server | Bu incelemede `cf15bb0` için yeniden tetiklenen çalışmanın ikinci denemesinde SQL konteyneri başlatıldı. Entegrasyon testi ve format adımları geçti. [GitHub Actions entegrasyon işi](https://github.com/erenntokgoz/mulk-yonetimi/actions/runs/40774747187/job/131108020015). |

**Yerel portföy değişiklikleri.** Önceki kontrat koşusunda `PropertyContractTests` 9/9 geçti. 13 Kasım'da `IdentitySchemaTests`, `AccountMembershipResolverTests` ve iki hesaplı `PropertyIsolationTests` kendi geçici SQL Server veritabanlarında geçti. Geliştirme API'sinin `/health` yanıtında SQL Server ve outbox `Healthy`.

**Frontend entegrasyonu.** [OpenAPI JSON](http://127.0.0.1:5080/openapi/v1.json) HTTP 200 döndü. OpenAPI 3.1.1 belgesinde 16 yol var. Next.js sunucusunu `BACKEND_BASE_URL=http://127.0.0.1:5080` ve `FRONTEND_ORIGIN=http://localhost:3000` ile başlatın. Tarayıcıda `http://localhost:3000` kullanın. Gerçek API ile Playwright kabulü için iki doğrulanmış yerel test hesabıyla giriş, mülk oluşturma ve listeleme ile diğer hesaptan erişim reddini sınayın. Kayıt ve e-posta doğrulamasını kapsayan koşu için yerel SMTP yakalayıcısı ve etkin outbox işçisi gerekir. Şu anki API e-posta işçisi kapalı. Gerçek tarayıcı koşusu bekliyor.

**Yerel e-posta ve sözleşmeler.** STARTTLS etkin Mailpit [gelen kutusu](http://127.0.0.1:8025/) ve SMTP `localhost:1025` üzerinde çalışıyor. `LeaseLedger` migration'ı uygulandı. Geçici publish dizininden çalışan API'nin [OpenAPI belgesi](http://127.0.0.1:5080/openapi/v1.json) sözleşme uçlarını içeriyor. Outbox işçisi etkin, API sağlık kontrolü geçti. 13 Kasım'da localhost sertifikası doğrulandı. Gerçek API ve SQL ile kayıt (202), doğrulama öncesi giriş reddi (401), Mailpit STARTTLS teslimi, doğrulama (204), giriş (204) ve hesap üyeliği (200) geçti. [Yerel e-posta kılavuzu](local-email.md).

**Yedekleme.** Ayrı yerel SQL test veritabanında checksum, doğrulama, geri yükleme, satır kontrolü ve `DBCC CHECKDB` geçti. [Tatbikat kılavuzu](sql-backup-restore.md).

Kaynak kararları [finans şeması ADR'sinde](adr/001-finans-semasi.md) ve [video referansı ADR'sinde](adr/002-video-referansi.md) kayıtlı.

**Finans kontratı · 13 Kasım.** `PaymentsLedger` ve `ChargeCorrections` yerel `MulkYonetimi` veritabanına uygulandı. Geçici publish dizininden çalışan API'de SQL Server ve outbox sağlıklı. [Güncel OpenAPI 3.1.1](http://127.0.0.1:5080/openapi/v1.json) 27 yol içeriyor. Alacak listeleme/düzeltme ile tahsilat listeleme, detay, oluşturma, dağıtım ve void uçları yayımlanıyor. Frontend bu adresten `pnpm api:types` ile tip üretebilir.

**Yeni kod için CI.** Kullanıcı onayıyla değişiklikler aynı depodaki bir dala gönderildiğinde mevcut `push` veya aynı depo `pull_request` tetikleyicisi SQL entegrasyon işini çalıştırır. Yeni SHA'yı `gh run list --commit <SHA> --workflow ci.yml` ile eşleştirin. `gh run watch <RUN_ID> --exit-status` sonrası `integration` adımının geçtiğini ve günlükte mülk testi dahil üç testin geçtiğini kontrol edin. `cf15bb0` çalışmasını yeniden tetiklemek yerel değişiklikleri kapsamaz. Gerçek API'ye bağlı tarayıcı yolunun doğrulanması için API ve Next.js'in aynı test ortamında başlatılması gerekir.

## MVP kapsamı

| Durum | Kanıt ve açık işler |
| --- | --- |
| Tamamlanan altyapı dilimi | FND-01 kapsamında Next.js ve .NET iskeleti, kilit dosyaları ve üç CI işi var. Frontend ve backend temel kontrollerinin güncel sonuçları yukarıda. |
| Kısmi altyapı ve kimlik | FND-02/03/05 ve AUTH-01/02. `compose.yaml`, Identity/Account migration'ları, tek etkin üyeliği çözen `/api/v1/me`, kayıt/doğrulama/giriş/çıkış/parola sıfırlama ve SQL e-posta outbox'ı mevcut. Yerel API ve SMTP ile onboarding geçti. Tarayıcı, ürün verisine tenant sınırı ve ayrı staging/prod ortamlarının kabulü izleniyor. |
| Kısmi arayüz ve kontrat | ARCH-01/02/03/05. Türkçe masaüstü/mobil kabuk, BFF ve durum sayfaları mevcut. `frontend/app/[section]/page.tsx` ürün ekranlarına kullanılamıyor durumu gösteriyor. API OpenAPI yayımlıyor. Frontend API tip üretimi ve kontrat uyumluluk kapısı görünmüyor. |
| Açık iş akışları | Yerel PORT-01 uygulamasında iki hesaplı SQL testi geçti. Gerçek API ile tarayıcı doğrulaması bekliyor. PORT-02–04, TEN, LEASE, CHG, PAY, DEP, EXP, DOC, RPT ve NTF akışlarının teslim doğrulaması açık. AUTH-03, plan/kota ve pilot aktivasyonu (SAAS-01/02), ürün audit'i (FND-04) ve geri yükleme tatbikatı (FND-06) açık. |
| Eksik yayın kanıtı | QA-01–04 kısmi. Kimlik üyeliği senaryosu mevcut. Ürün ID'leriyle iki hesap arasında negatif okuma/yazma, finansal concurrency, R2 güvenlik kontrolleri ve gerçek kayıt → tahsilat → yenileme senaryosu bekliyor. ARCH-04/06 ve REL-01/02 için yayın kabulü, ortam ayrımı ve operasyon kanıtı açık. |

## Öncelikli kullanıcı akışları

1. **Hesap ve ilk mülk (AUTH-01/02, PORT-01).** Kayıt, e-posta doğrulama ve girişten sonra kullanıcı bir mülk oluşturur ve kendi listesinde görür. İlk teslim dilimi budur. `AccountId` oturum üyeliğinden gelir. İki hesapla liste ve bilinen kimlik üzerinden yetkisiz okuma/yazma denemeleri gerçek SQL'de doğrulanır.
2. **Kiralamayı başlatma (PORT-02–04, TEN-01/02, LEASE-01–03).** Kullanıcı birim ve kiracı ekler, sözleşme taslağını etkinleştirir. Birim doluluğu etkin sözleşmeden türetilir. Çakışan sözleşmeler reddedilir.
3. **Tahsilat ve yenileme (CHG, PAY, LEASE-04/05, RPT-02).** Dönem alacağı bir kez oluşur. Kullanıcı kısmi ödeme kaydeder, kalan bakiyeyi görür ve kira değişikliğini sonraki döneme uygular. Yenileme geçmiş alacakları korur. Bu yol QA-03 için gerçek API ve SQL ile Playwright'ta doğrulanır.

Her teslim diliminde video referansındaki ilgili ekranın yerleşimi, gezinmesi ve bileşenleri masaüstü ve mobilde kontrol edilir. Türkçe arayüz gerçek API verisini kullanır. Boş, yükleniyor ve hata durumları ayrıdır.

## Açık API kontratları

- Çalışma ağacındaki mülk listeleme, oluşturma, detay, düzenleme ve arşivleme uçları geliştirme ortamında OpenAPI belgesinde yer alıyor. Sonraki akışlar birim, kiracı, sözleşme, alacak, tahsilat ve raporlama kontratlarına bağlı.
- CI backend işinde mülk OpenAPI ve API kontrat testleri ayrı adımda çalışır. Bu adım mevcut uçları ve yanıt kodlarını denetler. OpenAPI'den frontend tipi üretimi ve önceki yayınla şema uyumluluğunun denetlenmesi açık.
