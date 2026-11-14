# Frontend

Next.js 16 App Router ve TypeScript. Node.js 24 ve pnpm 12.15.0 gerekir.

## Başlatma

Bu dizinde PowerShell ile:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Tarayıcı: http://localhost:3000. Backend bağımsız başlatılır ve varsayılan olarak http://localhost:5080 üzerinde dinler.

`BACKEND_BASE_URL` yalnız sunucuda okunur. Production ortamında deployment ayarı olarak açıkça verin; varsayılan veya `NEXT_PUBLIC_` karşılığı yoktur. Eksik/geçersiz ayarda sayfa açık bir bağlantı yapılandırması mesajı gösterir. Sağlık isteği önbelleğe alınmaz ve 5 saniyede zaman aşımına uğrar. Yenile bağlantısı güncel durumu alır.

`FRONTEND_ORIGIN` BFF auth mutation'ları için tarayıcı origin'idir (ör. `https://app.example.com`). Login/logout POST istekleri bu origin ile eşleşmeyen veya Origin header'ı olmayan istekleri 403 ile reddeder. BFF yalnız sabit login, logout ve `/me` yollarını backend'e taşır; cookie değerini JS'ye açmaz.

`/giris` sayfası e-posta ve parolayı BFF üzerinden backend Identity giriş ucuna gönderir. Backend deployment'ında `Auth__FrontendOrigin`, frontend `FRONTEND_ORIGIN` ile aynı origin olmalıdır.
`/kayit` ve `/dogrula` sayfaları kayıt ve e-posta doğrulamayı aynı BFF sınırından yürütür. Backend SMTP ayarı kayıt için zorunludur; doğrulama bağlantısı frontend origin'ine gider.
`/parolami-unuttum`, `/parola-sifirla` ve `/dogrulama-yeniden-gonder` aynı BFF sınırından parola kurtarma ve doğrulama bağlantısı yenileme akışını yürütür.

FND-03 oturum denemesi gerçek Next production sunucusu ile ayrı HTTP fixture üzerinde doğrulanır: HttpOnly cookie login yanıtından tarayıcıya geçer, `/me` isteğinde backend'e iletilir, logout cookie'yi kaldırır ve farklı/eksik Origin mutation'ları 403 alır. Backend fixture Identity yerine geçmez. CI bu tarayıcı testlerini Chromium ile çalıştırır.

## Doğrulama

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

Production sayfasını Chromium ile doğrulamak için:

```powershell
pnpm exec playwright install chromium
pnpm build
pnpm test:browser
```

Playwright, gerçek production Next.js sunucularını 3109 ve 3110 portlarında, yalnız teste ait health fixture sunucusunu 5089 portunda başlatıp kapatır; bu portların boş olması gerekir. Health durumları ve hata ekranları, klavyeden içeriğe geç bağlantısının main alanına odaklanması, klavyeden yenilemeyle güncel durumun alınması ve mobil taşma kontrol edilir. Testler gerçek backend/SQL Server entegrasyonunu ikame etmez.

Testler Node.js test runner ve gerçek yerel HTTP sunucuları kullanır. `react-server` koşulu, `server-only` modüllerinin test içinde yüklenmesini sağlar; uygulamanın istemci/sunucu sınırı korunur. pnpm kurulumu yalnız `unrs-resolver` paketinin native resolver kurulum scriptine izin verir.

## API sınırı

`lib/api/health.ts`, `GET /health` JSON yanıtını çalışma anında doğrular. Healthy/Degraded için HTTP 200, Unhealthy için HTTP 503 beklenir. Ağ hatası, hatalı yanıt ve yapılandırma sorunu kullanıcıya anlaşılır durum metni olarak gösterilir; URL veya exception ayrıntısı tarayıcıya aktarılmaz. Kontrat şu anda backend ile koordine edilmiş küçük bir TypeScript tipidir; ürün endpoint'leri eklenirken OpenAPI üzerinden üretime geçilecektir.

## Görsel kaynak ve kapsam

[Vercel admin dashboard referansı](https://github.com/vercel/nextjs-postgres-nextauth-tailwindcss-template/tree/fe026711c19ac3ee4589c86a738f59b84e611559) commit `fe026711c19ac3ee4589c86a738f59b84e611559` (MIT) temel alındı. Tailwind v3 renk tokenları, 56 px sidebar/header düzeni, mobil Sheet menüsü ve kullanılan shadcn bileşenleri kaynaktan taşındı; lisans `LICENSE.reference.md` içinde. Next.js 16 uyumluluğu için PostCSS dosyası `.cjs` uzantısını kullanır. Şablonun demo auth, Postgres, Drizzle, ürün verisi ve işlevsiz gezinme öğeleri taşınmadı. Gerçek ürün sayfaları eklenince kaynakla desktop/mobil görsel snapshot karşılaştırması ayrıca yapılacak.

Auth, tenant işlemleri ve ürün CRUD akışları bu foundation kapsamının dışındadır. Backend + gerçek SQL Server ile uçtan uca smoke kontrolü kök entegrasyon adımında yürütülür.

## Ürün sayfaları

Genel bakış, Portföy, Kiracılar, Sözleşmeler, Kira ve tahsilatlar, Depozitolar, Giderler, Belgeler, Raporlar, Bildirimler ve Ayarlar için masaüstü/mobil gezinme vardır. Ürün API'leri henüz bulunmadığından bu sayfalar kayıt yokmuş gibi davranmaz; bölümün kullanıma açık olmadığını gösterir. CRUD, detay ekranları ve gerçek boş/veri/hata durumları ilgili backend endpoint'leriyle birlikte eklenecektir. Genel bakış şu anda yalnız sistem durumunu gösterir.

## Foundation doğrulama kaydı

28 Ekim 2026: `pnpm install --frozen-lockfile`, lint, typecheck, 10 health istemci testi ve production build başarılı. Chromium üzerinde 7 Playwright testi geçti: Healthy, Degraded, Unhealthy, bağlantı hatası, yapılandırma hatası, klavye/yenileme ve mobil yerleşim. `pnpm start -p 3100` ile production HTTP smoke: HTTP 200, Türkçe belge, içeriğe geç bağlantısı, eksik yapılandırma mesajı ve yenile kontrolü doğrulandı.

Sayfa bileşeni kapsamı production Next.js üzerinde Playwright ile doğrulanır; ayrı izole React component runner eklenmedi. Gerçek backend/SQL Server bağlantısının entegrasyon smoke testi ayrıca gerekir. ESLint 9.39.5 kurulumda deprecated uyarısı veriyor; ESLint 10, Next.js lint zincirindeki React/a11y/import eklentilerinin peer aralıklarıyla henüz uyumlu olmadığından uyumlu 9 sürümü sabitlendi (`pnpm peers check` başarılı).

## Referans arayüz doğrulama kaydı

28 Ekim 2026: `pnpm lint`, `pnpm typecheck`, 10 unit test, `pnpm build` ve 9 Playwright testi geçti. 1280×800 masaüstü ve 375×812 mobil Chromium ekran görüntüleri incelendi; 56 px sidebar, header, kart düzeni ve mobil taşmasız görünüm doğrulandı. Bu kontrol kaynak demo ile piksel düzeyinde eşitlik iddiası değildir.
