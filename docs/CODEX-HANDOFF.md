# Codex devir notu: Mülküm

Bu belge yeni bir oturumda hiçbir şey sormadan devam etmek için yazıldı. Önce bu belgeyi, sonra `AGENTS.md` dosyasını oku. Başarı iddialarını güncel kod ve test sonuçlarıyla doğrula.

## 1. Proje ve hedef

- Ürün adı Mülküm (depo adı `mulk-yonetimi`): konut ve ticari gayrimenkul yöneten bireysel mülk sahipleri için SaaS.
- Bir şirkete yapılan teknik mülakat projesidir. `AGENTS.md` teslimi 20 Kasım 2026 olarak yazar; sahip 15 Kasım 2026 civarını da anmıştır. Kısa dilimlerle çalış, güvenli çekirdeği geniş ama yarım ürüne tercih et.
- Şirket kaynakları (depo dışında): `C:\Users\Eren Tokgöz\Desktop\Mülk Yönetimi\Mulk_Yonetimi_MVP_PRD_v1.1.md`, `Mulk_Yonetimi_Technical_Design_v1.1.md`, `Mulk_Yonetimi_MVP_Backlog_v1.1.csv`. Çelişen gereksinimde sessiz karar verme, ADR yaz (`docs/adr/`).
- Depo: `C:\Users\Eren Tokgöz\Desktop\Projects\mulk-yonetimi`, günlük dal `develop`.

## 2. Uyulacak kurallar

AGENTS.md sert kuralları:

- Monorepo: `frontend/`, `backend/`, `docs/`, `deploy/`. Frontend yalnız `frontend/`, backend yalnız `backend/` içinde değişir; kök dosyalar, CI, Docker ve dokümantasyon ana ajandadır.
- İş kuralları, kimlik doğrulama, tenant izolasyonu ve para hesapları backend'dedir. Frontend SQL Server'a veya R2 secret'larına doğrudan erişmez.
- API kontratı OpenAPI'dir; `frontend/lib/api/generated.ts` elle düzenlenmez, `pnpm api:types` ile üretilir.
- İş tarihleri `DateOnly`/SQL `date`, olay zamanları UTC. Para `decimal(19,2)`, `float`/`double` yok. Kira alacağı tekilliği `(AccountId, LeaseId, PeriodStart)`. Finansal kayıt hard-delete edilmez; void veya açık düzeltme kullanılır.
- Özellik ve hata düzeltmesinde TDD. Beklenmeyen davranışta önce sistematik teşhis. En küçük eksiksiz değişiklik; gereksiz bağımlılık ve soyutlama yok.
- Secret, token, cookie ve kişisel veri loglanmaz, commit edilmez.
- Backend unit test, EF/migration/tenant/concurrency için gerçek SQL Server integration testi. İki tenant ile IDOR/cross-tenant negatif testi zorunludur.
- "Tamamlandı" demeden önce ilgili test, lint, typecheck ve build çalışır; çalışmayan veya başarısız kontrol açıkça raporlanır.

Sahip tercihleri:

- Arayüz sade, profesyonel Türkçe. Karşılama, pazarlama ve dolgu cümlesi yok. Gerçek veri olmadan örnek mülk, rakam veya çalışıyormuş gibi görünen düğme yok. Boş, yükleniyor ve hata durumları ayrı.
- Görünüm: cam yüzeyler, kompakt koyu menü, ince ışıklı kenarlar. Sürükleme (drag) yok. Arka plan daireleri yok. `prefers-reduced-motion` desteklenir. Her sayfa mobil önce denetlenir (375 px, taşma yok, 44 px dokunma hedefi), klavye ve erişilebilirlik kabul koşuludur.
- İş akışı: küçük PR'lar, `develop` dalından `main`'e. `main` korumalıdır: PR ve yeşil CI gerekir, `--admin` ile asla atlama. `main`'e birleşince Vercel otomatik yayınlar.
- Sahip minimum gidiş-geliş ister: soru sormadan karar ver, kısa rapor yaz. Çözülemeyen tek şey ona sorulur.
- Çalışma ağacında izlenmeyen `frontend/*.png` ve `frontend/lint.txt` gibi dosyalar sahibe aittir veya çöptür; asla stage etme. `frontend/next-env.d.ts` build sonrası değişir, commit etme (`git checkout frontend/next-env.d.ts`).

## 3. Mimari ve depo haritası

```text
frontend/
  proxy.ts                    Next 16 proxy: oturum çerezi yoksa korumalı yollar /giris'e yönlenir.
                              Herkese açık: /, /giris, /kayit, /dogrula, /dogrulama-yeniden-gonder,
                              /parolami-unuttum, /parola-sifirla
  app/page.tsx                Herkese açık tanıtım sayfası (ADR 004)
  app/panel/page.tsx          Genel bakış (eskiden /)
  app/[section]/page.tsx      Bölüm sayfaları (portföy, kiracılar, ...); bilinmeyen bölüm şu an /giris'e düşer
  app/api/bff/**/route.ts     BFF: tarayıcı yalnız bununla konuşur, backend'e sabit yolları taşır
  components/*-directory.tsx, rent-collection, document-library, settings-dashboard, report-dashboard
                              Bölüm ekranları (gerçek API'ye bağlı)
  components/dashboard-shell, section-navigation, mobile-menu, sidebar-toggle, theme-control, session-control
                              Kabuk; shell-shortcuts.tsx: Ctrl+B kenar çubuğu, Ctrl+K arama
  components/brand-mark.tsx   Marka işareti (iki çatı M); kaynak lib/brand-mark-svg.ts, sekme simgesi app/icon.svg
  components/landing/         Tanıtım sayfası (hero-scene, landing-actions, landing.module.css)
  lib/api/generated.ts        OpenAPI'den üretilir; lib/api/auth-bff.ts, lib/api/health.ts
  tests/*.test.ts             Node test runner; tests/browser/*.spec.ts Playwright
backend/
  src/MulkYonetimi.Api/       Program.cs (Identity, cookie, rate limit, health, OpenAPI, uçların kaydı)
    *Endpoints.cs             Property, Unit, Tenant, Lease, RentCharge, Payment, Deposit, Expense, Report,
                              Notification, AccountSettings, Document uç noktaları
    EmailOutbox.cs            Outbox işçisi ve EmailOutboxHealthCheck (FAILED satır varsa Degraded)
    Registration.cs           Kayıt ve MailKit ile SMTP gönderimi
    RentRules.cs, RentChargeJob.cs, NotificationJob.cs, DocumentCleanupJob.cs
    R2DocumentStorage.cs, DocumentMalwareScanning.cs   Belge hattı (fail-closed)
  src/MulkYonetimi.Infrastructure/   ApplicationDbContext, varlıklar, Migrations/
  tests/MulkYonetimi.Api.Tests/      Unit ve in-process API testleri
  tests/MulkYonetimi.IntegrationTests/  Gerçek SQL Server testleri (MULK_SQL_TEST_ADMIN_CONNECTION)
deploy/   api.env.example, compose.api.yaml, nginx/mulkapi.conf, sql/migrations-idempotent.sql
docs/     adr/001-007, deploy-ubuntu-azure.md, sql-backup-restore.md, local-email.md,
          requirements-audit.md, design/public-site-plan.md
.github/workflows/ci.yml   frontend, backend, integration işleri
```

Kimlik: Identity cookie `mulk.session` (HttpOnly, SameSite=Lax). Auth mutasyonları `Auth__FrontendOrigin` ile eşleşen `Origin` ister; BFF aynı origin'i taşır. Auth POST uçları IP başına dakikada 25 istekle sınırlıdır.

## 4. Canlı ortam (secret yok)

- Frontend: https://mulkum-beta.vercel.app. Vercel projesi `mulkum`, bölge `fra1`. Ortam değişkenleri: `BACKEND_BASE_URL=https://mulkapi.duckdns.org`, `FRONTEND_ORIGIN=https://mulkum-beta.vercel.app`.
- API: Ubuntu 24 sunucu `109.236.51.239`, dizin `/opt/mulk-yonetimi`. `docker compose -f deploy/compose.api.yaml` ile `network_mode: host`, Kestrel yalnız `127.0.0.1:5180`. Önünde host nginx ve certbot ile `mulkapi.duckdns.org`. Host ağı gerekir, çünkü ana makine kendi genel IP'sine köprü ağından gelen trafiği reddeder ve Mailu o IP'de yayındadır.
- Secret'lar yalnız `/opt/mulk-yonetimi/deploy/api.env` içindedir (`chmod 600`). Asla yazdırma, loglama veya depoya koyma.
- Veritabanı: Azure SQL ücretsiz teklif, Sweden Central, sunucu `mulkyonetimi-sql.database.windows.net`, veritabanı `MulkYonetimi`. Uygulama `mulk_app` girişiyle (`db_datareader`, `db_datawriter`) bağlanır. Yönetici girişi yalnız migration içindir. Firewall'da yalnız sunucu IP'si açık. Yedek: otomatik PITR, 7 gün.
- E-posta: aynı sunucudaki Mailu. SMTP `mail.kasam360.com.tr:465` örtük TLS (Mailu içinde 587 kapalı), gönderen `mulkum@360labs.com.tr`.
- Bu sunucu kasam360 ve Mailu ile paylaşılır. Onları bozma: yalnız `/opt/mulk-yonetimi`, `mulk-yonetimi` container ve `mulkapi` nginx dosyasına dokun.
- Bilinenler: sunucu "System restart required" gösteriyor. `*:3000` üzerinde herkese açık, bu projeyle ilgisiz bir `node /root/apps` süreci dinliyor; sahibin incelemesi bekleniyor.

Sahip sunucu komutlarını Tabby ile çalıştırır ve çıktıyı yapıştırır. Sunucuya sen erişemezsin; komut ver, çıktıyı bekle.

Sunucu güncelleme komutu:

```bash
cd /opt/mulk-yonetimi && git pull -q && docker compose -f deploy/compose.api.yaml up -d --build --force-recreate
```

Migration (yeni migration varsa; önce `deploy/sql/migrations-idempotent.sql` yeniden üretilip commit edilmeli). Tabby'ye yapıştırılan sqlcmd parola istemi bozulur, bu yüzden parola gizli okunup ortam değişkeniyle verilir ve `-I` zorunludur:

```bash
cd /opt/mulk-yonetimi
read -rsp "Yönetici parolası: " SQLCMDPASSWORD; echo; export SQLCMDPASSWORD
docker run --rm -e SQLCMDPASSWORD -v "$PWD/deploy/sql:/sql:ro" mcr.microsoft.com/mssql-tools \
  /opt/mssql-tools/bin/sqlcmd -S tcp:mulkyonetimi-sql.database.windows.net,1433 -d MulkYonetimi -U <admin> -N -b -I \
  -i /sql/migrations-idempotent.sql
unset SQLCMDPASSWORD
```

Sağlık: `curl -s http://127.0.0.1:5180/health` (sunucuda) veya `https://mulkapi.duckdns.org/health`. Kayıt, e-posta doğrulama ve giriş canlıda çalışır.

## 5. Yapılanlar

Birleşmiş PR'lar (`gh pr list --state merged` ile doğrula):

| PR | İçerik |
| --- | --- |
| #1 | FND-02: kontrollü EF Core migration temeli |
| #2 | FND-03: BFF cookie ve Origin denemesi |
| #3 | Identity ve hesap üyeliği şeması |
| #4 | Doğrulanmış üyelikten aktif hesabı çözme |
| #5 | Identity cookie ile korunan `/me` |
| #6 | Temel ürün sayfaları ve metin standardı |
| #7 | Identity giriş ve çıkış |
| #8 | E-posta doğrulamalı kayıt |
| #9 | Hesap kurtarma, eski oturumu iptal |
| #10 | Auth hız sınırı |
| #11 | Dayanıklı e-posta outbox, güvenilir proxy ayarı |
| #12 | MVP: portföy, finans, belgeler, yayın altyapısı |
| #13 | Kayıt hata mesajları, parola göster/gizle |
| #14 | MailKit ile 465 SMTPS |
| #15 | Outbox sağlık kontrolü yalnız güncel sorunlarda Degraded |
| #16 | Mobil menü hamburger ikonu |
| #17 | Performans: fra1, hafif animasyon ve cam, bölüm bazlı kod ayrımı |
| #18 | Tanıtım sayfası, `/panel`, daraltılabilir kenar çubuğu, tutarlı tema |
| #19 | Ctrl+B ve Ctrl+K kısayolları |

Bunların ardından kod temizliği ve belge sadeleştirmesi yapıldı (kullanılmayan UI parçaları ve `@radix-ui/react-tooltip` kaldırıldı, bileşenler biçimlendirildi, eski belgeler silindi, ADR'ler `docs/adr/` altında toplandı).

## 6. Kalan iş (öncelik sırasıyla)

Ayrıntılı kanıt tablosu: `docs/requirements-audit.md` (path:satır ve test adlarıyla).

**a) Herkese açık site ("Kesit" konsepti).** `docs/design/public-site-plan.md` bölüm 2 ve 4 tasarımı, bölüm 6 dilimleri anlatır. Herkese açık sayfalar çok iyi olmalı. Sahip kararı: yasal sayfalar ve iletişim e-postası ERTELENDİ. Plandaki yasal metin ve iletişim sayfası dilimlerini (Dilim 6, 7, 9) YAPMA ve bağlantılarını koyma ("hiç olmasın"). Diğer dilimleri uygula: token/yazı tipi/tema (1), yönlendirme (2), site kabuğu (3), Kesit çizimi (4), tanıtım içeriği (5), giriş kabuğu (8), erişilebilirlik ve performans kapısı (10).
Kabul: bilinmeyen yol `/giris`'e yönlenmek yerine gerçek 404 sayfası döner (şu an `proxy.ts` oturumsuz her bilinmeyen yolu `/giris`'e atar ve `app/[section]/page.tsx` bilinmeyen bölümü işler; `not-found.tsx` ekle, bilinen bölüm listesini `lib/navigation.ts`'ten al, proxy yalnız gerçek korumalı yolları yönlendirsin). 375 ve 1280 px, açık ve koyu tema, azaltılmış hareket Playwright ile doğrulanır. Plan metnini bu kararla (yasal sayfalar yok) güncelle, ADR 004'ü sonuçlara göre güncelle.

**b) Denetim boşlukları** (`docs/requirements-audit.md`, "Teslim öncesi kapatılabilecek eksikler"):
- SAAS-01, SAAS-02, FR-13: plan/kota/pilot aktivasyonu. Kabul: kota aşımında okuma açık, yazma 409; yeni hesap PENDING, yönetici onayıyla ACTIVE; audit; değerler yapılandırmada.
- LEASE-05, FR-04: sözleşme yenileme/ek protokol. Kabul: bitiş uzatma, yeni dönem ve bedel efektif tarihten, önceki kayıt korunur, audit ve UI.
- RPT-04: CSV export (nakit akışı ve ödeme listesi). Kabul: filtreler korunur, hücre formül enjeksiyonuna karşı kaçışlı, BFF rotası ve rapor ekranında düğme.
- FND-04, FR-14: `X-Correlation-Id` ara katmanı; `AuditEvent`'e `CorrelationId` ve `Reason` (migration, `deploy/sql/migrations-idempotent.sql` yeniden üret); void/düzeltme audit testi.
- PORT-04, FR-02: birim arşivleme. Kabul: `Unit.ArchivedAtUtc`, aktif sözleşme varsa 409, geçmiş raporlar korunur.
- QA-01, QA-03, QA-04: frontend component testleri (en az tahsilat ve sözleşme formları) ve gerçek API + SQL Server'a karşı tek Playwright kritik yol (kayıt, mülk, birim, kiracı, sözleşme, tahsilat, yenileme). Mevcut Playwright testleri `frontend/tests/browser/health-server.mjs` fixture sunucusuna karşıdır.
- Diğer KISMEN/YOK kimlikleri (denetimde tek tek incele): FND-02, FND-06 (RPO/RTO, restore provası), AUTH-02 (token süresi dolumu testi), REL-01 (yasal; sahip erteledi), REL-02, ARCH-02, ARCH-04, FR-10, FR-11, RG-01, RG-05, RG-06, RG-07, RG-08 ve RG-09 (yasal/KVKK; sahip erteledi), TD-10-2, TD-10-5, TD-10-7, TD-10-8. FUT-01..04 MVP sonrasıdır, eksik sayılmaz.
- CI sertleştirme: `generated.ts` fark kontrolü, Dependabot, üretimde `AllowedHosts`.

**c) Belgeler.** R2 ve zararlı yazılım tarayıcısı yapılandırılmadı. Belge yükleme/indirme bu yüzden 503 verir; `complete` tarayıcı `Clean` demeden etkinleştirmez. Bu kapıyı KALDIRMA (ADR 006). Tamamlamak için R2 bucket ve CORS, bir tarama adaptörü (örn. ClamAV container), gerçek R2 kabul testi.

**d) Rate limit paylaşılan kovada.** Vercel BFF üzerinden gelen istekler Vercel çıkış IP'leriyle görünür; tüm kullanıcılar aynı IP kovasına düşer. Gerçek istemci IP'sini güvenli aktar: BFF'de `x-forwarded-for` ilk değerini al, imzalı veya yalnız Vercel'den gelen güvenilir bir başlıkla backend'e ilet, backend yalnız `Network__KnownProxies` adresinden gelen başlığa güvensin. Kabul: iki farklı istemci IP'si ayrı kovada sayılır; sahte başlık etkisizdir (test).

**e) bfcache.** Panelde bfcache engelleniyor (geri tuşu tam yeniden yükler). Nedeni tespit et (`Cache-Control: no-store`, `unload` dinleyicisi, açık bağlantı vb.), mümkünse düzelt ve Chrome DevTools "Back/forward cache" testiyle doğrula.

**f) Açık tema logo kontrolü.** `components/brand-mark.tsx` işareti açık temada okunur mu, `app/icon.svg` ve apple-icon ile uyumlu mu denetle.

**g) SPF/DKIM.** `360labs.com.tr` göndericisi için SPF/DKIM kaydı; e-postalar spam'e düşüyorsa DNS'te Mailu'nun verdiği DKIM anahtarı ve SPF eklenir (sahibin DNS erişimi gerekir).

**h)** Bölüm b'de sayılan her KISMEN/YOK kimliği için denetimdeki "Eksik / Not" sütununa bak ve kapat; kapanınca tablo satırını güncelle.

## 7. Doğrulama komutları

Frontend (`frontend/` içinde, Node 24, pnpm 12.15):

```powershell
pnpm install --frozen-lockfile
pnpm lint            # yerelde app/apple-icon.tsx <img> uyarısı bilinir; CI'da yok
pnpm typecheck
pnpm test
pnpm build           # Playwright'tan ÖNCE; aynı anda yalnız bir build/test çalıştırıcısı
pnpm test:browser    # portlar 3109, 3110, 5089 boş olmalı; 79 test
```

Backend (depo kökünde):

```powershell
dotnet build backend/MulkYonetimi.slnx -c Release
dotnet test backend/tests/MulkYonetimi.Api.Tests -c Release
dotnet format backend/MulkYonetimi.slnx --verify-no-changes
```

Entegrasyon testleri gerçek SQL Server ister: `docker compose up -d` ile yerel SQL'i başlat, `MULK_SQL_TEST_ADMIN_CONNECTION` ortam değişkenine `master` bağlantı dizesini yaz (yalnız process env), sonra `dotnet test backend/tests/MulkYonetimi.IntegrationTests -c Release`. CI'da aynısı `integration` işinde SQL Server konteyneriyle çalışır.

CI: `.github/workflows/ci.yml` (frontend, backend, integration). PR akışı: `git pull --rebase`, küçük commit'ler, `git push origin develop`, `gh pr create --base main --head develop`, `gh pr checks <n> --watch`, yeşilse `gh pr merge <n> --merge`.

## 8. Öğrenilen tuzaklar

- Tabby'ye yapıştırılan komutlarda sqlcmd parola istemi bozulur: `read -rs` ile `SQLCMDPASSWORD` kullan. Migration'da `-I` (QUOTED_IDENTIFIER ON) şart.
- Mailu'ya ulaşmak için API container'ı `network_mode: host` ile çalışır; köprü ağından sunucunun kendi genel IP'sine bağlantı reddedilir.
- `System.Net.Mail.SmtpClient` 465 örtük TLS'i desteklemez; bu yüzden MailKit kullanılır. Mailu içinde 587 kapalıdır.
- Next 16'da `middleware` yerine `proxy.ts` kullanılır.
- Playwright `storageState` varsayılan olarak bayat bir oturum çerezi taşır; oturumsuz başlaması gereken test dosyaları `test.use({ storageState: { cookies: [], origins: [] } })` ile başlar (örnek: `tests/browser/auth-forms.spec.ts`).
- Yerelde `pnpm lint` yalnız `app/apple-icon.tsx` için `no-img-element` uyarısı verir (`--max-warnings=0` yerelde bu yüzden başarısız görünür); `ImageResponse` içinde `next/image` kullanılamaz.
- `next build` `frontend/next-env.d.ts` dosyasını değiştirir; commit etme.
- Windows'ta "LF will be replaced by CRLF" uyarıları zararsızdır.
- Aynı anda yalnız bir `.next` build veya Playwright çalıştırıcısı çalıştır.
- API'yi kaynak `bin` klasöründen çalıştırma (DLL kilitlenir); ayrı temp publish kullan (`docs/local-email.md`).
- Sunucuda paylaşılan servisler var (kasam360, Mailu): yıkıcı veya geniş kapsamlı komut verme.
