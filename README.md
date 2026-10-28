# Mülk Yönetimi

Konut ve ticari gayrimenkul yöneten bireysel mülk sahipleri için üretim odaklı SaaS uygulaması.

## Proje yapısı

```text
frontend/   Next.js 16 web uygulaması
backend/    ASP.NET Core 10 API ve testler
docs/       Tasarım, plan ve karar kayıtları
```

## Önkoşullar

- .NET SDK 10
- Node.js ve Corepack/pnpm
- Docker Desktop veya Docker Engine + Compose

Sürüm kontrolleri:

```powershell
dotnet --version
node --version
pnpm --version
docker --version
docker compose version
```

## Yerel SQL Server

1. `.env.example` dosyasını `.env` adıyla kopyalayın.
2. `MULK_SQL_SA_PASSWORD` için yalnız yerel geliştirmede kullanılacak güçlü bir parola belirleyin.
3. SQL Server'ı başlatın:

```powershell
docker compose up -d
docker compose ps -a
```

`sqlserver-init` servisi ilk sağlıklı başlangıçta `MulkYonetimi` veritabanını idempotent biçimde oluşturup çıkar. Host bağlantısı varsayılan olarak `127.0.0.1,14333` olur. Container verisi `mulk-yonetimi-sqlserver-data` named volume'ünde saklanır.

Başlangıç doğrulamasında `sqlserver` servisi `healthy`, `sqlserver-init` servisi `Exited (0)` görünmelidir. Ardından backend `/health` yanıtının `Healthy` ve `sqlserver` kontrolünün `Healthy` olduğu doğrulanmalıdır.

## Backend

Backend uygulaması varsayılan olarak `http://localhost:5080` adresinde çalışır. Bağlantı bilgisini process environment üzerinden verin:

```powershell
$env:ConnectionStrings__DefaultConnection = 'Server=127.0.0.1,14333;Database=MulkYonetimi;User Id=sa;Password=<local-password>;Encrypt=True;TrustServerCertificate=True'
dotnet run --project backend/src/MulkYonetimi.Api
```

Sağlık kontrolü:

```powershell
Invoke-RestMethod http://localhost:5080/health
```

Backend'e özgü test ve build komutları `backend/README.md` içinde tutulur.

28 Ekim 2026 yerel doğrulamasında SQL Server konteyneri `healthy`, `sqlserver-init` `Exited (0)` ve backend `/health` yanıtı HTTP 200 / `Healthy` oldu. Frontend production sunucusu HTTP 200 ile `Çalışıyor` ve `SQL Server` durumunu gösterdi. Bu makinede `localhost,14333` ile backend bağlantısı başarısız olduğu için host bağlantısında açık IPv4 adresi kullanılır.

## Frontend

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Frontend varsayılan olarak `http://localhost:3000` adresinde çalışır ve backend'e server-side `BACKEND_BASE_URL` üzerinden bağlanır. Frontend'e özgü kontroller `frontend/README.md` içinde tutulur.

## Secret politikası

Gerçek parola, cookie secret, token veya erişim anahtarı commit edilmez. `.env.example` yalnız değişken adlarını ve güvenli olmayan örnekleri belgeler; gerçek değerler `.env`, deployment secret store veya uygun secret manager içinde tutulur.

## CI

`.github/workflows/ci.yml`, push ve pull request sırasında iki bağımsız iş çalıştırır. Frontend işi `pnpm install --frozen-lockfile`, lint, typecheck, unit test ve production build yapar. Backend işi üç `packages.lock.json` dosyasıyla kilitli restore, Release build, test ve format kontrolü yapar. Bu foundation kontrolleri için SQL Server veya secret gerekmez; gerçek SQL Server entegrasyon testleri FND-02 kapsamındadır.

28 Ekim 2026'da aynı komutlar Windows üzerinde yerel olarak geçti; workflow `actionlint` ile doğrulandı. GitHub üzerindeki CI sonucu ilk push sonrasında ayrıca kontrol edilir.

## Git branch düzeni

`main` gösterim ve teslim için kararlı daldır. `develop` günlük geliştirme dalıdır; yeni işler gerektiğinde `feature/<backlog-id>` dalında geliştirilip pull request ile `develop` dalına alınır. Teslim edilecek doğrulanmış değişiklikler pull request ile `main` dalına taşınır. Frontend ve backend için kalıcı ayrı dallar kullanılmaz; iki uygulama aynı ürün değişikliklerinde birlikte sürümlenebilir.
