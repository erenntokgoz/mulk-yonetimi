# Mülküm (Mülk Yönetimi)

Konut ve ticari gayrimenkul yöneten bireysel mülk sahipleri için SaaS uygulaması: mülk ve birimler, kiracılar, sözleşmeler, kira alacakları, tahsilatlar, depozitolar, giderler, raporlar, bildirimler ve belgeler.

Teknik mülakat projesidir; teslim tarihi `AGENTS.md` içindedir. Çalışmaya devam edecek kişi için tam durum: [docs/CODEX-HANDOFF.md](docs/CODEX-HANDOFF.md).

## Teknoloji

| Katman | Teknoloji |
| --- | --- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind 3, Vercel |
| Backend | ASP.NET Core 10 Web API, EF Core 10, ASP.NET Identity |
| Veritabanı | SQL Server (yerelde Docker, canlıda Azure SQL) |
| E-posta | MailKit, outbox tablosu ve arka plan işçisi |
| Dosyalar | Cloudflare R2 private bucket (henüz yapılandırılmadı) |

İş kuralları, kimlik doğrulama, tenant izolasyonu ve para hesapları backend'dedir. Tarayıcı yalnız Next.js BFF rotalarıyla (`frontend/app/api/bff`) konuşur. API kontratı OpenAPI'dir; `frontend/lib/api/generated.ts` buradan üretilir.

## Dizin yapısı

```text
frontend/   Next.js uygulaması ve Playwright testleri
backend/    API (src/MulkYonetimi.Api), EF Core (src/MulkYonetimi.Infrastructure), testler
deploy/     Canlı API için compose, nginx ve idempotent migration scripti
docs/       ADR'ler, denetim, yayın ve yedekleme belgeleri
```

## Yerel çalıştırma

Gereksinimler: .NET SDK 10, Node.js 24, pnpm 12.15, Docker.

```powershell
Copy-Item .env.example .env        # MULK_SQL_SA_PASSWORD için yerel bir parola yazın
docker compose up -d               # SQL Server 127.0.0.1,14333; MulkYonetimi veritabanını oluşturur
```

Migration'lar API açılışında uygulanmaz; yerel veritabanı için [backend/README.md](backend/README.md) komutlarını kullanın. API (`http://localhost:5080`):

```powershell
$env:ConnectionStrings__DefaultConnection = 'Server=127.0.0.1,14333;Database=MulkYonetimi;User Id=sa;Password=<yerel-parola>;Encrypt=True;TrustServerCertificate=True'
dotnet run --project backend/src/MulkYonetimi.Api --launch-profile http
```

Frontend (`http://localhost:3000`):

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Yerel e-posta için [docs/local-email.md](docs/local-email.md).

## Testler

```powershell
# frontend (frontend/ içinde)
pnpm lint; pnpm typecheck; pnpm test; pnpm build; pnpm test:browser   # test:browser önce build ister

# backend
dotnet build backend/MulkYonetimi.slnx -c Release
dotnet test backend/tests/MulkYonetimi.Api.Tests -c Release
dotnet format backend/MulkYonetimi.slnx --verify-no-changes
```

Gerçek SQL Server entegrasyon testleri `MULK_SQL_TEST_ADMIN_CONNECTION` (SQL Server `master` bağlantısı) ister; ayrıntı `backend/README.md` içindedir. CI (`.github/workflows/ci.yml`) frontend, backend ve integration işlerini çalıştırır.

## Yayın

Frontend Vercel'de (`main` dalı otomatik yayınlanır), API paylaşımlı bir Ubuntu sunucusunda Docker içinde, veritabanı Azure SQL'dedir. Topoloji: [ADR 003](docs/adr/003-yayin-topolojisi.md). Kurulum ve güncelleme adımları: [docs/deploy-ubuntu-azure.md](docs/deploy-ubuntu-azure.md). Yedekleme: [docs/sql-backup-restore.md](docs/sql-backup-restore.md).

## Belgeler

- [AGENTS.md](AGENTS.md): çalışma kuralları ve mimari sınırlar
- [docs/adr/](docs/adr): mimari kararlar
- [docs/requirements-audit.md](docs/requirements-audit.md): PRD, tasarım ve backlog karşısında durum
- [docs/design/public-site-plan.md](docs/design/public-site-plan.md): herkese açık site planı

## Secret politikası

Parola, token, cookie secret ve erişim anahtarları commit edilmez. `.env.example` ve `deploy/api.env.example` yalnız değişken adlarını gösterir.

## Git düzeni

`main` korumalıdır: pull request ve yeşil CI gerekir. Günlük iş `develop` dalındadır; küçük PR'larla `main`'e alınır.
