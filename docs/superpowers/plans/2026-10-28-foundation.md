# Mülk Yönetimi Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js frontend, ASP.NET Core backend ve SQL Server geliştirme altyapısı için üretim odaklı, doğrulanabilir başlangıç iskeleti kurmak.

**Architecture:** Tek repository içinde frontend ve backend bağımsız uygulamalardır. Backend iş kurallarının ve verinin tek otoritesidir; frontend HTTP/OpenAPI kontratı üzerinden konuşur. Kök altyapı SQL Server ve ortak çalıştırma sözleşmesini sağlar.

**Tech Stack:** Next.js 16, TypeScript, pnpm, ASP.NET Core 10, C#, EF Core 10, Microsoft SQL Server, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-28-foundation-design.md`

## Global Constraints

- Frontend ajanı yalnız `frontend/`, backend ajanı yalnız `backend/` altında dosya değiştirir.
- Ana ajan kök dosyaları, Docker, dokümantasyon ve entegrasyonu yönetir.
- Repo kullanıcı tarafından henüz oluşturulmadığı için commit veya push yapılmaz.
- Secret, gerçek parola ve erişim anahtarı dosyalara yazılmaz.
- Frontend SQL Server'a doğrudan erişmez.
- Backend health kontratı `GET /health` üzerinden JSON ve uygun HTTP durum kodu üretir.
- SQL Server container verisi named volume üzerinde tutulur.

## Review Focus

- SQL Server hazır değilken backend'in yanıltıcı şekilde sağlıklı görünmemesi.
- Eksik frontend API URL'sinin sessizce yanlış hosta bağlanmaması.
- Development secret örneklerinin production credential sanılmaması.
- Windows üzerinde Docker/port komutlarının tekrar çalıştırılabilir olması.
- Frontend ve backend başlangıç komutlarının birbirinden bağımsız çalışması.

---

### Task 1: Kök çalışma alanı ve SQL Server altyapısı

**Files:**
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `compose.yaml`
- Create: `README.md`

**Interfaces:**
- Produces: SQL Server host portu, database adı ve backend'in kullanacağı environment variable adları.
- Consumes: Yok.

- [x] **Step 1:** `.env.example` içinde yalnız development placeholder değerleri tanımla.
- [x] **Step 2:** SQL Server named volume, healthcheck ve environment değişkenlerini kullanan `compose.yaml` oluştur.
- [x] **Step 3:** .NET, Node, IDE, OS ve secret çıktıları için kök `.gitignore` oluştur.
- [x] **Step 4:** C# ve TypeScript için temel satır sonu/encoding kurallarını `.editorconfig` içinde tanımla.
- [x] **Step 5:** README'ye önkoşullar ve üç bileşenin başlatma sırasını yaz.
- [x] **Step 6:** `docker compose config` ile Compose sözleşmesini doğrula.

### Task 2: Backend başlangıç iskeleti

**Files:**
- Create: `backend/MulkYonetimi.slnx`
- Create: `backend/src/MulkYonetimi.Api/**`
- Create: `backend/src/MulkYonetimi.Infrastructure/**`
- Create: `backend/tests/MulkYonetimi.Api.Tests/**`
- Create: `backend/Directory.Build.props`
- Create: `backend/README.md`

**Interfaces:**
- Consumes: Kök environment değişkenleri ve SQL Server bağlantı bilgisi.
- Produces: `GET /health`, OpenAPI belgesi ve `dotnet test` komutu.

- [x] **Step 1:** Health endpoint davranışını doğrulayan başarısız API testini yaz ve çalıştır.
- [x] **Step 2:** .NET 10 solution ve projeleri oluştur; nullable ve warnings-as-errors politikasını tanımla.
- [x] **Step 3:** EF Core SQL Server bağlantısını environment tabanlı yapılandır.
- [x] **Step 4:** SQL Server health check içeren `GET /health` endpoint'ini uygula.
- [x] **Step 5:** OpenAPI ve tutarlı ProblemDetails temelini ekle.
- [x] **Step 6:** Testleri, build'i ve format kontrolünü çalıştır; komutları backend README'ye yaz.

### Task 3: Frontend başlangıç iskeleti

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/pnpm-lock.yaml`
- Create: `frontend/app/**`
- Create: `frontend/lib/api/**`
- Create: `frontend/tests/**`
- Create: `frontend/.env.example`
- Create: `frontend/README.md`

**Interfaces:**
- Consumes: Backend base URL ve `GET /health` JSON kontratı.
- Produces: Next.js uygulaması, typed health istemcisi ve doğrulama komutları.

- [x] **Step 1:** Health istemcisinin başarı ve ağ hatası davranışları için başarısız testleri yaz ve çalıştır.
- [x] **Step 2:** Next.js 16 App Router TypeScript uygulamasını pnpm ile oluştur.
- [x] **Step 3:** Server-only backend URL doğrulamasını ve typed health istemcisini uygula.
- [x] **Step 4:** Ana sayfada sade uygulama kabuğu ve backend durumunu erişilebilir biçimde göster.
- [x] **Step 5:** ESLint, typecheck, test ve production build scriptlerini tanımla.
- [x] **Step 6:** Bütün kontrolleri çalıştır ve komutları frontend README'ye yaz.

### Task 4: Entegrasyon ve son doğrulama

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `compose.yaml`
- Modify: yalnız entegrasyon için zorunlu frontend/backend konfigürasyon dosyaları.

**Interfaces:**
- Consumes: Task 1-3 çıktıları.
- Produces: Tekrarlanabilir local startup ve doğrulanmış frontend-to-backend health akışı.

- [x] **Step 1:** Ajan değişikliklerinin dosya sahipliği sınırlarını ihlal etmediğini kontrol et.
- [x] **Step 2:** Environment variable adlarını ve portları frontend, backend ve Compose arasında eşleştir.
- [x] **Step 3:** SQL Server'ı başlat ve healthcheck'in başarılı olmasını bekle.
- [x] **Step 4:** Backend test/build ve frontend lint/typecheck/test/build komutlarını çalıştır.
- [x] **Step 5:** Frontend'in backend health sonucunu gösterebildiğini smoke test ile doğrula.
- [x] **Step 6:** README'yi yalnız doğrulanmış komut ve sonuçlarla güncelle.
