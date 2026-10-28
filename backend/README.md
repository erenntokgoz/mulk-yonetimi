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

`GET /health`, gerçek EF Core `CanConnectAsync` SQL Server kontrolünü raporlar:

```json
{
  "status": "Healthy",
  "checks": [
    { "name": "sqlserver", "status": "Healthy", "durationMs": 1.2, "description": null }
  ]
}
```

`Healthy` ve `Degraded` için HTTP 200, `Unhealthy` için HTTP 503 döner. Eksik veya erişilemeyen veritabanı sağlıklı gösterilmez. Cevap önbelleğe alınmaz. Bağlantı/exception ayrıntıları dışarı verilmez; `description` bu dilimde daima `null` olur. Bilinmeyen route ve yakalanmamış hatalar için ProblemDetails altyapısı kuruludur. Bu foundation yalnız sistem sağlık bilgisini açar; ürün yetkilendirmesi ve tenant verisi henüz yoktur.

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
