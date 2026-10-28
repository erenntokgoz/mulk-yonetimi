# Backend

.NET 10 Web API ve EF Core 10 SQL Server foundation. Çözüm `MulkYonetimi.slnx`; uygulama, altyapı ve API test projeleri bağımsız dizinlerdedir.

## Yerel çalıştırma

.NET 10 SDK gerekir. SQL Server'ı kök README'deki Compose adımlarıyla başlatın. `MulkYonetimi` veritabanı önceden oluşturulmalıdır; uygulama başlangıçta veritabanı oluşturmaz ve migration uygulamaz.

Bu dizinde PowerShell ile, gerçek geliştirme parolanızı yalnız ortam değişkenine verin:

```powershell
$env:ConnectionStrings__DefaultConnection = 'Server=127.0.0.1,14333;Database=MulkYonetimi;User Id=sa;Password=<development-password>;Encrypt=True;TrustServerCertificate=True;Connect Timeout=5'
dotnet restore MulkYonetimi.slnx --locked-mode
dotnet run --project src/MulkYonetimi.Api --launch-profile http
```

`TrustServerCertificate=True` yalnız yerel SQL Server içindir. Production bağlantısında doğrulanmış TLS sertifikası ve uygulamaya özel en az yetkili hesap kullanın. Bağlantı bilgisini dosyaya veya loglara yazmayın.

Compose host portu varsayılan olarak `14333` olur. Kök `.env` dosyasında `MULK_SQL_PORT` değiştirilirse bağlantı dizesindeki `127.0.0.1,14333` bölümünü aynı portla güncelleyin; API bu Compose değişkenini doğrudan okumaz.

API: `http://localhost:5080`. Development OpenAPI: `http://localhost:5080/openapi/v1.json`; production ortamında OpenAPI endpoint'i kapalıdır.

```powershell
Invoke-WebRequest http://localhost:5080/health -SkipHttpErrorCheck
```

`GET /health`, gerçek EF Core SQL Server bağlantısını ve `FAILED` outbox satırlarını kontrol eder:

```json
{
  "status": "Healthy",
  "checks": [
    { "name": "sqlserver", "status": "Healthy", "durationMs": 1.2, "description": null },
    { "name": "outbox", "status": "Healthy", "durationMs": 0.8, "description": null }
  ]
}
```

`Healthy` ve `Degraded` için HTTP 200, `Unhealthy` için HTTP 503 döner. Eksik veya erişilemeyen veritabanı sağlıklı gösterilmez. `FAILED` outbox satırı varsa durum `Degraded` olur. Cevap önbelleğe alınmaz. Bağlantı/exception ayrıntıları dışarı verilmez; `description` daima `null` olur. Bilinmeyen route ve yakalanmamış hatalar için ProblemDetails altyapısı kuruludur.

## Kontroller

```powershell
dotnet restore MulkYonetimi.slnx --locked-mode
dotnet build MulkYonetimi.slnx --no-restore --configuration Release
dotnet test MulkYonetimi.slnx --no-restore --configuration Release
dotnet format MulkYonetimi.slnx --verify-no-changes --no-restore
dotnet list MulkYonetimi.slnx package --vulnerable --include-transitive
```

API testleri gerçek HTTP uygulamasını in-process başlatır. SQL başarı/başarısızlık/degraded durumları için yalnız dış bağımlılık kontrolü test doubles ile değiştirilir; ayrıca eksik bağlantının gerçek EF health check üzerinden 503 verdiği doğrulanır. Bunlar gerçek SQL Server entegrasyon testinin yerini tutmaz. SQL Server ile başarılı bağlantı smoke testi ortam hazır olduğunda ayrıca yapılmalıdır.

Derleyici/analyzer uyarıları proje kodunda hatadır. Generated kod analyzer kapsamından hariç işaretlidir. NuGet audit, transitif bağımlılıklar dahil düşük ve üzeri tüm önem seviyelerini denetler; NU1901–NU1904 için hata istisnası yoktur. Bu nedenle güvenlik bulgusu restore kapısını başarısız kılar; `dotnet list ... --vulnerable` komutu ayrıntılı rapor içindir. SQL Client'ın transitif `System.Security.Cryptography.Pkcs` sürümü [GHSA-846f-f764-76mx](https://github.com/advisories/GHSA-846f-f764-76mx) ve [GHSA-2fmv-rv2c-59x7](https://github.com/advisories/GHSA-2fmv-rv2c-59x7) nedeniyle yamalı `10.0.14` sürümüne sabitlenmiştir.

NuGet paketleri her proje için `packages.lock.json` ile kilitlidir. Bağımlılık değiştirildiğinde `dotnet restore MulkYonetimi.slnx --use-lock-file` çalıştırıp ilgili lockfile'ı aynı değişiklikte güncelleyin; normal doğrulamada `--locked-mode` kullanın.

## EF Core migration ve ortamlar

`dotnet tool restore` ile proje içinde sabitlenmiş `dotnet-ef` 10.0.14 sürümünü kurun. Migration kaynağı `src/MulkYonetimi.Infrastructure/Migrations` dizinidir. API başlarken migration çalıştırmaz.

`Development`, `Staging` ve `Production` için `ASPNETCORE_ENVIRONMENT` ve `ConnectionStrings__DefaultConnection` değişkenlerini deployment ortamında ayrı tanımlayın. Her ortam ayrı SQL Server veritabanı ve ayrı en az yetkili kullanıcı kullanır; staging/production secret'ları repo, `appsettings*.json` veya frontend değişkenlerinde tutulmaz. Yerel development SQL Server için kök README'deki bağlantıyı kullanın. `TrustServerCertificate=True` yalnız yerel development içindir.

Migration oluşturma ve yerel development veritabanına açıkça uygulama:

```powershell
dotnet tool restore
dotnet tool run dotnet-ef migrations add <Name> --project src/MulkYonetimi.Infrastructure --startup-project src/MulkYonetimi.Api --context ApplicationDbContext --output-dir Migrations
dotnet tool run dotnet-ef database update --project src/MulkYonetimi.Infrastructure --startup-project src/MulkYonetimi.Api --context ApplicationDbContext
```

Production dağıtımında önce yedek ve restore testi tamamlanır. Sonra sürümdeki migration'lardan idempotent SQL script üretilir ve DBA/deployment onayıyla hedef staging veritabanında uygulanıp smoke test yapılır. Aynı sürüm production'a kontrollü adım olarak uygulanır; uygulama açılışı migration yetkisi taşımaz:

```powershell
dotnet tool run dotnet-ef migrations script --idempotent --project src/MulkYonetimi.Infrastructure --startup-project src/MulkYonetimi.Api --context ApplicationDbContext --output migration.sql
```

28 Ekim 2026 yerel SQL Server doğrulamasında `InitialBaseline` iki kez çalıştırıldı. İlkinde uygulandı, ikincisinde yeni migration bulunmadı; `__EFMigrationsHistory` satır sayısı 1 oldu. İdempotent scriptin history kontrolü ve migration kaydı içerdiği doğrulandı. Bu başlangıç migration'ı ürün tablosu oluşturmaz; Identity ve tenant şeması FND-03 kapsamındadır.

## Identity şeması integration testi

`IdentityAccountSchema` migration'ı `AspNetUsers`, `Accounts` ve bileşik anahtarlı `AccountMembers` tablolarını açar. Test ayrı bir geçici SQL Server veritabanı oluşturur, migration'ları uygular, geçerli üyeliği kaydeder ve olmayan hesabın FK ile reddedildiğini doğrular; test sonunda yalnız oluşturduğu veritabanını siler. Yerel çalıştırmada `MULK_SQL_TEST_ADMIN_CONNECTION` değişkenine test SQL Server `master` bağlantısını yalnız process environment üzerinden verin:

```powershell
dotnet restore tests/MulkYonetimi.IntegrationTests/MulkYonetimi.IntegrationTests.csproj --locked-mode
dotnet test tests/MulkYonetimi.IntegrationTests/MulkYonetimi.IntegrationTests.csproj --no-restore --configuration Release
```

CI, ayrı `integration` işinde SQL Server konteyneri ve GitHub Actions `MULK_SQL_TEST_PASSWORD` secret'ı kullanır. Fork pull request'lerinde repo secret'ı verilmediğinden bu iş çalışmaz. Bu şema henüz kayıt/giriş endpoint'i, aktif hesap seçimi veya tenant-scoped ürün sorgusu sağlamaz; bunlar FND-03 devamıdır.

`AccountMembershipResolver` doğrulanmış principal içindeki kullanıcı GUID'inden tek aktif OWNER üyeliğini ve aktif hesabı SQL sorgusuyla çözer. İstemci `AccountId` değeri veya claim'i yetki kaynağı değildir; doğrulanmamış e-posta, askıdaki üyelik ve birden fazla aktif üyelikte sonuç verilmez. Her ürün endpoint'inin bu sonucu zorunlu kılması FND-03'ün sonraki dilimidir. İki hesaplı gerçek SQL testi bu sınırları doğrular.

`GET /api/v1/me` Identity application cookie'sini gerektirir: anonim isteğe 401, aktif üyeliği kalmamış oturuma 403, yetkili hesaba `accountId` ile 200 döner. Cookie HttpOnly ve SameSite=Lax; staging/production HTTPS üzerinde Secure zorunludur. Endpoint önbelleğe alınmaz ve hesabı her istekte yeniden çözer. Gerçek SQL integration testi cookie, yanlış `AccountId` claim'i ve askıya alınmış üyelik akışını doğrular.

`POST /api/v1/auth/login` doğrulanmış e-posta, parola ve tek aktif hesap üyeliği ister; başarısız kimlik bilgisine 401, kullanılamayan hesaba 403 döner. `POST /api/v1/auth/logout` cookie'yi temizler. Auth mutasyonları `Auth:FrontendOrigin` ile eşleşen `Origin` başlığını zorunlu kılar; production deployment bu değeri açıkça sağlamalıdır. BFF aynı Origin'i backend'e taşır.

`POST /api/v1/auth/register` kullanıcı, hesap, OWNER üyeliği ve doğrulama e-postasını SQL outbox'a tek transaction'da kaydeder. `POST /api/v1/auth/confirm-email` tokenı doğrular. SMTP yapılandırması eksikse kayıt 503 döner; geçici SMTP hatası kaydı geri almaz, worker gönderimi tekrar dener. Worker 15 saniyede bir vadesi gelen en fazla 20 mesajı işler; 5 başarısız denemeden sonra satır `FAILED` olur. Gönderim 90 saniyede iptal edilir; iki dakikalık claim süresi daha uzundur. Başarısız denemeler yalnız mesaj ID'si, türü, deneme sayısı ve durumu ile loglanır; alıcı, URL ve token loglanmaz. `/health` outbox için `FAILED` satırı varsa `Degraded` bildirir, sayı yalnız yapılandırılmış sağlık denetimi verisinde ve sunucu logunda bulunur. Mesajdaki URL ve Identity tokenı Data Protection ile şifreli saklanır; outbox payload sürümü 1'dir. `Email__WorkerEnabled=false` yalnız otomatik işleyiciyi kapatır; normal ortamda açık tutun. Outbox migration'ını uygulama açılışından önce kontrollü dağıtım adımıyla çalıştırın. Production için `Email__SmtpHost`, `Email__SmtpPort` (varsayılan 587), `Email__From`, `Email__SmtpUser`, `Email__SmtpPassword`, `Auth__FrontendOrigin` ve `Auth__DataProtectionKeysPath` ayarlanmalıdır. Keys path kalıcı ve çoklu instance arasında ortak olmalıdır; eksikse uygulama başlatılmaz. SMTP sunucusu STARTTLS desteklemelidir. Gerçek sağlayıcı teslimi staging ortamında ayrıca doğrulanmalıdır.

`POST /api/v1/auth/resend-confirmation` ve `/forgot-password` geçerli e-posta için hesap bulunmasa da 202 döner; `/reset-password` Identity tokenıyla yeni parolayı kaydeder. Cookie her istekte security stamp ve doğrulanmış e-posta açısından kontrol edilir; parola sıfırlanınca eski oturum kullanılamaz. Auth POST uçları istemci IP'si başına dakikada 25 istekle sınırlandırılır (429, `Retry-After: 60`). Ters proxy varsa yalnız o proxy'nin IP adresini `Network__KnownProxies__0` (gerekiyorsa sonraki indeksler) üzerinden verin; `X-Forwarded-For` ve `X-Forwarded-Proto` yalnız bu adresten kabul edilir ve tek hop işlenir. Proxy adresi tanımlı değilse forwarded header işleme kapalıdır. Bu ayar gerçek staging proxy'siyle doğrulanmalıdır. Sayaç hâlâ instance içindedir; çoklu instance dağıtımında ortak bir store ve dağıtık limit tasarımı gerekir.
