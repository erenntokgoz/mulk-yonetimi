# Mülk Yönetimi

## Hedef

20 Kasım 2026 teslimi için üretime çıkabilecek bir mülk yönetimi MVP'si geliştir.
Küçük, doğrulanabilir dilimlerle ilerle; güvenli çalışan çekirdeği geniş fakat yarım ürüne tercih et.

## Kaynaklar

- `C:\Users\Eren Tokgöz\Desktop\Mülk Yönetimi\Mulk_Yonetimi_MVP_PRD_v1.1.md`
- `C:\Users\Eren Tokgöz\Desktop\Mülk Yönetimi\Mulk_Yonetimi_Technical_Design_v1.1.md`
- `C:\Users\Eren Tokgöz\Desktop\Mülk Yönetimi\Mulk_Yonetimi_MVP_Backlog_v1.1.csv`

Çelişen gereksinimlerde sessiz karar verme; kararı ADR ile kaydet.

## Mimari sınırlar

- Monorepo kullan: `frontend/`, `backend/`, `docs/`, kök altyapı dosyaları.
- Frontend: Next.js 16 App Router ve TypeScript.
- Backend: ASP.NET Core 10 Web API, EF Core 10 ve SQL Server.
- Dosyalar: Cloudflare R2 private bucket.
- İş kuralları, auth, tenant izolasyonu ve para hesapları backend'de kalır.
- Frontend SQL Server'a ve R2 secret'larına doğrudan erişmez.
- API kontratı OpenAPI'dir; frontend tipleri buradan üretilir.
- İş tarihleri `DateOnly`/SQL `date`, olay zamanları UTC'dir.
- Para için `decimal(19,2)` kullan; `float`/`double` kullanma.
- Kira alacağı tekilliği `(AccountId, LeaseId, PeriodStart)` olur.
- Finansal kayıtları hard-delete etme; void veya açık düzeltme kullan.

## Ajan sahipliği

- Frontend ajanı yalnız `frontend/` altında çalışır.
- Backend ajanı yalnız `backend/` altında çalışır.
- Ana ajan kök dosyalar, Docker, CI, dokümantasyon ve entegrasyondan sorumludur.
- Ortak kontrat değişiklikleri ana ajan tarafından koordine edilir.
- Kullanıcı istemedikçe ajanlar kendi subagent'larını başlatmaz.

## Çalışma kuralları

- Yeni davranıştan önce tasarımı ve kapsamı netleştir.
- Özellik ve hata düzeltmelerinde TDD uygula.
- Beklenmeyen davranışta önce sistematik teşhis yap.
- En küçük eksiksiz değişikliği tercih et; gereksiz bağımlılık ve soyutlama ekleme.
- Kullanıcının değişikliklerini koru; ilgisiz dosyaları değiştirme.
- Secret, token, cookie ve kişisel verileri loglama veya commit etme.
- Tamamlandı demeden önce ilgili test, lint, typecheck ve build komutlarını çalıştır.

## Test tabanı

- Backend domain kuralları için unit test yaz.
- EF Core, migration, tenant izolasyonu ve concurrency için gerçek SQL Server integration testleri kullan.
- Frontend için lint, typecheck, component test ve production build çalıştır.
- Kritik kullanıcı yolunu Playwright ile doğrula.
- İki tenant ile IDOR/cross-tenant negatif testleri zorunludur.

## Tamamlanma ölçütü

Bir iş; kabul kriteri sağlandığında, güvenlik sınırları doğrulandığında, testleri geçtiğinde ve çalıştırılabilir dokümantasyonu güncel olduğunda tamamlanır. Çalıştırılmamış veya başarısız kontrolleri açıkça raporla.
