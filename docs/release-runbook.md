# Yayın ve geri dönüş kılavuzu

Hedef, Next.js için Vercel ve ASP.NET Core 10 API için IIS. Aşağıdaki ayarları hedef ortamın sahibi doldurur. Staging provası ve üretim yayını kayıt altına alınır.

## Ortam ayarları

| Ayar | Yerel | Staging ve üretim |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | Her ortam için ayrı HTTPS origin ve Vercel sunucu ortamı. |
| API | `http://127.0.0.1:5080` | Ayrı HTTPS IIS bağlaması ve uygulama havuzu. .NET 10 Hosting Bundle kurulu. |
| `BACKEND_BASE_URL`, `FRONTEND_ORIGIN` | Yerel API ve frontend | Vercel server env. İlgili HTTPS API ve frontend origin. |
| `Auth__FrontendOrigin`, `AllowedHosts` | Yerel geliştirme ayarları | API'de tam frontend origin ve API host izin listesi. `Network__KnownProxies__0` yalnız gerçek güvenilir proxy varsa. |
| `ConnectionStrings__DefaultConnection` | Compose SQL | Ortama özel private SQL Server/DB ve en az yetkili çalışma hesabı. Migration için ayrı yetkili kimlik. |
| `Auth__DataProtectionKeysPath` | Geliştirme varsayılanı | Yayın klasörü dışında kalıcı, ortama özel konum. Erişim uygulama kimliğiyle sınırlı. Çoklu instance için paylaşılan anahtar koruması ve worker eşgüdümü staging'de doğrulanır. |
| `Email__SmtpHost`, `Email__SmtpPort`, `Email__From`, `Email__SmtpUser`, `Email__SmtpPassword` | Mailpit | Ortama özel STARTTLS SMTP. Staging teslimi test adresleriyle sınırlanır. |
| R2 | Özel geliştirme bucket'ı sağlandığında | Ortama özel private bucket ve bucket kapsamlı kimlik bilgileri. CORS izin listesi ilgili frontend origin'i kapsar. R2 uygulama ve kabul testi açık. |

Secret'ları hosting secret deposu veya erişim kontrollü sunucu ayarlarından enjekte edin. Backend bağlantısı ve kimlik bilgileri sunucu kapsamındadır. API için `ASPNETCORE_ENVIRONMENT=Production` kullanın. Origin ve cookie denetimlerini staging'de gerçek HTTPS adresleriyle sınayın.

## Yayın

1. İncelenen commit SHA'yı ve CI sonuçlarını kaydedin. Frontend, backend ve gerçek SQL işleri geçmeli. CI push çalışması API publish çıktısı ile idempotent `migrate.sql` dosyasını `api-release-<SHA>` artifact'inde hazırlar. İki uygulama aynı SHA'dan yayımlanır.
2. Staging'de mevcut sürüm ve hedef sürümle şema uyumluluğunu kontrol edin. `migrate.sql` dosyasını inceleyin. SQL yedeğini uygulama hacmi dışında erişim kontrollü konuma alın ve ayrı DB'ye geri yükleme provası yapın. [Yerel tatbikat](sql-backup-restore.md).
3. Staging'de scripti yetkili migration kimliğiyle uygulayın. IIS'e yeni publish dizinini bağlayın. Vercel'de aynı SHA'yı ilgili ortam değişkenleriyle yayımlayın. API `/health`, HTTPS, cookie giriş/çıkış, izin dışı Origin reddi, iki hesaplı veri sınırı ve kritik iş akışlarını doğrulayın.
4. Staging kanıtı, pilot kabulü, hukuk/politika onayı ve üretim yapılandırması doğrulandıktan sonra onaylı bakım aralığında üretimde aynı artifact'i kullanın. Şema geçişi boyunca eski sürüm desteklenmiyorsa yazmaları bakım süresince durdurun. Smoke test ve hata oranlarını kaydedin. Önceki Vercel deployment ve IIS publish dizinini geri dönüş için saklayın.

## Geri dönüş

- Önceki API yeni şemayla uyumluysa IIS'i önceki publish dizinine bağlayın ve önceki Vercel deployment'ını etkinleştirin. Aynı ortam ayarları ve Data Protection anahtarları kullanılır. Sağlık ve oturum testlerini tekrarlayın.
- Şema uyumsuzsa yazmaları durdurun. Migration sonrası işlemlerin kaybını ve yeniden uygulanmasını değerlendirin. Yedeği ayrı DB'ye geri yükleyip bütünlüğü doğrulayın. Onaylı bağlantı geçişi ile API'yi geri alın. Geri dönüş kararı, kullanılan yedek, SHA ve duman testi sonuçlarını kaydedin.

## Yerel API'yi güncel publish çıktısından çalıştırma

Önceki yerel API oturumunu kapatın. Repo kökünden çalıştırın. Secret, Git'in yok saydığı yerel `.env` dosyasından process ortamına alınır. Aşağıdaki komut Compose'un varsayılan SQL portunu kullanır.

```powershell
$line = Get-Content .env | Where-Object { $_.StartsWith('MULK_SQL_SA_PASSWORD=') }
if (!$line) { throw 'Yerel SQL parolası tanımlanmalı.' }
$password = $line.Substring('MULK_SQL_SA_PASSWORD='.Length)
$env:ConnectionStrings__DefaultConnection = "Server=127.0.0.1,14333;Database=MulkYonetimi;User Id=sa;Password=$password;Encrypt=True;TrustServerCertificate=True"
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Email__WorkerEnabled = 'false'
$publish = Join-Path $env:TEMP ('mulk-api-' + [guid]::NewGuid().ToString('N'))
Set-Location backend
dotnet publish src/MulkYonetimi.Api -c Release -o $publish
if ($LASTEXITCODE) { throw 'API publish başarısız.' }
dotnet tool restore
if ($LASTEXITCODE) { throw 'EF aracı yüklenemedi.' }
dotnet tool run dotnet-ef database update --project src/MulkYonetimi.Infrastructure --startup-project src/MulkYonetimi.Api --context ApplicationDbContext --configuration Release --no-build
if ($LASTEXITCODE) { throw 'Yerel migration başarısız.' }
Set-Location $publish
dotnet MulkYonetimi.Api.dll --urls http://127.0.0.1:5080
```

Başka oturumdan `/health` ve [OpenAPI JSON](http://127.0.0.1:5080/openapi/v1.json) kontrol edilir. E-posta akışı için [yerel SMTP kılavuzunu](local-email.md) izleyin.
