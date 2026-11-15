# Delivery readiness progress

Branch: `codex/delivery-readiness`, based on `develop` on 2026-11-15. Baseline had one untracked owner file, `frontend/lint.txt`; preserve it.

The plan is `docs/superpowers/plans/2026-11-15-delivery-readiness.md`.

## Local checklist

- [x] Pagination and complete selection lists (user-triggered next-page controls; browser regression for 101/26 records)
- [x] Unit archive (code, migration, API/BFF/UI; SQL acceptance pending)
- [x] Lease renewal (code, migration, API/BFF/UI; SQL acceptance pending)
- [x] Configurable quota and pilot activation (code, migration, API test; SQL acceptance pending)
- [x] Audit reason and correlation ID (code and targeted unit tests; SQL audit acceptance pending)
- [x] Cashflow and payment CSV (code and targeted unit tests; SQL acceptance pending)
- [ ] Expired auth tokens (deterministic SQL integration assertions compile; execution pending)
- [ ] Component, real API E2E and visual regression tests
- [x] Typed server API client and CI contract/dependency gates (local type/build checks; CI run pending)
- [x] Malware scanner and R2 acceptance harness (ClamAV protocol tests done; real R2 pending)
- [x] Staging, restore, release and rollout docs (operational acceptance still open)
- [x] First setup guidance (real API state and existing forms)
- [ ] Full verification and self-review

## External evidence

Production deployment, production restore and real R2 acceptance require credentials or operator access unavailable in this workspace. Record attempted local checks and keep these as open release gates.

## Verification log

- OpenAPI route contract: red exit 1 before unit archive/renewal/CSV routes, green exit 0 (4 selected tests including CSV cell cases).
- Correlation header: red 3/3 failed before middleware; green 3/3 passed, exit 0.
- `dotnet build backend/MulkYonetimi.slnx -c Release --no-restore`: exit 0, 0 warnings/errors after first backend/UI slices.
- `pnpm typecheck`: exit 0 after API type generation and frontend routes/forms. `frontend/next-env.d.ts` restored after generated typecheck.
- SQL integration test cannot run: Docker executable absent in PATH and standard Docker Desktop location, `MULK_SQL_TEST_ADMIN_CONNECTION` unset. Integration assertions were added, not marked passing.
- SAAS OpenAPI route: red exit 1 before activation endpoint, green 1/1 exit 0 after code. Pending registration and quota SQL assertions added; not run.
- ClamAV protocol: red compile exit 1 before adapter, then 4/4 clean/infected/error/disconnected tests pass, exit 0. Integration test project builds exit 0, 0 warnings/errors; database tests not run.
- Expired confirmation/reset token assertions use a negative token lifetime in the real provider and compile in SQL integration project. Their API result is unverified until SQL is available.
- `pnpm api:types` and `pnpm typecheck`: exit 0 after pilot endpoint; generated types updated, `next-env.d.ts` restored.
- Pagination/404: targeted `pnpm build` exit 0, 4 Playwright tests passed (property #101, notification #26, tenant picker #101, unauthenticated unknown route 404). Unknown route test first failed at received 200, then passed after proxy guard narrowed to known sections and Turkish 404 page. Targeted ESLint exit 0. Full browser suite remains pending.
- Initial setup: Playwright test failed before route existed, then `pnpm build` exit 0 and 2/2 targeted tests passed; first empty state and real form progression checked. The typed server client compiles against generated OpenAPI GET paths/responses. CI schema regeneration and Dependabot files added but workflow has not run.
- Operations: `docs/release-readiness.md` defines isolated staging, an operator-accepted RPO/RTO proposal, Azure PITR restore rehearsal, smoke/rollback and explicit no-go gates. ADR 010 records account-lock financial concurrency. Existing local backup/restore evidence dates to 2026-11-13; Docker/SQL is absent now and Azure PITR is untested.
- R2: `R2AcceptanceTests` builds and is explicitly **SKIP 1/1** with exit 0 because R2 credentials are absent. It is an executable real-bucket acceptance path, not a passed R2 acceptance result. CORS check additionally requires two explicit origins.
- Final backend verification (2026-11-15): `dotnet build backend/MulkYonetimi.slnx -c Release --no-restore` passed (0 warnings/errors); API unit suite passed (43/43); SQL integration test project build passed (0 warnings/errors); `dotnet format` verification passed for solution and integration project; `git diff --check` passed. SQL-backed runtime acceptance remains **SKIP** because Docker is unavailable and `MULK_SQL_TEST_ADMIN_CONNECTION` is unset. Existing integration assertions cover two-tenant isolation, quota, concurrent lease renewal and expiry-token responses, but were not executed against SQL Server in this session.
- CI config review (2026-11-15): `.github/workflows/ci.yml` includes backend build/unit tests, generated OpenAPI client drift check, integration job with SQL Server, and format gates; `.github/dependabot.yml` covers GitHub Actions, npm, and NuGet.
- Frontend verification (2026-11-15): unit tests 10/10, lint, typecheck, production build and Playwright 87/87 passed. `pnpm api:types` was run against the live Development API and generated output matched `frontend/lib/api/generated.ts`. Critical collection and renewal browser paths use fixture/BFF routes, not a real SQL-backed browser session.
- Final PR CI (2026-11-15): [run 43694853694](https://github.com/erenntokgoz/mulk-yonetimi/actions/runs/43694853694) passed backend, frontend and SQL integration jobs. SQL integration tests passed 6/6 with the real-R2 test explicitly skipped 1/7 for absent credentials. A real browser → BFF → API → SQL critical path passed 1/1 in 9.9 seconds; it logs in as a confirmed test owner and creates a property, unit, tenant and lease, records a receipt, then renews the lease. Backend OpenAPI generation/drift, frontend lint/typecheck/build, and Playwright 87/87 also passed.
- Security review (2026-11-15): PENDING accounts remain blocked from portfolio access until explicit operator activation; activation checks configured operator identity/key and confirmed owner email. Quota and renewal mutations use the account lock; renewal checks version and preserves rate/charge history. CSV formula escaping and account-scoped queries remain in place. SQL E2E uses a per-run database and generated fake credentials, seeds only through an opt-in test, uses normal confirmed-email Identity login, and disables traces/artifact upload.
- Remaining external gates: actual R2 bucket acceptance and production restore/deploy evidence.

## Canlı QA takibi (2026-11-15)

- Canlı QA'da oluşturulan aktif kira alacağı görünürken bildirim listesi boş kaldı; sözleşme sonlandırıldıktan sonra da boştu. QA bildirimi kapatan tercih değiştirmedi. Bildirim üreticisi başlangıçta bir kez çalışıp sonra 24 saatte bir çalışıyordu; yeni bir kira alacağı için bir sonraki çalışmaya kadar 24 saate varan gecikme mümkündü. Aralık, kira tahakkuk işçisiyle hizalı 15 dakikaya indirildi; yeni test bu varsayılanı doğruluyor. Canlı `Notifications__WorkerEnabled` durumu ve job hata logları sunucu erişimi olmadığı için doğrulanamadı; bu düzeltmenin yayına alınması gerekir.
- Canlı `https://mulkapi.duckdns.org/health` yanıtında yalnızca SQL `Healthy`, outbox `Degraded` göründü. Health yanıtı başarısız ve 15 dakikayı aşan bekleyen ileti sayaçlarını sunmuyor. Hangi sayacın veya SMTP ayarının soruna yol açtığına dair veri alınamadı. Outbox worker varsayılan olarak 15 saniyede bir dener; uygulama ayarı `Email__WorkerEnabled`, SMTP alanları `Email__SmtpHost`, `Email__SmtpPort`, `Email__SmtpUser`, `Email__SmtpPassword`, `Email__From`.
- Dağıtım farkı için canlı Production OpenAPI `/openapi/v1.json` 404 verdi. Sahte UUID'lerle yenileme, birim arşivleme ve CSV rotaları 404 döndü. PR #21 `develop` hedefli ve açık; `origin/main` `a604b778`, PR head `bdc3a24`. README, Vercel'in `main` dalından yayın yaptığını söylüyor; canlıya ait kesin deployment SHA alınamadı. QA'da canlı birim satırında düzenleme ve arşivlenmiş mülk filtresi görünmedi. Mevcut teknik tasarım birim GET/POST uç noktaları öngörüyor; birim düzenleme gereksinimi yok. Dağıtım yapılmadı.
- R2/tarama: `deploy/api.env` workspace'te yok ve `deploy/api.env.example` değerleri boş. Gerçek ortamdaki gereken alan adları `Storage__R2AccountId`, `Storage__R2BucketName`, `Storage__R2AccessKeyId`, `Storage__R2SecretAccessKey`, `Scanner__Host`, `Scanner__Port`. ClamAV profili ayrıca etkinleştirilmeli ve paylaşılan sunucuda bellek kapasitesi ölçülmeli. Hiçbir credential değeri okunmadı veya raporlanmadı.
- Erişim denemesi: yerel `ssh.exe` ile `root@109.236.51.239` için `BatchMode` ve 8 saniye bağlantı sınırıyla salt-okunur `whoami` çalıştırma girişimi `Permission denied (publickey,password)` ile sonuçlandı. Sunucu env/log/SQL alanlarına erişilemiyor; SSH yetkisi veya operatörün değer göstermeyen durum çıktısı gerekli. R2 için staging bucket credential'ları/CORS origin'leri, scanner için kapasite onayı; e-posta kök nedeni için outbox hata sınıfı/sayaçları ve SMTP worker yapılandırma durumu gerekir.
- Bildirim tarama aralığı değişikliği: `NotificationWorkerTests.RunsFrequentlyEnoughToPickUpNewRentCharges` 1/1 geçti. Canlı ortamda doğrulama, migration veya deploy yapılmadı.
- PR head `c9c6041` doğrulaması: [CI run 43697466864](https://github.com/erenntokgoz/mulk-yonetimi/actions/runs/43697466864) backend, frontend ve gerçek SQL integration/browser job'larıyla geçti; push workflow [43697464585](https://github.com/erenntokgoz/mulk-yonetimi/actions/runs/43697464585) da geçti. Vercel Preview tamamlandı. Bu, preview'dir; production yayını değildir.
- Arşivlenmiş mülk ekranı için yerel branch mobil kontrolleri 375×812 ve 390×844 boyutlarında 2/2 geçti. Opera QA production'da 390×844/pagination kontrol etti; branch preview üzerinde canlı tıklama doğrulaması henüz yapılmadı. Production deploy yapılmadı.

### Operatörün R2 ve canlı servis güncellemesi

- Operatörün hassas olmayan çıktısı: host checkout SHA `a66b71866ea7f88b39598d7e64d8e844e25a567a`; compose'da yalnız `api` çalışıyor (`Up 11h`, image etiketi `latest`). Image etiketi commit SHA kanıtı değildir; Dockerfile image içine revision label koymuyor, bu yüzden çalışan binary'nin tam SHA'sı doğrulanmadı. GitHub compare'da `a66...` current `main`'den 17 commit geride ve PR head `5f948e8adc8256038dc2f9ceaafe16643db512fe` bu commit'ten 30 commit ileride.
- `Email__WorkerEnabled` ve `Notifications__WorkerEnabled` boş bırakılmış. Kod `GetValue(..., true)` kullandığı için bunlar **aktif**, kapalı değiller; e-posta outbox poll'u 15 saniyedir, bildirim işi açılışta ve 15 dakikada bir çalışır. `Email__SmtpHost` ve `Email__SmtpPassword` yalnızca var olarak bildirildi; değer/erişilebilirlik doğrulanmadı. Canlı health `outbox:Degraded`; `EmailOutboxHealthCheck` son 24 saatte FAILED veya 15 dakikadan uzun PENDING kayıt varsa degraded olur. Health JSON sayaç vermediği için e-posta kök nedeni hâlâ belirlenmedi.
- Operatör R2 hesabını açtı, `mulkum-prod-private-docs` private bucket'ını oluşturdu, bucket-scoped Object Read & Write token kullandı ve dört `Storage__R2*` alanını `deploy/api.env` içine kaydedip izinleri `600` yaptı. Secret değerleri kaydedilmedi. Opera QA bucket CORS politikasını exact `https://mulkum-beta.vercel.app` origin, `GET`/`PUT`, `Content-Type` ile kaydedip UI'da doğruladı; public access ayarı değiştirilmedi. R2 acceptance henüz çalıştırılmadı.
- `compose.api.yaml` içinde ClamAV `scanner` profilinde ve 4 GiB bellek limitiyle tanımlı; live compose çıktısında scanner yok. Paylaşılan host kapasite çıktısı alınmadığından ClamAV başlatılmadı ve `Scanner__Host`/`Scanner__Port` ayarlanmadı.
- Azure SQL PITR geri yükleme noktası bu çalışmada doğrulanmadı. Yerel backup/restore tatbikatı 2026-11-13 tarihli; canlı veritabanı restore provası veya migration öncesi geri dönüş noktası teyidi değildir.
- PR release head `5f948e8adc8256038dc2f9ceaafe16643db512fe`; push workflow `43697946111` içinde aynı SHA'ya ait `api-release-5f948e8adc8256038dc2f9ceaafe16643db512fe` artifact'i (publish + idempotent SQL migration script) hazır ve CI başarılı. PR hâlâ `develop` hedefli açık; main/Vercel üretim dalı entegrasyonu ve deployment bekliyor. Scriptte dört additive migration vardır: `UnitArchive`, `AuditCorrelation`, `LeaseRenewal`, `PilotPlans`. Down migration'lar eklenen kolon/tablo ve dolayısıyla yeni veriyi siler; production rollback'te down script çalıştırılmamalı. Önceki uygulama sürümü repo checkout `a66...`; migration sonrası davranış uyumu test edilmeden yalnız API binary geri dönüşü yeterli kabul edilmemeli, veri şeması/yorum riski varsa PITR ile yeni DB'ye geri dönülmeli.
- Tabby/UI bağlantı denemesi: `Tabby` Windows süreçleri görülse de CUA hedefli Tabby penceresi göstermedi; reset sonrası `cua.getState()` ve `cua.getApp("Tabby")` `failed to write kernel assets: Sistem belirtilen yolu bulamıyor` ile sonuçlandı. Canlı servis komutları çalıştırılmadı. Önceki agent/operatör çıktısındaki env key booleans dışında bir secret/log okunmadı.
