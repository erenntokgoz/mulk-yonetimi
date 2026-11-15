# Yerel kayıt ve e-posta doğrulama

Repo kökünde, Docker ve yerel SQL Server çalışırken geliştirme sertifikasını dışa aktarın. Windows sertifika güven onayını gösterirse localhost geliştirme sertifikasını onaylayın. Sertifika ve özel anahtar Git tarafından yok sayılır.

```powershell
New-Item -ItemType Directory -Force .local/mailpit | Out-Null
dotnet dev-certs https --export-path .local/mailpit/smtp.pem --format Pem --no-password --trust
docker compose --profile dev-mail up -d mailpit
```

Yerel SQL bağlantısını README'deki gibi `ConnectionStrings__DefaultConnection` ortam değişkenine ayarlayın ve migration'ları uygulayın. API'yi ayrı PowerShell oturumunda başlatın.

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Auth__FrontendOrigin = 'http://localhost:3000'
$env:Email__WorkerEnabled = 'true'
$env:Email__SmtpHost = 'localhost'
$env:Email__SmtpPort = '1025'
$env:Email__From = 'no-reply@example.test'
$publish = Join-Path $env:TEMP ('mulk-api-' + [guid]::NewGuid().ToString('N'))
dotnet publish backend/src/MulkYonetimi.Api -c Release -o $publish
if ($LASTEXITCODE) { throw 'API derlenemedi.' }
Set-Location $publish
dotnet MulkYonetimi.Api.dll --urls http://127.0.0.1:5081
```

Next.js sunucusunu `BACKEND_BASE_URL=http://127.0.0.1:5081` ve `FRONTEND_ORIGIN=http://localhost:3000` ile başlatın. `localhost:3000/kayit` üzerinden benzersiz bir `@example.test` adresiyle kayıt olun. Mailpit gelen kutusundaki doğrulama bağlantısını açın ve aynı hesapla giriş yapın. Bağlantıdaki belirteci test çıktısına yazdırmayın.

[Mailpit gelen kutusu](http://127.0.0.1:8025/) · [Mailpit API](http://127.0.0.1:8025/api/v1/) · [Uygulama OpenAPI](http://127.0.0.1:5081/openapi/v1.json) · [Mailpit SMTP ayarları](https://mailpit.axllent.org/docs/configuration/smtp/)

## E-posta şablonları

Tüm iletiler `backend/src/MulkYonetimi.Api/EmailLayout.cs` içindeki ortak düzenle `multipart/alternative` olarak gider. Her iletide HTML ve düz metin bölümü vardır. Metinler `EmailTemplates.cs` ve `NotificationCopy.cs` dosyalarındadır. Örnek verilerle üretilmiş görünümler [docs/email-previews](email-previews/) klasöründedir. Bir şablonu değiştirdikten sonra önizlemeleri yenileyin.

```powershell
$env:MULK_WRITE_EMAIL_PREVIEWS = '1'
dotnet test backend/tests/MulkYonetimi.Api.Tests -c Release --filter "FullyQualifiedName~EmailPreviewTests"
Remove-Item Env:MULK_WRITE_EMAIL_PREVIEWS
```

Değişken olmadan çalışan test, kayıtlı önizlemeler şablon çıktısıyla aynı değilse başarısız olur.
