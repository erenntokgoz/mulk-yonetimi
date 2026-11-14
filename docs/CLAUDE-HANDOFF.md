# Claude devir notu — 14 Kasım 2026

## Kullanıcı önceliği
Yarın teslim. Mevcut çalışan işi koru; minimum token ve tekrar. Önce ekran/akış ve tarayıcı doğrulaması, sonra SMTP/yayın. Kullanıcı değişiklikleri kaybolmasın. Bu dosya bir durum özeti; başarı iddialarını güncel kod ve sonuçlarla kontrol et.

## Çalışma alanı ve kaynaklar
- Repo: `C:\Users\Eren Tokgöz\Desktop\Projects\mulk-yonetimi`. Önce `AGENTS.md` ve `frontend/AGENTS.md` oku.
- Şirket kaynakları: `C:\Users\Eren Tokgöz\Desktop\Mülk Yönetimi\Mulk_Yonetimi_MVP_PRD_v1.1.md`, `Mulk_Yonetimi_Technical_Design_v1.1.md`, `Mulk_Yonetimi_MVP_Backlog_v1.1.csv`.
- Çalışma ağacı çok sayıda değiştirilmiş ve UNTRACKED dosya içeriyor. Bunlar yapılan uygulamadır; git reset/clean, checkout veya üzerine clone YAPMA. Başlangıçta git status incele. Eski commit'e dönme.
- Next.js16/TypeScript; ASP.NET Core10/EF10/SQL Server; private R2. Para decimal(19,2), iş tarihleri DateOnly, olaylar UTC. Tenant/account sınırları backend'de. Finansal hard-delete yok.

## Mevcut uygulama
- Backend: auth/outbox, mülk/birim/kiracı, sözleşme/bedel dönemleri, kira alacağı üretimi/düzeltmesi, tahsilat/dağıtım/void, depozito/hareket/iade, gider/iptal, dashboard/nakit raporları.
- Son eklenen backend: profil, bildirim tercihleri, bildirim listesi/okundu, belge upload intent/complete/download/soft-delete. Gerçek kontrat ve ayarlar `backend/API-HANDOFF.md`.
- Son backend kanıtı: Release build 0 warning/error, API testleri27/27, gerçek SQL entegrasyon5/5. İki tenant, concurrency, para kuralları ve belge gate'i testli. Her yeni değişiklik için tekrar uygun kontrol gerekir.
- `AccountSettingsNotifications` ve `DocumentsPrivateStorage` migrationları YALNIZ yerel development DB'ye uygulandı.
- Frontend bütün bölüm route'ları componentlere bağlı: portföy, kiracı, sözleşme, tahsilat, depozito, gider, rapor, ayarlar, bildirim, belgeler. SON ÜÇÜ yeni eklenmiş; son test kanıtını kontrol et, tamamlandığını varsayma. `tests/browser/workspace-resources.spec.ts` bu dilim içindir.
- Önceki frontend diliminde lint/typecheck/build geçti; birleşik browser34/34, son ilgili glass+visual3/3 geçti. 46 screenshot `frontend/test-results/visual-qa` altında üretilmişti. Bunlar fixture backend testleridir, canlı oturumlu uçtan uca doğrulama DEĞİLDİR; sonraki testler klasörü temizlemiş olabilir.
- Mobil overflow hatasında viewport değişiminden sonra responsive CSS beklenmeden ölçüm alınıyordu. Testte computed padding bekleyişiyle çözüldü. Yeni kanıt olmadan CSS override yığma.

## Tasarım
- Referans: `C:\Users\Eren Tokgöz\Downloads\Mobile Devices\VID_20261110_153123_380.mp4`.
- Cam yüzeyler, kompakt koyu menü, ince ışıklı kenarlar ve animasyonlar isteniyor. SÜRÜKLEME YOK, ARKA PLAN DAİRELERİ YOK.
- Ortak shell/CSS/route-surface ve portföy tablo-kart görünümü hazır. Auth kabuğu iki sütunlu mimari çizgi + glass form; light/dark/mobile, reduced-motion var. Referansın her ekranına birebir ulaşıldığı iddia edilmedi.
- Çalışanı yeniden tasarlama. Son üç ekran dahil desktop/mobile tarayıcıda görünüm, taşma, form, hata/boş/loading, klavye, auth light/dark ve animasyon kontrolü yap.
- Uydurma veri, çalışmayan buton, pazarlama dolgu metni yok. 401 giriş gerektirir; 502/503 bağlantı/konfigürasyon hatasıdır. Hata anında boş kayıt varmış gibi gösterme.

## Yerel servisler
- Frontend hedef `http://localhost:3000`, API `http://127.0.0.1:5080`.
- Env: `BACKEND_BASE_URL=http://127.0.0.1:5080`, `FRONTEND_ORIGIN=http://localhost:3000`.
- Son API temp publish: `%TEMP%\mulk-api-publish-c2adbb0c565c4a92868d87373801a91c`. Son bildirilen PID21038; güncel süreci doğrula. Foreground araç oturumu kapandıysa durmuş olabilir.
- Son health/OpenAPI200; OpenAPI43 yol; profil/bildirim/belge oturumsuz401. Bunlar geçmiş kontroldür, erişimi tekrar doğrula.
- API'yi kaynak bin klasöründen çalıştırma: build DLL kilitlenir. Ayrı temp publish + foreground uzun araç oturumu çalışan yöntem. Bazı gizli Start-Process komutları yerel politika tarafından reddedildi; güvenlik kısıtlarını dolanma.
- Docker CLI `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`. SQL `127.0.0.1,14333`, development DB `MulkYonetimi`. Mevcut .env secretlarını yalnız process env'e yükle, çıktı/commit yok. SQL integration için `MULK_SQL_TEST_ADMIN_CONNECTION` gerekir.
- pnpm/node mevcut; bun komutu mevcut değil. Frontend komutları pnpm lint/typecheck/test/build/test:browser/api:types. generated.ts ELLE düzenlenmez; gerçek OpenAPI'den üret.
- Aynı anda yalnız BİR .next build/test runner. Playwright test portları5089/3109/3110; eski süreç varsa sahipliğini kontrol et, yalnız kendi test süreçlerini durdur.

## Mail ve yayın — henüz tamam değil
- Kullanıcının Ubuntu24 sunucusunda Docker, çalışan servisler ve Mailu var. Gönderen `mulkyonetimi@360labs.com.tr`.
- Son kullanıcı kararı: frontend Vercel. .NET API/SQL Ubuntu üzerinde değerlendirilecek; mevcut Vercel/IIS doküman farkı ADR ile kaydedilmeli. Vercel'e bütün .NET/SQL uygulamasını taşıyabileceğini varsayma.
- SSH config bulunamadı; sunucu IP/SSH user/alias ve erişim henüz verilmedi. Sunucuya bağlanılmadı, yayın yapılmadı. Bilgileri kullanıcıdan iste; şifre/özel anahtarı sohbete yapıştırmasını isteme. İlk iş salt okunur Docker/port/proxy/Mailu envanteri; çalışan servisleri bozma.
- Yerel Mailpit UI `http://127.0.0.1:8025`, SMTP localhost1025. Çalışan API'de SMTP host/from yok ve worker kapalı olduğunda register503 veriyor; bu son teşhiste doğrulandı. Gerçek Mailu bağlantısı kullanıcı isteğiyle EN SON. Kayıt akışı uçtan uca tamam sayılmaz.
- Yerel mail ayarları `docs/local-email.md`; gerçek üretim SMTP secretları yok. Gerçek e-posta gönderme/onaysız hesap açma yok.
- R2 credentials ve gerçek sağlayıcı PUT/HEAD/GET/COPY/DELETE testi yok. Malware scanner seçilmedi: mevcut default scanner Unavailable; Clean olmadan complete503, belge PENDING kalır. Bu güvenli gate'i kaldırma. Belgeler bu haliyle üretime hazır DEĞİL.

## Kalan iş sırası
1. Yeni ayarlar/bildirim/belge UI diliminin lint/typecheck/build, ilgili test ve görsel sonuçlarını kesinleştir; gerçek backend kontratlarını doğrula.
2. Son üç sayfa dahil tüm ekranları kontrol et; çalışanı koruyup yalnız kanıtlı hatayı düzelt. Gerçek API oturumlu ana yol (kayıt/doğrulama, mülk→birim→kiracı→sözleşme→kısmi tahsilat→bedel değişimi) ile fixture testlerini ayır.
3. Şirket backlog'uyla kalan kabul maddelerini kontrol et: CSV export, plan/kota/pilot aktivasyonu, tam yenileme, audit/correlation ve yayın maddeleri için tamam kanıtı yok. `docs/delivery-matrix.md` kısmen eski, kod ve test kaynağı esas alınmalı.
4. Son aşamada Mailu/SMTP, R2+scanner ve sunucu erişimi gerektiren harici ayarları tamamla. Kullanıcıya somut eksikleri bildir; 'çok az kaldı' diye garanti verme.
5. Mevcut Ubuntu servislerini koruyarak Vercel frontend + API/SQL yayın planı, HTTPS/host/CSRF/env, migration/backup/rollback ve staging smoke test. Uzak kaynaklara yıkıcı işlem yapma.

## Devir sırasında
Son frontend ajan raporu: kod ve test çalışması DURDU. Son43-path OpenAPI'den tipler üretildi; ayarlar/bildirim/belge BFF ve ekranları bağlı. Yeni workspace-resources testlerinin3/4'ü geçti. Kalan1 hata belge signed-intent→PUT→complete→download→soft-delete testinde download popup `about:blank` kalıyor. Async window.open/gesture zamanlaması olası neden, henüz kesin değil; test ve ürün kodundan teşhis et. Son ürün değişiklikleriyle lint/typecheck/build geçmiş; son üç ekranın tam görsel QA tekrarı yapılmamış. Test runner exit1 ile bitmiş;3109/3110 süreç durumunu doğrula. Gerçek R2/AV yokken fail-closed davranışı korunuyor; test sağlayıcısı akışını gerçek sağlayıcı kanıtı sayma.

Codex frontend ajanına yeni yazım/test başlatmaması ve kısa son durum bildirmesi söylendi. Claude aynı dosyalara yazmadan önce diğer ajanın durduğundan emin ol. Başlangıçta çalışan süreçleri salt okunur kontrol et. Gizli bilgi taşımadan mevcut workspace üzerinde devam et.
