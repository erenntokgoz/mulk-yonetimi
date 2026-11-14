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

`/` herkese açık tanıtım sayfasıdır, panel `/panel` adresindedir. `/giris` sayfası e-posta ve parolayı BFF üzerinden backend Identity giriş ucuna gönderir. Backend deployment'ında `Auth__FrontendOrigin`, frontend `FRONTEND_ORIGIN` ile aynı origin olmalıdır.
`/kayit` ve `/dogrula` sayfaları kayıt ve e-posta doğrulamayı aynı BFF sınırından yürütür. Backend SMTP ayarı kayıt için zorunludur; doğrulama bağlantısı frontend origin'ine gider.
`/parolami-unuttum`, `/parola-sifirla` ve `/dogrulama-yeniden-gonder` aynı BFF sınırından parola kurtarma ve doğrulama bağlantısı yenileme akışını yürütür.

Oturum akışı gerçek Next production sunucusu ile ayrı HTTP fixture üzerinde doğrulanır: HttpOnly cookie login yanıtından tarayıcıya geçer, `/me` isteğinde backend'e iletilir, logout cookie'yi kaldırır ve farklı/eksik Origin mutation'ları 403 alır. Backend fixture Identity yerine geçmez. CI bu tarayıcı testlerini Chromium ile çalıştırır.

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

`lib/api/health.ts`, `GET /health` JSON yanıtını çalışma anında doğrular. Healthy/Degraded için HTTP 200, Unhealthy için HTTP 503 beklenir. Ağ hatası, hatalı yanıt ve yapılandırma sorunu kullanıcıya anlaşılır durum metni olarak gösterilir; URL veya exception ayrıntısı tarayıcıya aktarılmaz. Ürün endpoint tipleri `lib/api/generated.ts` içindedir ve `pnpm api:types` ile çalışan Development API'sinden üretilir; elle düzenlenmez.

## Görsel kaynak

[Vercel admin dashboard şablonu](https://github.com/vercel/nextjs-postgres-nextauth-tailwindcss-template/tree/fe026711c19ac3ee4589c86a738f59b84e611559) (MIT, lisans `LICENSE.reference.md`) yalnız Tailwind tokenları, sidebar/header düzeni ve shadcn bileşenleri için temel alındı; demo auth, veritabanı ve ürün verisi taşınmadı. Görsel kabul, `docs/adr/002-video-referansi.md` uyarınca video referansına göredir.

## Logo

Marka adı Mülküm, işareti "iki çatı M"dir. Gerçek logoyu eklemek için şu dosyaların üzerine yazın:

- `app/icon.svg`: tarayıcı sekmesi simgesi (16/32 px için sade sürüm; çerçeve ve orta çizgi yok).
- `lib/brand-mark-svg.ts`: kenar çubuğu, giriş sayfaları (`components/brand-mark.tsx`) ve Apple simgesi (`app/apple-icon.tsx`) için tam işaret (`brandMarkSvg` dizgisi). Kare (1:1) SVG kullanın.
