# Mülküm herkese açık site: tasarım ve uygulama planı

- Durum: Öneri (sahip onayı bekliyor)
- Tarih: 2026-11-15
- Kapsam: `/` tanıtım sayfası, güvenlik, iletişim, dört yasal metin, 404/500, giriş/kayıt/parola sayfalarının görsel sistemi
- Bağlayıcı kurallar: kök `AGENTS.md` (sade Türkçe, örnek veri yok, erişilebilirlik, mobil), ADR 003 (yayın topolojisi), ADR 004 (tanıtım sayfası; bu plan ile güncellenecek)
- Kapsam dışı: panel (`/panel` ve bölümler) yeniden tasarımı. Panel yalnız ortak yazı tipi ve tema varsayılanı değişikliğinden etkilenir (bkz. Dilim 1).

Bu belgedeki yer tutucular köşeli parantez ve büyük harfle yazılır: `[ŞİRKET UNVANI]`. Yer tutucu içeren hiçbir metin üretim yayınına çıkmaz (bkz. bölüm 3.4 ve Dilim 6).

---

## 1. Mevcut tanıtım sayfasının eleştirisi

İnceleme `pnpm build && pnpm start` ile üretim derlemesi üzerinde yapıldı. Ekran görüntüleri 1280 px ve 375 px genişlikte, açık ve koyu temada alındı. Lighthouse 12.8 mobil ölçümü (yerel, arka uç yok): Performans 98, Erişilebilirlik 100, En iyi uygulamalar 96, SEO 100; LCP 2,3 s, TBT 70 ms, CLS 0,003. Sayfa bugün **hızlı ve teknik olarak erişilebilir**; başarısız olduğu yer ürün anlatımı, görsel kimlik, site bütünlüğü ve yasal yükümlülükler.

### 1.1 Hero

| Sorun | Neden başarısız |
|---|---|
| 3B sahne bir "M" ya da bina olarak okunmuyor. 14 katman ekstrüzyon `rotateZ(-32deg)` ile döndüğünde ekranda köşeli bir zımba teli ya da köşeli parantez görünüyor. | Marka işaretinin anlamı (iki çatı) yok oluyor; görsel hiçbir şey anlatmayan bir 3B gösteriye dönüşüyor. |
| Açık temada `.topCore` çizgisi `hsl(var(--background))` ile çiziliyor; neredeyse beyaz zemin üzerinde görünmüyor, şekilde bir delik gibi duruyor. | Tema bazında doğrulanmamış görsel; açık temada kusurlu. |
| Izgaralı izometrik plaka, sıradan "3B karo" klişesi. | Ürüne özgü değil; herhangi bir SaaS sayfasında aynısı olabilir. |
| `sway` animasyonu 14 s, `infinite alternate`. Ekran dışında duruyor ama kullanıcıya durdurma denetimi yok. | WCAG 2.2.2 (Duraklat, Durdur, Gizle): 5 saniyeden uzun, kendiliğinden başlayan ve içerikle yan yana duran hareket için görünür durdurma denetimi gerekir. `prefers-reduced-motion` bunun yerine geçmez. |
| 1280 px'te başlığın üstünde ~170 px, CTA'ların altında ~170 px boş alan var; hero görünüm alanının ortasında yüzüyor, alttaki içeriğe bağlanmıyor. | Dikey ritim yok; ilk ekran "ne yapıyor" sorusunu yanıtladıktan sonra okuru bırakıyor. |
| Başlık "Mülk, kiracı ve kira takibi tek hesapta" genel bir kategori tanımı. | Ürünü ayıran şeyi (sözleşmeden dönemsel alacak, kısmi tahsilat, silinmeyen finansal kayıt) söylemiyor. |

### 1.2 Özellik bölümleri

- Üç grup ("Kayıtlar", "Para", "Takip ve güvenlik") iki sütunlu bir `dl` olarak dizilmiş. Sol sütunda yalnız başlık ve tek satır özet var; 1280 px'te her grupta 250–450 px yükseklikte boş sol sütun oluşuyor. Sayfanın %70'i aynı ağırlıkta gri metin duvarı.
- Dokuz maddenin hepsi aynı görsel ağırlıkta. Ürünün ana akışı (mülk → sözleşme → alacak → tahsilat → rapor) bir sıra olduğu halde sıra olarak gösterilmiyor; okur ilişkiyi kendisi kurmak zorunda.
- Grup adları belirsiz: "Para" bir bölüm başlığı olarak bilgi taşımıyor.
- Hiçbir bölüm görsel bir kanıt ya da yapı sunmuyor; sayfa ürün tanıtımı değil, düz bir doküman gibi okunuyor.
- "Bildirimler" maddesi gerçek bildirim türlerini (yaklaşan vade, geciken kira, sözleşme bitişi, kira yıl dönümü) söylemiyor; özellik olduğundan zayıf anlatılıyor.

### 1.3 Gezinme, alt bilgi ve site bütünlüğü

- Üst barda gezinme yok. Güvenlik, iletişim veya yasal sayfa olmadığı için gidilecek yer de yok.
- 480 px altında `.quiet` sınıfı "Giriş yap" bağlantısını gizliyor. Mobilde yapışkan üst barda yalnız "Hesap oluştur" kalıyor; mevcut kullanıcı girişe ulaşmak için en üste dönüp hero'daki düğmeyi bulmak zorunda.
- Alt bilgi yalnız sayfa başlığını tekrarlıyor ("Mülküm: mülk, kiracı ve kira takibi"). Yasal bağlantı, şirket bilgisi, iletişim yok.
- Üç ayrı renk sistemi var: `globals.css` HSL değişkenleri, `landing.module.css` içindeki sabit `hsl(211 100% 40%)` düğme rengi, `auth-shell.module.css` içindeki sabit hex değerleri (`#182431`, `#eef3f6`, `#247da5`...). Sonuç: tanıtım sayfasındaki birincil düğme koyu mavi ve 10 px köşeli, giriş sayfasındaki daha açık mavi ve gölgeli, paneldeki degrade ve hap biçimli. Aynı eylem üç farklı görünüyor.
- Panelin degrade birincil düğmesi (`#199efb` → `#0875e8`) üzerindeki beyaz metin degradenin açık ucunda yaklaşık 2,9:1 kontrast veriyor; AA sınırının (4,5:1) altında. Kapsam dışı ama aynı düğme dili site için tekrar kullanılmamalı.
- Yazı tipi tanımlı değil; `ui-sans-serif, system-ui` ile Windows'ta Segoe UI, macOS'ta SF Pro çiziliyor. Marka kimliği platforma göre değişiyor.
- `body::before` sabit ızgara ve üstten mavi degrade tüm sayfalarda var; tanıtım sayfasında ürünle ilgisiz bir doku. Tam sayfa görüntüde ızgara ilk görünüm alanı yüksekliğinde bitiyor.

### 1.4 Yönlendirme, 404 ve SEO

- `proxy.ts` yalnız listelenen yolları herkese açık sayıyor. Var olmayan her adres (`/yok-boyle-sayfa`, ileride `/kvkk-aydinlatma-metni` dahil) oturumsuz ziyaretçiyi `307` ile `/giris?next=...` adresine gönderiyor. Bugün bir 404 sayfası fiilen yok; yasal sayfalar eklense bile proxy değişmeden açılamaz.
- `robots.txt` ve `sitemap.xml` 404 dönüyor. `metadataBase`, kanonik adres ve Open Graph görseli yok; paylaşılan bağlantı görselsiz çıkar.
- `<meta name="color-scheme">` yok. Tema betiği, kayıtlı tercih yoksa sistem tercihine bakmadan koyu temayı seçiyor; açık sistem temalı ilk ziyaretçi koyu sayfa görüyor.
- Oturumsuz ziyaretçide `/api/bff/me` 401/503 döndüğü için konsola ağ hatası düşüyor; Lighthouse "En iyi uygulamalar" puanını bu düşürüyor.
- Genel `@media (prefers-reduced-motion: reduce)` kuralı tüm öğelere `animation-duration: 0.01ms !important` uyguluyor. Bu kalıp bazı animasyonları ani bir sıçramaya çevirir; hareket her bileşende ayrı ayrı ele alınmalı.

### 1.5 Yasal yükümlülükler

- Kayıt formu e-posta ve hesap adı topluyor ama hiçbir yerde KVKK aydınlatma metnine bağlantı yok. KVKK m.10 aydınlatmanın veri toplanırken yapılmasını ister.
- Çerez politikası, kullanım koşulları, gizlilik politikası ve veri sahibi başvuru yolu yok.
- Veritabanı Azure SQL İsveç bölgesinde (ADR 003). Bu, aydınlatma metninde ve gizlilik politikasında açıklanması gereken bir yurt dışı aktarımdır (KVKK m.9). Bugün hiçbir yerde belirtilmiyor.

### 1.6 Giriş ve kayıt sayfaları

- Sol paneldeki kat planı çizimi tanıtım sayfasındaki 3B işaretle ilişkisiz; iki sayfa iki ayrı ürün gibi duruyor.
- Sol paneldeki marka bir bağlantı değil; giriş sayfasından tanıtım sayfasına dönülemiyor.
- "Mülk kayıtları, tek bir yerde." ve "Portföyünüze güvenli erişim için hesabınızla devam edin." dolgu cümleleri; iş anlatmıyor.
- "Hesap oluştur" ve "Parolamı unuttum" alt alta, aralarında büyük boşlukla duran iki ayrı altı çizili satır. "Parolamı unuttum" bağlantısının yeri parola alanının yanı olmalı.
- Kayıt sayfasında giriş bağlantısının metni yalnız "Giriş"; ne yapacağı belli değil.

---

## 2. Tasarım yönü: "Kesit"

### 2.1 Kavram

**Kesit**: mimari kesit çizimi gibi. Bir binayı katlarına ayırıp içini gösteren çizim, Mülküm'ün yaptığı işin görsel karşılığıdır: mülk birimlere, sözleşme dönemlere, alacak tahsilatlara ayrılır ve her parça kendi yerinde görünür.

Kavramın görünür kuralları:

1. **Tek cesur öğe hero'daki kesit çizimidir.** İki çatılı (marka işaretindeki "M") bir binanın izometrik, katları birbirinden hafifçe ayrılmış cam kesiti. Sayfanın geri kalanı sakin ve disiplinlidir.
2. **Çizgi bilgi taşır.** İnce çizgiler yalnız gerçek bir ayrımı gösterir: bölüm sınırı, adımlar arasındaki bağlantı, kesitteki kat ayrımı. Süs çizgisi, süs ızgarası, daire veya leke yoktur.
3. **Işık kenarda durur.** "İnce parlayan kenar" yalnız üç yerde kullanılır: kesitteki çatı çizgisi, cam üst bar ve yükseltilmiş paneller (CTA bandı, giriş kartı) üst kenarı. Yüzeylerin içinde parlama yoktur.
4. **Cam yalnız yüzen katmanlarda.** Üst bar, mobil menü ve giriş kartı camdır; bölüm zeminleri düzdür.
5. **Kompakt koyu menü her iki temada da koyudur.** Üst bar ve mobil menü açık temada da mürekkep rengi camdır; bu, sitenin imzasıdır ve sahibin "kompakt koyu menü" isteğini doğrudan karşılar.

Klişe denetimi: ilk taslak (koyu zemin, tek parlak mavi vurgu, her özellik için aynı köşe yarıçaplı kart ızgarası, her bölümde aşağıdan kayarak gelen içerik) genel bir SaaS sayfasıydı. Değiştirilenler: kart ızgarası yerine numaralı akış (içerik gerçekten bir sıra olduğu için) ve çizgiyle ayrılmış tanım listeleri; bölüm girişi animasyonu tamamen kaldırıldı, hareket tek bir hero yüklenme anına ve kullanıcının kaydırmasına bağlı tek bir kesit açılmasına indirildi; köşe yarıçapı tek değer yerine hiyerarşiye göre dört değer; büyük harfli üst etiketler (eyebrow) kullanılmıyor.

### 2.2 Tipografi

**Yazı tipi: Instrument Sans** (Google Fonts, değişken: `wght` 400–700, `wdth` 75–100; `latin` ve `latin-ext` alt kümeleri Türkçe ğ, Ğ, ş, Ş, ı, İ, ç, ö, ü karakterlerini kapsar). Tek aile; başlıklarda `wdth` ekseni daraltılarak yazı tipinin kendisi bir tasarım öğesi olarak kullanılır, gövdede normal genişlik okunurluk verir.

- Yükleme: `next/font/google`, `subsets: ["latin", "latin-ext"]`, `axes: ["wdth"]`, `display: "swap"`, `variable: "--font-sans"`, `adjustFontFallback` varsayılan (açık). Kök `app/layout.tsx` içinde bir kez yüklenir; `tailwind.config.ts` `fontFamily.sans` bu değişkeni kullanır. Panel de aynı yazı tipini alır (tek marka kimliği).
- Bütçe: yazı tipi aktarımı ≤ 80 KB (iki woff2 alt kümesi). `wdth` ekseni Google'ın sunduğu dosyada yoksa (Dilim 1'de doğrulanır) başlık daraltması kaldırılır, ağırlıklar aynen kalır; başka yazı tipine geçilmez.
- Rakamlar: yasal sayfalardaki tarih ve madde numaralarında `font-variant-numeric: tabular-nums`.
- Türkçe ayrıntılar: `<html lang="tr">` mevcut; `text-transform` kullanılmaz (büyük harf etiket yok). Büyük başlıklarda satır yüksekliği 1,08'in altına inmez; daha sıkı değerlerde "İ" noktası ve "Ğ" kıvrığı üst satıra çarpar.

Ölçek (klasik tipografik ölçek; px, kök 16 px):

| Rol | Boyut | Ağırlık / genişlik | Satır yüksekliği | İzleme |
|---|---|---|---|---|
| Ekran başlığı (h1, yalnız hero) | `clamp(2.5rem, 1.6rem + 4.2vw, 4.5rem)` = 40→72 | 600 / `wdth` 86 | 1,08 | −0,022em |
| Sayfa başlığı (h1, iç sayfalar) | `clamp(2.25rem, 1.8rem + 2vw, 3rem)` = 36→48 | 600 / 90 | 1,1 | −0,02em |
| Bölüm başlığı (h2) | `clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem)` = 28→40 | 600 / 92 | 1,12 | −0,015em |
| Alt başlık (h3) | 1.3125rem = 21 | 600 / 100 | 1,25 | −0,005em |
| Giriş paragrafı | `clamp(1.0625rem, 1rem + .4vw, 1.1875rem)` = 17→19 | 400 | 1,55 | 0 |
| Gövde | 1rem mobil, 1.0625rem ≥ 768 px = 16→17 | 400 | 1,6 | 0 |
| Yasal gövde | 1rem = 16 | 400 | 1,7 | 0 |
| Küçük | 0.875rem = 14 | 400/500 | 1,5 | 0 |
| En küçük (alt bilgi meta) | 0.8125rem = 13 | 400 | 1,5 | 0,005em |

Satır uzunluğu: gövde en çok 68ch, giriş paragrafı 56ch, yasal metin 70ch. Başlıklarda `text-wrap: balance`, paragraflarda `text-wrap: pretty`. Form denetimlerinde `font-size: max(1rem, 1em)` (iOS yakınlaştırmasını önler).

### 2.3 Renk token'ları

Önek `--k-` (Kesit). Token'lar `app/globals.css` içinde `:root` (açık) ve `.dark` (koyu) altında tanımlanır; site ve giriş sayfaları yalnız bu token'ları kullanır, sabit hex yazılmaz. Panelin mevcut HSL değişkenlerine dokunulmaz.

**Açık tema**

| Token | Hex | Kullanım |
|---|---|---|
| `--k-bg` | `#F5F7FA` | Sayfa zemini |
| `--k-surface` | `#FFFFFF` | Yükseltilmiş panel, form alanı |
| `--k-ink` | `#0E1726` | Başlık ve gövde metni |
| `--k-ink-2` | `#4A5565` | İkincil metin |
| `--k-ink-3` | `#66717F` | Yalnız yer tutucu ve meta (≥ 13 px) |
| `--k-line` | `#D5DDE7` | Bölüm ayırıcı çizgi (süs değil, ayrım) |
| `--k-line-strong` | `#7B8796` | Form alanı kenarı, onay kutusu |
| `--k-accent` | `#0A5FCC` | Bağlantı metni, birincil düğme zemini, odak halkası |
| `--k-accent-hover` | `#084FAA` | Birincil düğme üzerine gelme |
| `--k-glow` | `#2F8BFF` | Yalnız süs kenar ışığı ve kesit çatı çizgisi (metin değil) |
| `--k-danger` | `#B42318` | Hata metni |
| `--k-success` | `#17703F` | Onay metni |

**Koyu tema**

| Token | Hex | Kullanım |
|---|---|---|
| `--k-bg` | `#070B12` | Sayfa zemini |
| `--k-surface` | `#0E1520` | Yükseltilmiş panel |
| `--k-field` | `#0A101A` | Form alanı zemini |
| `--k-ink` | `#E8EEF6` | Metin |
| `--k-ink-2` | `#9AA7B8` | İkincil metin |
| `--k-ink-3` | `#7D8A9C` | Yer tutucu, meta |
| `--k-line` | `#1E2A3A` | Ayırıcı çizgi |
| `--k-line-strong` | `#5E6E83` | Form alanı kenarı |
| `--k-accent` | `#6CB2FF` | Bağlantı metni, odak halkası |
| `--k-accent-fill` | `#1A66D9` | Birincil düğme zemini (beyaz metin) |
| `--k-accent-fill-hover` | `#1F6FEB` | Birincil düğme üzerine gelme |
| `--k-glow` | `#4DA3FF` | Kenar ışığı |
| `--k-danger` | `#FF8A80` | Hata metni |
| `--k-success` | `#5CD69A` | Onay metni |

Açık temada `--k-field` = `--k-surface`, `--k-accent-fill` = `--k-accent`, `--k-accent-fill-hover` = `--k-accent-hover`.

**Koyu cam bar (her iki temada)**

| Token | Değer | Not |
|---|---|---|
| `--k-bar-bg` | `rgb(11 17 27 / .90)` açık temada, `/ .78` koyu temada | `backdrop-filter: blur(14px) saturate(140%)` |
| `--k-bar-ink` | `#E8EEF6` | |
| `--k-bar-ink-2` | `#A7B3C3` | |
| `--k-bar-line` | `rgb(156 203 255 / .16)` | 1 px kenar |
| `--k-bar-ring` | `#6CB2FF` | Bar içindeki odak halkası |

**Ölçülmüş kontrast oranları** (WCAG 2.x göreli parlaklık formülüyle hesaplandı; cam yüzeyler alttaki zeminle karıştırılmış haliyle ölçüldü):

| Çift | Oran | Eşik |
|---|---|---|
| Açık `--k-ink` / `--k-bg` | 16,74 | 4,5 ✔ |
| Açık `--k-ink` / `--k-surface` | 17,96 | 4,5 ✔ |
| Açık `--k-ink-2` / `--k-bg` | 7,04 | 4,5 ✔ |
| Açık `--k-ink-3` / `--k-bg` | 4,62 | 4,5 ✔ |
| Açık `--k-accent` / `--k-bg` (bağlantı) | 5,56 | 4,5 ✔ |
| Açık beyaz / `--k-accent` (birincil düğme) | 5,96 | 4,5 ✔ |
| Açık beyaz / `--k-accent-hover` | 7,75 | 4,5 ✔ |
| Açık `--k-line-strong` / `--k-surface` (alan kenarı) | 3,65 | 3 ✔ |
| Açık `--k-danger` / `--k-surface` | 6,57 | 4,5 ✔ |
| Açık `--k-success` / `--k-surface` | 6,13 | 4,5 ✔ |
| Açık `--k-ink-2` / cam panel (`#FFF` %72, `--k-bg` üstünde) | 7,42 | 4,5 ✔ |
| Koyu `--k-ink` / `--k-bg` | 16,88 | 4,5 ✔ |
| Koyu `--k-ink` / `--k-surface` | 15,69 | 4,5 ✔ |
| Koyu `--k-ink-2` / `--k-surface` | 7,49 | 4,5 ✔ |
| Koyu `--k-ink-3` / `--k-surface` | 5,22 | 4,5 ✔ |
| Koyu `--k-accent` / `--k-bg` | 8,87 | 4,5 ✔ |
| Koyu beyaz / `--k-accent-fill` | 5,32 | 4,5 ✔ |
| Koyu beyaz / `--k-accent-fill-hover` | 4,63 | 4,5 ✔ |
| Koyu `--k-line-strong` / `--k-field` | 3,66 | 3 ✔ |
| Koyu `--k-danger` / `--k-surface` | 8,02 | 4,5 ✔ |
| Koyu `--k-success` / `--k-surface` | 10,06 | 4,5 ✔ |
| Bar metni / bar (açık tema, etkin zemin `#222831`) | 12,71 | 4,5 ✔ |
| Bar ikincil metni / bar (açık tema) | 6,98 | 4,5 ✔ |
| Bar odak halkası / bar (açık tema) | 6,67 | 3 ✔ |
| Bar metni / bar (koyu tema, etkin zemin `#0A1019`) | 16,34 | 4,5 ✔ |
| Birincil düğme kenarı / bar | 3,55 | 3 ✔ (düğme sınırı görünür) |

`--k-line` (açıkta 1,37, koyuda 1,26) yalnız bilgi taşımayan bölüm ayırıcıdır; hiçbir denetimin sınırı olarak kullanılmaz. `--k-glow` açık temada 3,13 verir; metin rengi olarak kullanılmaz.

`forced-colors: active` altında: cam zeminler `Canvas`, kenarlar `CanvasText`, düğmeler `ButtonText`/`ButtonFace`, kesit çizimi `CanvasText` çizgi rengine döner; kenar ışığı ve gölgeler kaldırılır.

### 2.4 Boşluk, köşe yarıçapı, yükselti

**Boşluk ölçeği** (4 px tabanlı): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 → `--k-space-1` … `--k-space-10`.

- Kap: `width: min(100% - 2 * var(--gutter), 1120px)`; `--gutter` 16 px (< 640), 24 px (640–1023), 32 px (≥ 1024).
- Bölüm dikey dolgusu: 64 px mobil, 96 px ≥ 1024 px. Hero: üst 48/96, alt 64/96.
- Başlık ile ilk paragraf: 16 px. Paragraflar arası: 16 px. Bölüm başlığı ile içerik: 32/48 px.
- Form: etiket ile alan 8 px, alan grupları arası 20 px (yakınlık kuralı).

**Köşe yarıçapı** (hiyerarşiye göre, tek değer her yerde değil):

| Token | Değer | Kullanım |
|---|---|---|
| `--k-radius-xs` | 6 px | Onay kutusu, küçük rozet |
| `--k-radius-sm` | 10 px | Düğme, form alanı, menü bağlantısı |
| `--k-radius-md` | 14 px | Üst bar, mobil menü paneli |
| `--k-radius-lg` | 20 px | Yükseltilmiş panel: CTA bandı, giriş kartı |

Hap biçimli düğme yok.

**Yükselti** (üç düzey):

| Düzey | Tanım | Nerede |
|---|---|---|
| 0 Düz | Zemin rengi, gerekiyorsa `--k-line` ayırıcı | Tüm bölümler |
| 1 Cam | `--k-bar-bg` + blur 14 px + 1 px `--k-bar-line` + `inset 0 1px 0 rgb(255 255 255 / .08)` | Üst bar, mobil menü |
| 2 Yükseltilmiş | `--k-surface` (koyuda %86 opak + blur 20 px yalnız ≥ 1024 px ve `hover: hover`), 1 px kenar `--k-line`, gölge `0 24px 60px -24px rgb(5 12 24 / .35)` (koyuda `/ .6`), üst kenar ışığı | CTA bandı, giriş kartı, iletişim kartı |

**Üst kenar ışığı** (tek tanım, `.k-edge` yardımcısı): `::before` ile `inset-inline: 12%`, `top: -1px`, `height: 1px`, `background: linear-gradient(90deg, transparent, var(--k-glow), transparent)`, `opacity: .7` (açık temada `.45`). Odak veya üzerine gelme durumunda opaklık değişmez; ışık durum göstergesi değildir.

### 2.5 Hareket ilkeleri

**Süreler ve eğriler**

| Token | Değer | Kullanım |
|---|---|---|
| `--k-dur-1` | 120 ms | Renk, zemin, kenar rengi geçişi (üzerine gelme) |
| `--k-dur-2` | 180 ms | Mobil menü açılma/kapanma (opaklık + 6 px `translate`) |
| `--k-dur-3` | 320 ms | Hero katlarından her biri |
| `--k-ease-out` | `cubic-bezier(.2, .8, .2, 1)` | Giriş hareketleri |
| `--k-ease-in-out` | `cubic-bezier(.65, 0, .35, 1)` | Çatı çizgisi izi |

**Hareket edenler (tam liste)**

1. Hero yüklenme anı (tek orkestrasyon, toplam ≤ 1,2 s, bir kez çalışır, döngü yok).
2. Hero kesitinin kaydırmaya bağlı açılması: sayfa aşağı kaydırıldıkça katlar arasındaki boşluk 8 px'e kadar artar (yalnız `translate`).
3. Mobil menü paneli açılış/kapanış.
4. Düğme ve bağlantılarda renk/zemin geçişi (120 ms).
5. Düğmeye basışta `scale(.98)` (80 ms), yalnız `prefers-reduced-motion: no-preference`.

**Hiçbir zaman hareket etmeyenler**

- Bölüm, kart veya paragrafların görünüme girerken kayması/solması. Yok.
- Sonsuz döngüler, otomatik dönen içerik, karusel. Yok.
- İmleci izleyen eğim, paralaks metin, sürükleme etkileşimi. Yok.
- Başlık metni, rakamlar, düzen özellikleri (`width`, `height`, `top`, `left`, `margin`). Yok.
- Sayfa geçişi animasyonu. App Router geçişleri anında olur.
- Yanıp sönme: hiçbir koşulda saniyede 3'ten fazla parlaklık değişimi yok.

**Azaltılmış hareket**

- Tüm site hareketleri `@media (prefers-reduced-motion: no-preference)` içinde tanımlanır; varsayılan durum durağan son durumdur. `animation: none` ile geri alma kalıbı kullanılmaz.
- Renk geçişleri (madde 4) azaltılmış harekette de kalır; konum, ölçek ve dönüşüm geçişleri kalkar.
- Mobil menü azaltılmış harekette yalnız opaklık geçişiyle (120 ms) açılır.
- `globals.css` içindeki genel `animation-duration: 0.01ms !important` kuralı kaldırılır; paneldeki mevcut animasyonlar (`route-surface`, `skeleton`, kenar çubuğu genişliği) zaten `no-preference` altında tanımlı olduğundan davranış değişmez (Dilim 1'de doğrulanır).
- Hero animasyonu 5 saniyeden kısa sürdüğü ve bir kez çalıştığı için WCAG 2.2.2 durdurma denetimi gerekmez.

### 2.6 Hero kesit çizimi: teknik ve bütçe

**Teknik: sunucuda üretilen, satır içi izometrik SVG; yalnız CSS animasyonu; istemci JavaScript'i yok.**

Gerekçe: CSS `preserve-3d` ile 14 katmanlı ekstrüzyon (mevcut çözüm) mobil Safari'de çok sayıda birleştirme katmanı açar, açık temada doğrulanamayan renk kırılmaları üretir ve işareti anlaşılmaz hale getirir. WebGL bir bağımlılık ve ana iş parçacığı maliyeti getirir; ADR 004 de dışlar. Önceden izometrik izdüşümle çizilmiş SVG aynı derinlik hissini sıfır JS ile, keskin ve tema token'larıyla boyanmış olarak verir.

**Çizim içeriği** (`viewBox="0 0 560 480"`, `aria-hidden="true"`, `focusable="false"`):

- Zemin: izometrik eşkenar dörtgen; yalnız 1 px kontur (`--k-line-strong`, %40), dolgu yok, ızgara yok.
- Yapı: yan yana iki hacim, ortak bir duvar; her hacim 4 kat dilimi. Her kat: üst yüz (eşkenar dörtgen) + iki yan yüz. Dolgular `--k-glow` rengi, açık temada %6/%10/%14, koyu temada %8/%12/%18 opaklık (cam). Kenarlar 1 px `--k-accent` %55.
- Çatılar: iki beşik çatı; birlikte marka işaretindeki "M" siluetini oluşturur.
- Çatı çizgisi: marka işaretiyle aynı geometri (`M12 48 L12 27 L22 17 L32 27 L42 17 L52 27 L52 48`), izometrik ölçeklenmiş; 2 px `--k-glow`, koyu temada yalnız bu yola `filter: drop-shadow(0 0 6px var(--k-glow))`.
- Vurgulu birim: sağ hacmin 2. katı, üst yüz dolgusu `--k-accent` %22, kenarları `--k-glow`. Bir sözleşmeye bağlı birimi temsil eder. Üzerinde etiket, rakam veya metin yok.
- Gölge: zeminde eşkenar dörtgen biçimli, %8 opak tek bir poligon. Daire ya da bulanık leke değil.

**Yüklenme anı** (`no-preference`):

| Zaman | Öğe | Hareket |
|---|---|---|
| 0–320 ms | 1. kat (iki hacim) | `opacity 0→1`, `translate 0 12px → 0` |
| +60 ms aralıkla | 2.–4. katlar | Aynı |
| 420–740 ms | Çatılar | Aynı |
| 600–1100 ms | Çatı çizgisi | `stroke-dashoffset` uzunluk → 0, `--k-ease-in-out` |
| 900–1200 ms | Vurgulu birim dolgusu | `opacity .4 → 1` |

`animation-fill-mode: backwards` yalnız `no-preference` içinde olduğundan azaltılmış harekette ve CSS yüklenmeden önce çizim son haliyle görünür.

**Kaydırmaya bağlı kesit açılması**: `@supports (animation-timeline: view())` ve `no-preference` içinde. Her kat grubu `--floor` indeksiyle `translate: 0 calc(var(--floor) * -2px)` değerine kadar ayrılır; `animation-timeline: view()`, `animation-range: exit 0% exit 70%`. Desteklemeyen tarayıcıda çizim durağan kalır; JS geri dönüşü yazılmaz.

**Yerleşim ve CLS**: kap `aspect-ratio: 560 / 480`; mobilde `max-height: 280px`, metnin altında; ≥ 1024 px'te sağ sütunda `max-width: 560px`. Boyut önceden ayrıldığı için düzen kayması 0.

**Bütçe**

| Ölçü | Sınır |
|---|---|
| SVG işaretlemesi | ≤ 10 KB ham, ≤ 3 KB gzip |
| SVG öğe sayısı | ≤ 60 `path`/`polygon` |
| Animasyonlu öğe | ≤ 12 grup |
| İstemci JS | 0 KB (sunucu bileşeni) |
| Ana iş parçacığı | Animasyon yalnız `opacity`, `translate` ve tek bir yolda `stroke-dashoffset` |
| LCP etkisi | Yok; LCP öğesi h1 metnidir (satır içi SVG LCP adayı değildir) |

Aynı bileşen giriş/kayıt sayfalarının sol panelinde `animated={false}` ile durağan kullanılır.

---

## 3. Bilgi mimarisi ve yollar

### 3.1 Sayfa mı, bölüm mü

| İçerik | Karar | Yol | Gerekçe |
|---|---|---|---|
| Tanıtım | Sayfa | `/` | Mevcut. |
| Nasıl çalışır | Bölüm | `/#nasil-calisir` | Akış beş adımdır; ayrı sayfa tek ekranlık içeriği bölüp ikinci tıklama gerektirir. |
| Özellikler | Bölüm | `/#ozellikler` | Uygulamada dokuz özellik var ve hepsi tek ekranda anlatılabilir. Ayrı sayfa, aynı içeriği iki yerde tutmayı ve el ile senkronize etmeyi gerektirir (ADR 004: içerik kodda, el ile güncellenir). Özellik sayısı ~20'yi geçerse ayrı sayfaya taşınır. |
| Güvenlik ve veri koruma | Sayfa | `/guvenlik` | Farklı bir okur (temkinli ev sahibi, değerlendirici) farklı bir soruyla gelir; uzun biçimli, doğrudan bağlantı verilen bir sayfa olmalı. Kayıt sayfasından ve alt bilgiden bağlanır. |
| İletişim | Sayfa | `/iletisim` | Yasal metinler veri sahibi başvuru yolunu buraya bağlar; kalıcı adres gerekir. |
| KVKK aydınlatma metni | Sayfa | `/kvkk-aydinlatma-metni` | Yasal yükümlülük; kayıt anında bağlantı verilir, kalıcı ve sürümlü olmalı. |
| Gizlilik politikası | Sayfa | `/gizlilik-politikasi` | Aydınlatma metninin m.10 kapsamı dışında kalanlar: hizmet sağlayıcılar, saklama süreleri, dışa aktarma, hesap kapatma, başvuru yöntemi. Aydınlatma metnini tekrar etmez, ona bağlanır. |
| Çerez politikası | Sayfa | `/cerez-politikasi` | Zorunlu çerez ve yerel depolama kayıtlarının açıklaması. |
| Kullanım koşulları | Sayfa | `/kullanim-kosullari` | Sözleşme metni; kabul edilen sürüm kaydedilecek. |
| 404 | Sayfa | `app/not-found.tsx` | Bugün yok (bkz. 1.4). |
| 500 | Sayfa | `app/error.tsx`, `app/global-error.tsx` | Bugün yok. |
| Yasal metinler merkezi | Yok | — | Dört bağlantı alt bilgide yan yana; ek bir dizin sayfası tıklama ekler, bilgi eklemez. |

### 3.2 Site haritası

```
/                          Tanıtım (#nasil-calisir, #ozellikler, #guvenlik-ozeti)
/guvenlik                  Güvenlik ve veri koruma
/iletisim                  İletişim
/kvkk-aydinlatma-metni     KVKK aydınlatma metni
/gizlilik-politikasi       Gizlilik politikası
/cerez-politikasi          Çerez politikası
/kullanim-kosullari        Kullanım koşulları
/giris  /kayit  /parolami-unuttum  /parola-sifirla  /dogrula  /dogrulama-yeniden-gonder
(404, 500)
```

Üst bar gezinmesi: Nasıl çalışır, Özellikler, Güvenlik, İletişim. Alt bilgi: tüm sayfalar.

### 3.3 Proxy ve dosya düzeni

- `proxy.ts` mantığı tersine çevrilir: **korunan yollar listelenir**, gerisi geçer. Korunan liste `/panel` ve `lib/navigation.ts` içindeki bölüm yollarıdır; bu liste ikon içe aktarmadan bağımsız olarak `lib/protected-paths.ts` dosyasına çıkarılır ve hem `proxy.ts` hem `lib/navigation.ts` tarafından kullanılır. Bilinmeyen yol artık `[section]` sayfasındaki `notFound()` ile 404 olur. Güvenlik etkisi yok: proxy yalnız iyimser bir denetimdir, API her isteği yetkilendirir.
- Yeni yollar `app/(site)/` rota grubu altında; grup düzeni üst bar ve alt bilgiyi bir kez çizer. `app/page.tsx` → `app/(site)/page.tsx`.
- Oturum denetimi için `/api/bff/session` eklenir: her zaman `200 { "signedIn": boolean }` döner (çerez yoksa üst akışa gitmeden `false`). Böylece oturumsuz ziyaretçide konsola 401 düşmez. `/api/bff/me` sözleşmesi değişmez.

### 3.4 Yasal içerik kaynağı ve yer tutucu kuralı

- Yasal metinler `frontend/content/legal/*.ts` dosyalarında tipli nesneler olarak tutulur: başlık, sürüm (`yyyy-mm-dd`), yürürlük tarihi, bölümler (`id`, başlık, paragraflar/listeler). Şirket bilgileri tek kaynaktan gelir: `frontend/content/legal/company.ts`.
- **Hukuki metin yazılmaz, uydurulmaz.** Bu planda verilen yalnız yapı ve zorunlu alanların listesidir. Metin hukuk danışmanından veya şirketten gelir.
- Yer tutucu biçimi: `[BÜYÜK HARF]`. Kural:
  - Önizlemede yer tutucu içeren sayfa görünür bir "Taslak metin, yürürlükte değil." uyarısı ve `robots: noindex` ile yayınlanır.
  - `main` dalına giden CI işi `LEGAL_CONTENT_REQUIRED=1` ile `tests/legal-content.test.ts` çalıştırır; tek bir yer tutucu kalmışsa iş başarısız olur. Üretim yayını yer tutucu ile çıkamaz.

**`company.ts` zorunlu alanları**

| Alan | Yer tutucu | Not |
|---|---|---|
| Ticaret unvanı | `[ŞİRKET UNVANI]` | Veri sorumlusu kimliği (KVKK m.10/a) |
| MERSİS numarası | `[MERSİS NO]` | |
| Ticaret sicili ve numarası | `[TİCARET SİCİL MÜDÜRLÜĞÜ VE NO]` | TTK m.1524 kapsamındaysa sitede yayımlanır (hukuk teyidi) |
| Merkez adresi | `[ADRES]` | |
| KEP adresi | `[KEP ADRESİ]` | Veri sahibi başvuru kanalı |
| Destek e-postası | `[DESTEK E-POSTASI]` | İletişim sayfası ve 500 sayfası |
| KVKK başvuru e-postası | `[KVKK E-POSTASI]` | Sistemde kayıtlı e-posta ile başvuru kanalı |
| Telefon | `[TELEFON]` | İsteğe bağlı; yoksa alan gösterilmez |
| VERBİS kaydı | `[VERBİS NO veya MUAFİYET DURUMU]` | Kayıt yükümlülüğü eşiklere bağlıdır; hukuk belirler |
| Veri sorumlusu temsilcisi | `[TEMSİLCİ — VARSA]` | |
| API sunucusu konumu | `[API SUNUCUSU ÜLKE/ŞEHİR]` | Güvenlik ve gizlilik sayfaları |
| Alan adı | `[ALAN ADI]` | `metadataBase`, kanonik adres, site haritası |

---

## 4. Sayfa belirtimleri

Ortak kurallar (her sayfa için kabul ölçütüdür, aşağıda tekrar edilmez):

- Tek `h1`; başlık seviyeleri atlanmaz. `<header>`, `<nav aria-label="Ana gezinme">`, `<main id="icerik" tabindex="-1">`, `<footer>` yer işaretleri.
- İlk odaklanabilir öğe "İçeriğe geç" bağlantısıdır.
- Tüm etkileşimli öğeler ≥ 44×44 px dokunma alanı (WCAG 2.5.8 için 24 px yeterli; site 44 px uygular).
- Odak göstergesi: 2 px düz `--k-accent` (bar içinde `--k-bar-ring`), `outline-offset: 2px`; odaklanan öğe yapışkan üst barın altında kalmaz (`scroll-padding-top: 88px`, WCAG 2.4.11).
- 375, 768, 1280 px'te yatay taşma yok; 200% yakınlaştırmada içerik kaybı yok; 320 px'te tek sütun (WCAG 1.4.10).
- Açık ve koyu temada aynı içerik; tema düğmesi her sayfada üst barda.
- Hiçbir sayfada örnek mülk, rakam, ekran görüntüsü, referans, logo, istatistik, fiyat veya puan yok.
- Metinlerde `→` eki, ` · ` ile birleştirilmiş meta dizileri, büyük harf etiket yok.

### 4.1 Tanıtım sayfası `/`

**SEO**

- `title`: `Mülküm: mülk, sözleşme ve kira tahsilatı takibi`
- `description`: `Mülk ve birimlerinizi kaydedin, kiracıyla sözleşmeyi bağlayın. Etkin sözleşmeler için kira alacağı her dönem oluşur; tam veya kısmi tahsilatı girin, kalan tutarı görün.`
- Open Graph: aynı başlık ve açıklama, `type: website`, `locale: tr_TR`, `siteName: Mülküm`, görsel `app/opengraph-image.tsx` (1200×630; mürekkep zemin, durağan kesit çizimi, "Mülküm" ve h1 metni; rakam veya ekran görüntüsü yok). Kanonik: `/`.

**Tel çerçeve: masaüstü (1280 px)**

```
┌─[koyu cam bar, 56px, 12px üstten, max 1120]───────────────────────────────┐
│ [M] Mülküm   Nasıl çalışır  Özellikler  Güvenlik  İletişim   ☼  Giriş yap [Hesap oluştur] │
└───────────────────────────────────────────────────────────────────────────┘

  Mülk, sözleşme ve kira            ┌──────────────────────────┐
  tahsilatı aynı kayıtta            │   izometrik cam kesit     │
                                    │   iki çatı = "M"          │
  Mülklerinizi ve birimlerini...    │   katlar ayrık, bir birim │
  (56ch giriş paragrafı)            │   vurgulu                 │
                                    │                           │
  [Hesap oluştur] [Giriş yap]       └──────────────────────────┘
  Hesap, e-posta adresinizi doğruladıktan sonra açılır.
──────────────────────────────────────────────────────────────── (--k-line)
  Bir kira, kayıttan rapora                       #nasil-calisir
  Her adım bir önceki kayda bağlanır; ...

  ①────────②────────③────────④────────⑤     ince bağlantı çizgisi (--k-line-strong),
  Mülk ve   Kiracı ve Kira      Tahsilat  Nakit     tamamlanan bölüm yok, durağan
  birim     sözleşme  alacağı             akışı
  metin     metin     metin     metin     metin
──────────────────────────────────────────────────────────────────
  Akışın yanında tuttuğunuz kayıtlar              #ozellikler
  [ikon] Depozito          [ikon] Giderler
  metin                    metin
  ─────────────            ─────────────
  [ikon] Bildirimler       [ikon] Düzeltme kayıtları
  metin                    metin
──────────────────────────────────────────────────────────────────
  Verileriniz hesabınızda kalır                   #guvenlik-ozeti
  Hesaplar birbirinden   Oturum sunucuda     Finansal kayıtlar
  ayrıdır                doğrulanır          silinmez
  metin                  metin               metin
  Güvenlik ve veri koruma ayrıntıları (bağlantı)
──────────────────────────────────────────────────────────────────
  Mülküm'ün yapmadıkları                 (düz liste, 2 sütun ≥1024)
  – ...  – ...  – ...
──────────────────────────────────────────────────────────────────
  ┌─[yükseltilmiş panel, üst kenar ışığı, r20]────────────────────┐
  │ Kayda başlayın                         [Hesap oluştur] [Giriş yap] │
  │ Hesap oluşturun, e-posta ...                                    │
  └────────────────────────────────────────────────────────────────┘
[alt bilgi]
```

**Tel çerçeve: mobil (375 px)**

```
┌[M] Mülküm        Giriş yap  [≡ Menü]┐  koyu cam bar, 56px, 8px kenar boşluğu
└──────────────────────────────────────┘
 Mülk, sözleşme ve
 kira tahsilatı aynı
 kayıtta                    (40px)
 giriş paragrafı
 [Hesap oluştur        ]   tam genişlik
 [Giriş yap            ]   tam genişlik
 Hesap, e-posta ... açılır.
 ┌ kesit çizimi, max 280px yükseklik ┐
 ────────────
 Bir kira, kayıttan rapora
 ①  Mülk ve birim          dikey akış: numaralar solda,
 │  metin                  bağlantı çizgisi dikey
 ②  Kiracı ve sözleşme
 │  ...
 ⑤  Nakit akışı
 ────────────
 Özellikler: tek sütun, ikon + başlık + metin
 Güvenlik özeti: tek sütun
 Yapmadıkları: tek sütun liste
 CTA paneli: düğmeler tam genişlik, alt alta
 Alt bilgi: tek sütun, gruplar alt alta
```

**Metinler (kesin)**

Hero
- h1: `Mülk, sözleşme ve kira tahsilatı aynı kayıtta`
- Paragraf: `Mülklerinizi ve birimlerini kaydedin, kiracıyla sözleşmeyi bağlayın. Etkin her sözleşme için dönem dönem kira alacağı oluşur; tam ya da kısmi tahsilatı girdiğinizde kalan tutar güncellenir.`
- Birincil düğme: `Hesap oluştur` → `/kayit`. İkincil: `Giriş yap` → `/giris`. Oturum açıksa yalnız birincil `Panele git` → `/panel`.
- Not (küçük, `--k-ink-2`): `Hesap, e-posta adresinizi doğruladıktan sonra açılır.`

Nasıl çalışır (`<section aria-labelledby>`, adımlar `<ol>`; içerik gerçek bir sıra olduğu için numaralıdır)
- h2: `Bir kira, kayıttan rapora`
- Paragraf: `Her adım bir önceki kayda bağlanır; tahsilat girdiğinizde alacak ve rapor aynı veriden güncellenir.`
- 1 `Mülk ve birim`: `Mülkü ve ona bağlı birimleri kaydedin. Kullanmadığınız kayıtları silmeden arşivleyin.`
- 2 `Kiracı ve sözleşme`: `Kiracıyı kaydedin ve birime sözleşmeyle bağlayın: başlangıç tarihi, ödeme günü, aylık bedel ve depozito tutarı.`
- 3 `Kira alacağı`: `Etkin sözleşme için her dönemde bir kira alacağı oluşur. Bedel değiştiğinde yeni bir bedel dönemi eklersiniz; geçmiş dönemler olduğu gibi kalır.`
- 4 `Tahsilat`: `Ödemeyi tam ya da kısmi girin. Kalan tutar ve ödeme durumu alacağa yansır. Yanlış girilen tahsilat silinmez, iptal edilir.`
- 5 `Nakit akışı`: `Seçtiğiniz dönemin tahsilat ve gider hareketlerini raporda görün.`

Özellikler (`<dl>`, ikonlar `lucide-react`, `aria-hidden`)
- h2: `Akışın yanında tuttuğunuz kayıtlar`
- `Depozito` (ikon `Vault`): `Alınan depozitoyu sözleşmeye bağlı kaydedin ve bakiyesini izleyin. Depozito, nakit akışı raporunda tahsilat olarak sayılmaz.`
- `Giderler` (ikon `Receipt`): `Bakım ve onarım gibi giderleri mülke bağlayarak tarih ve kategoriyle kaydedin.`
- `Bildirimler` (ikon `Bell`): `Ödeme günü yaklaşan ve vadesi geçen kiralar, yaklaşan sözleşme bitişi ve kira yıl dönümü için bildirim oluşur. Hangilerinin e-postayla da gelmesini ayarlardan seçersiniz.`
- `Düzeltme kayıtları` (ikon `FilePenLine`): `Kira alacağındaki bir hata, alacak silinmeden açık bir düzeltme kaydıyla giderilir; önceki tutar görünür kalır.`

Güvenlik özeti
- h2: `Verileriniz hesabınızda kalır`
- h3 `Hesaplar birbirinden ayrıdır`: `Her kayıt bir hesaba bağlıdır. Sunucu her istekte kaydın sizin hesabınıza ait olduğunu denetler.`
- h3 `Oturum sunucuda doğrulanır`: `Oturum çerezini tarayıcıdaki betikler okuyamaz. Parolanız değiştiğinde açık oturumlar geçersiz olur.`
- h3 `Finansal kayıtlar silinmez`: `Alacak ve tahsilattaki hatalar iptal ya da düzeltme kaydıyla giderilir; geçmiş korunur.`
- Bağlantı: `Güvenlik ve veri koruma ayrıntıları` → `/guvenlik`

Sınırlar
- h2: `Mülküm'ün yapmadıkları`
- Liste:
  - `Kiracıdan ödeme almaz. Bankadan ya da elden yapılan ödemeyi siz kaydedersiniz.`
  - `Kanuni kira artışını kendiliğinden uygulamaz. Yeni bedeli siz girersiniz.`
  - `Sözleşmeyi hukuken sona erdirmez; planlanan bitiş tarihini gösterir.`
  - `Depozito bakiyesini gösterir; depozitonun yasal saklama biçiminin yerine geçmez.`
  - `Nakit akışı raporu net kâr hesabı değildir.`
  - `Tutarlar Türk lirası olarak ve sabit aylık kira üzerinden tutulur.`

CTA bandı
- h2: `Kayda başlayın`
- Paragraf: `Hesap oluşturun, e-posta adresinizi doğrulayın ve ilk mülkünüzü ekleyin. Hesabınız varsa giriş yapın.`
- Düğmeler hero ile aynı ve oturuma duyarlı.

**Bileşenler**: `SiteHeader`, `SiteMenu`, `SessionActions`, `KesitIllustration`, `Section`, `FlowSteps`, `FeatureList`, `FactRow`, `LimitList`, `CtaBand`, `SiteFooter`.

**Durumlar**

- Oturum bilinmiyor: `SessionActions` yeri ayrılmış boş alan (`min-inline-size` sabit, `aria-hidden`); düzen kayması yok. Denetim 3 s içinde yanıt vermezse oturumsuz varsayılır.
- Oturum açık: yalnız `Panele git`.
- `/api/bff/session` hata: oturumsuz düğmeler gösterilir; hata kullanıcıya gösterilmez (tanıtım sayfasında eylem engellenmez).
- Veri yüklemesi yok; boş durum yok.

**Etkileşim ve hareket**: yalnız hero yüklenme anı, kaydırmaya bağlı kesit açılması, mobil menü (bkz. 2.5). Çapa bağlantıları `scroll-behavior: smooth` yalnız `no-preference` içinde.

**Erişilebilirlik**: hero çizimi `aria-hidden`; akış `<ol>` olarak okunur, numaralar CSS sayacıyla çizilir (ekran okuyucu liste numarasını kendisi okur); güvenlik özeti h3'leri sayfa ana hattında görünür; ikonlar dekoratif.

**Kabul ölçütleri**

- [ ] h1 metni tam olarak `Mülk, sözleşme ve kira tahsilatı aynı kayıtta`.
- [ ] Oturumsuz: `Hesap oluştur` → `/kayit`, `Giriş yap` → `/giris`; mobilde üst barda `Giriş yap` görünür.
- [ ] Oturum açık: `Panele git` → `/panel`; `Hesap oluştur` görünmez.
- [ ] Oturumsuz ziyarette konsolda hata yok.
- [ ] `#nasil-calisir` beş öğeli `<ol>`; `#ozellikler` dört öğeli `<dl>`.
- [ ] Azaltılmış harekette `document.getAnimations().length === 0` ve kesit tüm katlarıyla görünür.
- [ ] Hero kabı boyutu sabit; CLS ≤ 0,02.
- [ ] Lighthouse mobil: Performans ≥ 95, Erişilebilirlik 100, En iyi uygulamalar 100, SEO 100.

### 4.2 Güvenlik ve veri koruma `/guvenlik`

**SEO**: `title` `Güvenlik ve veri koruma | Mülküm`; `description` `Mülküm'de hesapların birbirinden nasıl ayrıldığı, oturumun nasıl doğrulandığı, finansal kayıtların nasıl korunduğu ve verilerin nerede barındırıldığı.`; OG varsayılan görsel; kanonik `/guvenlik`.

**Tel çerçeve**: masaüstünde sol sütun 240 px yapışkan "Bu sayfada" içindekiler, sağda 70ch metin (yasal belge düzeniyle aynı `DocumentLayout`). Mobilde içindekiler başlığın altında açılır/kapanır bir `<details>` olmayan, düz bağlantı listesi olarak; içerik tek sütun.

**Metinler**

- h1: `Güvenlik ve veri koruma`
- Giriş: `Bu sayfa, Mülküm'ün bugün uyguladığı teknik önlemleri anlatır. Kişisel verilerin hangi amaçla işlendiği KVKK aydınlatma metninde yer alır.` (`KVKK aydınlatma metni` bağlantı)
- h2 `Hesap ayrımı`: `Mülk, kiracı, sözleşme, alacak, tahsilat, depozito, gider ve bildirim kayıtlarının her biri tek bir hesaba bağlıdır. Sunucu her istekte oturumdaki hesabı belirler ve yalnız o hesaba ait kayıtları okur ya da değiştirir. Başka bir hesabın kayıt numarası bilinse bile o kayda erişilemez. Bu ayrım, iki ayrı hesapla çalışan otomatik testlerle denetlenir.`
- h2 `Oturum ve giriş`:
  - `Hesap, e-posta adresi doğrulanmadan kullanılamaz.`
  - `Oturum, tarayıcıdaki betiklerin okuyamadığı bir çerezle taşınır ve 8 saat sonra sona erer.`
  - `Parola değiştiğinde veya sıfırlandığında açık oturumlar geçersiz olur.`
  - `Giriş ve kayıt istekleri dakika başına sınırlıdır; çok sayıda deneme geçici olarak reddedilir.`
- h2 `Finansal kayıtlar`: `Tahsilat, kira alacağı ve depozito kayıtları silinmez. Yanlış bir tahsilat iptal edilir; yanlış bir alacak açık bir düzeltme kaydıyla düzeltilir. İptal ve düzeltmeler kaydın geçmişinde görünür kalır.`
- h2 `Belgeler`: `Belge yükleme, yüklenen dosyaları zararlı yazılıma karşı tarayan hizmet bağlanana kadar kapalıdır.`
- h2 `Barındırma ve yedekleme`:
  - `Arayüz Vercel üzerinde, Frankfurt bölgesinde çalışır.`
  - `Uygulama sunucusu [API SUNUCUSU ÜLKE/ŞEHİR] konumundadır.`
  - `Veritabanı Microsoft Azure SQL üzerinde, İsveç (Sweden Central) bölgesindedir. Veritabanına yalnız uygulama sunucusu bağlanabilir.`
  - `Veritabanının otomatik yedeklerinden son 7 gün içindeki bir ana geri dönülebilir.`
  - `Tarayıcı ile arayüz ve arayüz ile uygulama sunucusu arasındaki bağlantılar HTTPS ile şifrelenir.`
- h2 `Güvenlik açığı bildirimi`: `Bir güvenlik açığı bulduğunuzu düşünüyorsanız [GÜVENLİK E-POSTASI] adresine yazın. Açığı başkalarıyla paylaşmadan önce düzeltilmesi için bize süre tanıyın.`
- Son güncelleme satırı: `Son güncelleme: [TARİH]`

Her madde ADR 003, `Program.cs` ve test kodundaki gerçek davranışa dayanır. Sertifika, denetim veya "uçtan uca şifreleme" gibi doğrulanmamış iddia yazılmaz. Barındırma bilgisi aydınlatma metniyle birebir aynı olmalıdır; biri değişirse ikisi aynı PR'da güncellenir.

**Kabul ölçütleri**

- [ ] Her h2 içindekiler listesinde bağlantı olarak var; bağlantılar `#id` ile doğru başlığa gider ve odak başlığa taşınır.
- [ ] `[GÜVENLİK E-POSTASI]` ve `[API SUNUCUSU ÜLKE/ŞEHİR]` yer tutucuları üretimde kalmaz (Dilim 6 denetimi bu sayfayı da kapsar).
- [ ] Ana sayfadaki güvenlik özeti ile bu sayfa çelişmez.

### 4.3 İletişim `/iletisim`

**Karar: İlk sürümde form yok; `mailto:` bağlantısı ve görünür adresler.**

Gerekçe: 20 Kasım'a beş gün var. Form; yeni bir herkese açık uç nokta, spam önlemi, kişisel veri saklama süresi, ayrı aydınlatma ve Vercel arkasında IP tabanlı hız sınırının çalışmaması sorununu (ADR 003) birlikte getirir. `mailto:` bu yüklerin hiçbirini getirmez, ziyaretçinin kendi e-posta istemcisini kullanır ve dürüsttür. Form, aşağıdaki sözleşmeyle yayın sonrası iş olarak tanımlıdır.

**SEO**: `title` `İletişim | Mülküm`; `description` `Mülküm destek, kişisel veri başvurusu ve yazışma adresleri.`; kanonik `/iletisim`.

**Tel çerçeve**: masaüstünde iki sütun: solda h1 ve giriş, sağda yükseltilmiş panel içinde üç `<dl>` grubu. Mobilde tek sütun; panel tam genişlik.

**Metinler**

- h1: `İletişim`
- Giriş: `Hesabınız veya uygulama hakkındaki sorular için destek adresine yazın. Kişisel verilerinizle ilgili başvurular için aşağıdaki başvuru yollarını kullanın.`
- Grup `Destek`: `E-posta` → `[DESTEK E-POSTASI]` (`mailto:` bağlantısı, görünür metin adresin kendisi). Altında: `Yazarken hesabınızda kullandığınız e-posta adresini belirtin. Parolanızı hiçbir zaman e-postayla göndermeyin.`
- Grup `Kişisel veri başvurusu`: `KVKK kapsamındaki başvurunuzu yazılı olarak [ADRES] adresine, [KEP ADRESİ] KEP adresine ya da Mülküm'de kayıtlı e-posta adresinizden [KVKK E-POSTASI] adresine iletebilirsiniz. Başvurular en geç 30 gün içinde yanıtlanır.` + bağlantı `KVKK aydınlatma metni`.
- Grup `Şirket bilgileri`: `Unvan` `[ŞİRKET UNVANI]`, `Adres` `[ADRES]`, `MERSİS` `[MERSİS NO]`, `KEP` `[KEP ADRESİ]`, `Telefon` `[TELEFON]` (değer yoksa satır çizilmez).

**Durumlar**: veri yüklemesi yok. `mailto:` açılmazsa adres metin olarak seçilip kopyalanabilir; ayrıca her adresin yanında `Kopyala` düğmesi (`navigator.clipboard.writeText`, sonuç `role="status"` ile `Kopyalandı`; izin yoksa `Kopyalanamadı. Adresi seçip kopyalayın.`).

**Ertelenen iletişim formu: sözleşme (yayın sonrası, ayrı ADR ile)**

- BFF: `POST /api/bff/contact` → API: `POST /api/public/contact-messages` (anonim, `[EnableRateLimiting("contact")]`).
- İstek gövdesi:

```json
{
  "name": "string, 2–100",
  "email": "string, e-posta, ≤ 256",
  "topic": "GENERAL | SUPPORT | SECURITY",
  "message": "string, 20–2000",
  "noticeAcknowledged": true,
  "website": "string, boş olmalı (bal küpü alanı)",
  "formStartedAtUtc": "ISO-8601"
}
```

- Yanıtlar: `202 Accepted` (gövde yok); `400` `ValidationProblemDetails` (alan bazlı hatalar, Türkçe ileti BFF'de eşlenir); `429` + `Retry-After`; `503` e-posta işçisi kapalıysa. Bal küpü dolu veya `formStartedAtUtc` 3 saniyeden yeniyse `202` döner ama ileti iletilmez (bot'a ipucu verilmez).
- İşleme: ileti veritabanında ayrı tabloya yazılmaz; mevcut `EmailOutbox` ile `[DESTEK E-POSTASI]` adresine gider. Outbox satırındaki gövde gönderimden `[SAKLAMA SÜRESİ]` gün sonra temizlenir.
- Hız sınırı: Vercel arkasında istemci IP'si güvenilir olmadığı için (ADR 003) hem genel sabit pencere (saatte 30 ileti, tüm istemciler) hem e-posta başına (saatte 3) sınır.
- CAPTCHA yok (üçüncü taraf, çerez, erişilebilirlik maliyeti).
- Onay kutusu: zorunlu, metni `İletişim formuna ilişkin aydınlatma metnini okudum.` (bağlantılı). Bu bir **açık rıza değildir**; aydınlatmanın yapıldığını kayda geçirir. İletinin işlenme hukuki sebebi hukuk tarafından belirlenir (`[HUKUK: İLETİŞİM FORMU HUKUKİ SEBEBİ]`). Pazarlama izni istenmez.
- Form erişilebilirliği: etiketler alanların üstünde, `required` görsel ve programatik, hata yalnız gönderimde ya da alandan çıkınca (`:user-invalid` + `aria-invalid`), gönderim başarısızsa odak ilk hatalı alana, sonuç `role="status"`, gönderimden sonra düğme yalnız istek sürerken devre dışı.

**Kabul ölçütleri (ilk sürüm)**

- [ ] Sayfada `<form>` yok; her adres `mailto:` bağlantısı ve görünür metin.
- [ ] `Kopyala` düğmesi klavyeyle çalışır, sonucu ekran okuyucuya bildirir.
- [ ] Yer tutucular üretimde kalmaz.

### 4.4 Yasal belgeler (dört sayfa, tek düzen)

Ortak düzen `LegalDocument`:

- Masaüstü (≥ 1024 px): solda 240 px yapışkan `nav aria-label="Bu sayfada"` içindekiler; sağda 70ch metin. Başlık bloğu: h1, `Sürüm [yyyy-mm-dd]`, `Yürürlük tarihi [TARİH]`, tarihlerde `<time datetime>`.
- Mobil: içindekiler başlığın altında düz numarasız bağlantı listesi; metin tek sütun.
- Bölüm numaraları: hukuki metin maddeleri gerçekten numaralı olduğu için `1.`, `1.1` biçiminde numaralanır.
- Yazdırma: `@media print` üst bar, alt bilgi ve içindekiler gizlenir; bağlantı adresleri metnin yanına yazılır.
- Taslak uyarısı (yer tutucu varken): başlığın altında `role="note"` kutusu: `Taslak metin, yürürlükte değil.`
- Sayfa sonunda: `Bu metnin önceki sürümleri için [KVKK E-POSTASI] adresine yazabilirsiniz.` (Sürüm arşivi gerekirse ADR ile eklenir.)

**KVKK aydınlatma metni `/kvkk-aydinlatma-metni`** (KVKK m.10 ve Aydınlatma Yükümlülüğü Tebliği'nin istediği başlıklar; içerik hukuktan gelir)

- `title` `KVKK aydınlatma metni | Mülküm`; `description` `Mülküm hesabı ve sitesi kapsamında işlenen kişisel veriler, işleme amaçları, aktarımlar ve haklarınız.`
- Bölümler:
  1. `Veri sorumlusu`: `[ŞİRKET UNVANI]`, `[ADRES]`, `[MERSİS NO]`, `[KEP ADRESİ]`, `[TEMSİLCİ — VARSA]`, `[VERBİS NO veya MUAFİYET DURUMU]`
  2. `Hangi kişisel verileri işliyoruz`: veri kategorileri tablosu: kimlik/iletişim (hesap adı, e-posta), müşteri işlem (hesaptaki kayıtlar), işlem güvenliği (oturum, IP adresi, istek kayıtları) `[HUKUK: KATEGORİ LİSTESİ]`
  3. `İşleme amaçları`: `[HUKUK: AMAÇ LİSTESİ]`
  4. `Hukuki sebepler`: amaç-sebep eşleşme tablosu `[HUKUK: KVKK m.5/m.6 EŞLEŞMESİ]`
  5. `Toplama yöntemi`: kayıt formu, uygulama içi girişler, otomatik yollar (oturum çerezi, sunucu kayıtları) `[HUKUK: TEYİT]`
  6. `Aktarımlar`: yurt içi `[HUKUK]`; yurt dışı: Vercel Inc. (arayüz barındırma, Frankfurt bölgesi), Microsoft Azure (veritabanı, İsveç), Cloudflare R2 (belgeler etkinleştirildiğinde) `[HUKUK: KVKK m.9 AKTARIM MEKANİZMASI VE BİLDİRİM DURUMU]`
  7. `Kiracı verileri hakkında`: hesap sahibinin girdiği kiracı verilerinde veri sorumlusu/veri işleyen rolü `[HUKUK: ROL ANALİZİ]` (PRD §15 gereği hukuk incelemesi)
  8. `Saklama süresi`: `[HUKUK: SAKLAMA SÜRELERİ]` (ayrıntı tablosu gizlilik politikasında)
  9. `Haklarınız (KVKK m.11)`: kanundaki haklar listesi
  10. `Başvuru yolu`: yazılı başvuru `[ADRES]`, KEP `[KEP ADRESİ]`, sistemde kayıtlı e-posta ile `[KVKK E-POSTASI]`; yanıt süresi 30 gün (KVKK m.13). `/iletisim` bağlantısı.

**Gizlilik politikası `/gizlilik-politikasi`**

- `title` `Gizlilik politikası | Mülküm`; `description` `Mülküm'ün kullandığı hizmet sağlayıcılar, saklama süreleri, verilerin dışa aktarılması ve hesabın kapatılması.`
- Bölümler: 1 `Kapsam ve aydınlatma metniyle ilişkisi` (aydınlatma metnine bağlantı, tekrar yok); 2 `Hizmet sağlayıcılar` tablosu: sağlayıcı, amaç, konum (Vercel, Microsoft Azure, `[API SUNUCUSU SAĞLAYICISI]`, e-posta: kendi sunucumuzdaki posta sunucusu `[TEYİT]`, Cloudflare R2 `[ETKİNLEŞTİRİLDİĞİNDE]`); 3 `Saklama süreleri` tablosu: hesap verisi, finansal kayıtlar, oturum kayıtları, e-posta kuyruğu `[HUKUK: SÜRELER]`; 4 `Verilerinizi dışa aktarma` `[ÜRÜN: YÖNTEM — BUGÜN UYGULAMADA YOK]`; 5 `Hesabın kapatılması` `[ÜRÜN + HUKUK: SÜREÇ]` (finansal kayıtların silinmediği kuralıyla çelişmemeli); 6 `Güvenlik` (`/guvenlik` bağlantısı); 7 `Değişiklikler` `[HUKUK]`; 8 `İletişim` (`/iletisim`).


**Çerez politikası `/cerez-politikasi`**

- `title` `Çerez politikası | Mülküm`; `description` `Mülküm'ün kullandığı çerez ve tarayıcı depolama kayıtları ve bunların amaçları.`
- Gerçek envanter (kod incelemesiyle doğrulandı; değişirse bu tablo aynı PR'da güncellenir):

| Ad | Tür | Amaç | Süre | Kim yazar |
|---|---|---|---|---|
| `mulk.session` | Çerez, `HttpOnly`, `Secure`, `SameSite=Lax` | Giriş yapılmış oturumu taşır | 8 saat | Mülküm API (BFF üzerinden) |
| `mulk-theme` | Tarayıcı yerel depolaması | Seçtiğiniz açık/koyu temayı hatırlar | Siz silene kadar | Tema düğmesine bastığınızda |
| `mulk-sidebar` | Tarayıcı yerel depolaması | Panel kenar çubuğunun daraltılmış/geniş durumunu hatırlar | Siz silene kadar | Kenar çubuğu düğmesine bastığınızda |

- Bölümler: 1 `Kullandığımız kayıtlar` (tablo); 2 `Analiz ve reklam çerezi` metni: `Mülküm analiz, reklam veya üçüncü taraf takip çerezi kullanmaz.`; 3 `Tercihinizi nasıl silersiniz` (tarayıcı ayarları); 4 `Değişiklikler` `[HUKUK]`; 5 `İletişim`.

**Karar: çerez bildirimi (banner) yok.** Kullanılan tek çerez oturum için zorunludur; iki yerel depolama kaydı yalnız kullanıcının kendi tıklamasıyla yazılan arayüz tercihidir. KVKK'nın çerez rehberi zorunlu çerezler için açık rıza aramaz; aydınlatma bu sayfa ve alt bilgi bağlantısıyla yapılır. Ön koşul ve koruma: analiz, reklam, oturum kaydı aracı veya üçüncü taraf gömme (harita, video, yazı tipi CDN'i) eklenmesi bir ADR ve bu kararın yeniden açılmasını gerektirir. Playwright testi, oturumsuz bir ziyaretçinin tüm herkese açık sayfaları gezdiğinde **hiç çerez almadığını** doğrular (Dilim 8). `next/font` yazı tipini derleme anında kendi alan adımızdan sunar; Google'a istek gitmez. Hukuk teyidi: `[HUKUK: BANNER GEREKMEDİĞİ TEYİDİ]`.

**Kullanım koşulları `/kullanim-kosullari`**

- `title` `Kullanım koşulları | Mülküm`; `description` `Mülküm hesabının kullanım koşulları.`
- Bölümler (yapı; metin hukuktan): 1 `Taraflar` (`[ŞİRKET UNVANI]`); 2 `Hizmetin kapsamı` (bölüm 4.1'deki "yapmadıkları" listesiyle tutarlı: ödeme almaz, hukuki işlem yapmaz); 3 `Hesap ve güvenliği`; 4 `Ücretlendirme` `[ÜRÜN: PLAN VE ÜCRET — PRD §16 AÇIK]`; 5 `Kullanıcının girdiği veriler ve sorumluluk`; 6 `Kişisel veriler ve veri işleme` (aydınlatma metni + `[HUKUK: VERİ İŞLEME EKİ]`); 7 `Hizmet sürekliliği` `[HUKUK]`; 8 `Sorumluluğun sınırı` `[HUKUK]`; 9 `Hesabın kapatılması`; 10 `Değişiklikler ve bildirim`; 11 `Uygulanacak hukuk ve yetki` `[HUKUK]`; 12 `İletişim`.

**Yasal sayfalar ortak kabul ölçütleri**

- [ ] İçindekilerdeki her bağlantı bir h2'ye gider; h2 `id`leri sabittir (sürüm değişse de bağlantılar kırılmaz).
- [ ] Sürüm ve yürürlük tarihi `<time datetime="yyyy-mm-dd">` içinde.
- [ ] Yer tutucu varken taslak uyarısı ve `noindex`; `LEGAL_CONTENT_REQUIRED=1` ile test başarısız.
- [ ] Yazdırma görünümünde yalnız belge metni.
- [ ] İstemci bileşeni yok (sayfa tamamen statik; yalnız üst bardaki menü ve tema düğmesi istemcide).

### 4.5 404 `app/not-found.tsx`

- Site üst barı ve alt bilgisiyle çizilir. HTTP durumu 404.
- h1: `Bu adreste bir sayfa yok`
- Paragraf: `Adresi kontrol edin ya da aşağıdan devam edin.`
- Bağlantılar (düğme biçimli): `Ana sayfa` → `/`, oturuma göre `Giriş yap` → `/giris` veya `Panele git` → `/panel`.
- Durağan kesit çizimi küçük boyutta (180 px), `aria-hidden`.
- SEO: `title` `Sayfa bulunamadı | Mülküm`, `robots: noindex`.
- Kabul: `/yok-boyle-sayfa` oturumsuz ziyarette `/giris`'e yönlenmez, 404 döner; korunan `/portfoy` oturumsuz ziyarette hâlâ `/giris?next=%2Fportfoy`'a yönlenir.

### 4.6 500 `app/error.tsx` ve `app/global-error.tsx`

- `error.tsx` (istemci bileşeni, site düzeni içinde): h1 `Sayfa yüklenemedi`; paragraf `Sayfayı yeniden yükleyin. Sorun sürerse [DESTEK E-POSTASI] adresine yazın ve aşağıdaki hata kodunu ekleyin.`; `Hata kodu: {digest}` (yalnız `digest`, yığın izi veya ileti gösterilmez); düğmeler `Yeniden dene` (`reset()`), `Ana sayfa`.
- `global-error.tsx`: kök düzen de çöktüğünde; kendi `<html lang="tr">` ve `<body>`'si, satır içi en küçük stil (token'lar yüklenemeyebilir), aynı metin. Yazı tipi ve tema betiği yok; `prefers-color-scheme` ile iki renk.
- Odak: yüklenince h1'e taşınır (`tabindex="-1"`).
- Kabul: hata fırlatan bir alt bileşenle yazılan bileşen testinde metin ve düğmeler görünür; `digest` dışında hata ayrıntısı DOM içinde yok.

### 4.7 Giriş, kayıt ve parola sayfaları: aynı sisteme bağlanma

**Düzen**

```
Masaüstü (≥ 1024)                                   Mobil
┌───────────────────────┬──────────────────────┐    ┌[M] Mülküm (bağlantı)  ☼┐
│ [M] Mülküm  (→ "/")   │                      │    │┌ kart ───────────────┐│
│                       │  ┌ yükseltilmiş kart ┐│    ││ Giriş               ││
│  durağan kesit        │  │ r20, üst kenar ışığı││   ││ ...                 ││
│  çizimi               │  │ h1, form          ││    │└─────────────────────┘│
│                       │  └───────────────────┘│    │ KVKK aydınlatma metni │
│ KVKK aydınlatma metni │                    ☼ │    │ Kullanım koşulları    │
│ Kullanım koşulları    │                      │    └───────────────────────┘
└───────────────────────┴──────────────────────┘
```

- Zemin `--k-bg`; sol sütun düz zemin üzerinde durağan `KesitIllustration` (aynı bileşen, `animated={false}`). Mevcut kat planı çizimi ve iki dolgu cümlesi kaldırılır.
- Marka `<a href="/">` olur; erişilebilir adı `Mülküm ana sayfa`.
- Kart: yükselti düzey 2, `--k-radius-lg`, giriş animasyonu yok (form sayfasında hareket dikkat dağıtır; mevcut `rise` kaldırılır).
- Form alanları: yükseklik 48 px, `--k-field` zemin, `--k-line-strong` kenar, odakta 2 px `--k-accent` halka; etiket alanın üstünde; hata metni `--k-danger`, alanla `aria-describedby` ile bağlı.
- Birincil düğme site ile aynı (`--k-accent-fill`, 10 px köşe, tam genişlik).
- `auth-shell.module.css` içindeki tüm sabit hex değerleri `--k-` token'larıyla değiştirilir.

**Metin değişiklikleri**

- Giriş: h1 `Giriş`; alt metin `Mülküm hesabınızın e-posta adresi ve parolasıyla girin.` `Parolamı unuttum` bağlantısı `Parola` etiketinin satırında sağa yaslı. Formun altında tek satır: `Hesabınız yok mu?` + bağlantı `Hesap oluştur`.
- Kayıt: h1 `Hesap oluştur`; gönder düğmesinin üstünde bilgilendirme: `Kişisel verileriniz KVKK aydınlatma metninde açıklandığı şekilde işlenir.` (`KVKK aydınlatma metni` bağlantı, yeni sekme değil). Alttaki `Giriş` bağlantısı `Hesabınız var mı?` + `Giriş yap` olur.
- Kullanım koşulları onay kutusu: `Kullanım koşullarını okudum ve kabul ediyorum.` Zorunlu. **Yalnız yasal metin kesinleştiğinde ve kabul edilen sürüm sunucuda kaydedildiğinde eklenir** (Dilim 9); yer tutuculu bir metnin kabul ettirilmesi anlamsızdır.
- Parolamı unuttum / sıfırlama / doğrulama sayfaları yalnız kabuk değişikliğini alır; metinleri bu planın kapsamı dışında.

**SEO**: `/giris`, `/kayit` dizine eklenebilir (`title` `Giriş | Mülküm`, `Hesap oluştur | Mülküm`). `/parolami-unuttum`, `/parola-sifirla`, `/dogrula`, `/dogrulama-yeniden-gonder` için `robots: noindex`.

**Kabul ölçütleri**

- [ ] Marka bağlantısı `/` adresine gider.
- [ ] Kayıt sayfasında aydınlatma metni bağlantısı gönder düğmesinden önce, klavye sırasında doğru yerde.
- [ ] `auth-shell.module.css` içinde hex renk değeri yok (lint için basit `rg '#[0-9a-fA-F]{3,8}'` denetimi testte).
- [ ] Mevcut `auth-spike`, `register-errors`, `auth-guard` testleri geçer.

---

## 5. Paylaşılan bileşenler

Tümü `frontend/components/site/` altında; stiller `site.module.css` (ve giriş için mevcut `auth-shell.module.css`). Aksi belirtilmedikçe sunucu bileşenidir.

| Bileşen | Tür | Sorumluluk ve kurallar |
|---|---|---|
| `SiteHeader` | Sunucu | Koyu cam bar; `position: sticky; top: 12px` (mobilde 8 px); yükseklik 56 px; `max-width: 1120px`; marka bağlantısı, `nav aria-label="Ana gezinme"`, `ThemeControl`, `SessionActions placement="header"`. ≥ 900 px'te bağlantılar satır içi; altında `SiteMenu`. Mobilde `Giriş yap` bağlantısı barda kalır. `aria-current="page"` `/guvenlik` ve `/iletisim` için; göstergesi metin altında 2 px `--k-bar-ring` çizgi (renk tek başına değil, çizgi + ağırlık 600). |
| `SiteMenu` | İstemci (küçük) | < 900 px. `<button popovertarget="site-menu" aria-controls="site-menu">` görünür metin `Menü` + dekoratif ikon. `<ul id="site-menu" popover="auto">` koyu cam panel, `--k-radius-md`, sağ üstte, `inline-size: min(100dvw - 16px, 360px)`. İçerik: dört gezinme bağlantısı, ayırıcı, `Hesap oluştur` (tam genişlik birincil) ya da `Panele git`, tema satırı. Kapanma: Esc ve dış tıklama yerel popover'dan; bağlantı tıklanınca ve `usePathname` değişince `hidePopover()`. Popover desteklemeyen tarayıcıda `@supports not selector(:popover-open)` ile liste barın altında düz blok olarak görünür; polyfill yüklenmez. Rol `menu`/`menuitem` kullanılmaz; bağlantılar Tab sırasında. Açılış: `opacity` + `translate: 0 -6px`, `@starting-style`, `transition-behavior: allow-discrete` ayrı bildirim. |
| `SessionActions` | İstemci | `components/landing/landing-actions.tsx` yerine. `/api/bff/session` kullanır; yer ayrılmış boş durum; 3 s zaman aşımı oturumsuz kabul edilir. |
| `SiteFooter` | Sunucu | Üç grup (`h2` görsel olarak küçük, 14 px 600): `Ürün` (Nasıl çalışır, Özellikler, Güvenlik, Giriş yap, Hesap oluştur), `Yasal` (KVKK aydınlatma metni, Gizlilik politikası, Çerez politikası, Kullanım koşulları), `İletişim` (`[DESTEK E-POSTASI]`, İletişim sayfası). Alt satır: `© 2026 [ŞİRKET UNVANI]` ve `MERSİS [MERSİS NO]`. Bağlantılar 44 px yükseklik, altı çizili değil ama üzerine gelince/odakta altı çizili; gruplar `nav aria-label="Alt bilgi"` içinde. |
| `Section` | Sunucu | `<section aria-labelledby>`; dikey dolgu token'ı; isteğe bağlı üst `--k-line` ayırıcı; başlık + giriş paragrafı yuvası. Dolgu yalnız burada tanımlanır (bileşen içi `margin` çakışmasını önlemek için iç öğeler dış boşluk vermez). |
| `KesitIllustration` | Sunucu | Bkz. 2.6. Özellik: `animated` (varsayılan `true`), `size` (`hero`, `panel`, `small`). |
| `FlowSteps` | Sunucu | `<ol>`; ≥ 1024 px beş sütun ve numaralar arasında yatay 1 px `--k-line-strong` bağlantı; altında dikey. Numara: 32 px kare, `--k-radius-xs`, 1 px `--k-line-strong` kenar, `tabular-nums`. Hareket yok. |
| `FeatureList` | Sunucu | `<dl>`; ≥ 768 px iki sütun; öğeler arası `--k-line` ayırıcı; ikon 20 px `--k-accent`. Kart değildir: zemin yok, gölge yok. |
| `FactRow` | Sunucu | Güvenlik özeti için üç sütunlu `h3` + paragraf; üst kenarda 2 px `--k-accent` kısa çizgi (24 px) bilgi grubunun başlangıcını gösterir. |
| `CtaBand` | Sunucu + `SessionActions` | Yükselti 2, `.k-edge` üst kenar ışığı, `--k-radius-lg`; ≥ 768 px metin solda düğmeler sağda. |
| `Button` (site) | CSS sınıfları | `.k-btn`, `.k-btn--primary`, `.k-btn--secondary`; 44 px (mobilde 48 px) yükseklik, 10 px köşe, 15 px 600. İkincil: saydam zemin, 1 px `--k-line-strong`. Yalnız `Link` veya `button` üzerinde. `components/ui/button.tsx` panelde kalır. |
| `DocumentLayout` | Sunucu | Güvenlik ve yasal sayfalar: başlık bloğu, içindekiler, metin sütunu, yazdırma stilleri, taslak uyarısı. |
| `LegalDocument` | Sunucu | `content/legal/*.ts` nesnesini `DocumentLayout` ile çizer; yer tutucu tespit eder (`/\[[A-ZÇĞİÖŞÜ0-9 ,/—+.:-]+\]/`), varsa uyarı ve `noindex`. |
| `CopyButton` | İstemci | İletişim sayfası; `role="status"` sonucu. |

**Çerez bildirimi bileşeni yapılmaz** (bkz. 4.4 kararı).

---

## 6. Uygulama planı

Sahiplik: `frontend/` altı frontend ajanı; `docs/`, CI ve kök dosyalar ana ajan; Dilim 9 ve ertelenen iletişim formu backend ajanı + ana ajan (kontrat). Her dilim kendi PR'ıdır, TDD ile ilerler (önce başarısız test), ve kapanmadan önce `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, ilgili `pnpm test:browser` çalışır.

### Dilim 0: Kararlar ve ADR (ana ajan)

- `docs/adr/005-herkese-acik-site-ve-kesit.md` (yeni): rota grubu, korunan-yol listesine geçen proxy, Kesit görsel sistemi, hero tekniğinin değişmesi, çerez bildirimi kararı, iletişimde `mailto:` kararı, yasal içerik yer tutucu kuralı, tema varsayılanının sisteme uyması.
- `docs/adr/004-tanitim-sayfasi.md`: "Hero görseli yalnız CSS 3B dönüşümüyle..." maddesi "ADR 005 ile değiştirildi" notuyla güncellenir; `/api/bff/me` yerine `/api/bff/session`.
- Sahipten bölüm 7'deki üç karar alınır.

### Dilim 1: Token, yazı tipi, tema varsayılanı

- Değişen: `frontend/app/globals.css` (`--k-*` token'ları, `.k-edge`, `.k-btn`; genel `0.01ms !important` kuralının kaldırılması; `body::before` ızgarasının `.app-shell::before` altına taşınması), `frontend/app/layout.tsx` (`next/font` Instrument Sans, `<meta name="color-scheme" content="light dark">`, tema betiği: kayıt yoksa `matchMedia("(prefers-color-scheme: dark)")`), `frontend/tailwind.config.ts` (`fontFamily.sans`).
- Testler: `tests/browser/theme.spec.ts` (yeni): kayıt yokken `emulateMedia({ colorScheme: "light" })` → `html` üzerinde `dark` yok; `"dark"` → var; kayıtlı tercih sistemi geçersiz kılar. Mevcut `visual-audit`, `glass-reference`, `shell` testleri geçer; panel ekran görüntüsü referansları bilinçli olarak güncellenir.
- Kabul: panelde hareket davranışı değişmedi (azaltılmış harekette `route-surface` animasyonu yok).

### Dilim 2: Yönlendirme, 404/500, robots, site haritası, oturum ucu

- Yeni: `frontend/lib/protected-paths.ts`, `frontend/app/not-found.tsx`, `frontend/app/error.tsx`, `frontend/app/global-error.tsx`, `frontend/app/robots.ts` (izin: herkese açık yollar; yasak: `/panel`, bölüm yolları, `/api/`), `frontend/app/sitemap.ts` (yedi herkese açık adres), `frontend/app/api/bff/session/route.ts`.
- Değişen: `frontend/proxy.ts` (korunan liste), `frontend/lib/navigation.ts` (yolları `protected-paths` üzerinden alır), `frontend/app/layout.tsx` (`metadataBase` = `process.env.NEXT_PUBLIC_SITE_URL`, başlık şablonu `%s | Mülküm`).
- Testler: `tests/browser/routing.spec.ts`: `/yok-boyle-sayfa` 404 ve h1; `/portfoy` oturumsuz `/giris?next=%2Fportfoy`; `/robots.txt` ve `/sitemap.xml` 200; `/api/bff/session` çerezsiz `200 {signedIn:false}`. `tests/session-route.test.ts` (node): çerez yokken üst akışa istek yapılmaz.

### Dilim 3: Site kabuğu

- Yeni: `frontend/app/(site)/layout.tsx`, `frontend/components/site/site-header.tsx`, `site-menu.tsx`, `session-actions.tsx`, `site-footer.tsx`, `section.tsx`, `site.module.css`.
- Taşınan: `frontend/app/page.tsx` → `frontend/app/(site)/page.tsx` (bu dilimde içerik aynı kalır, yalnız kabuk değişir).
- Testler: `tests/browser/site-shell.spec.ts`: 375 px'te `Menü` düğmesi Enter ile açılır, ilk bağlantıya Tab ile gidilir, Esc kapatır ve odak düğmeye döner; bağlantı tıklanınca menü kapanır; 375 px'te üst barda `Giriş yap` görünür; 1280 px'te menü düğmesi gizli, dört bağlantı görünür; alt bilgideki her bağlantı `request.get` ile 200 (yasal sayfalar Dilim 6'ya kadar `test.fixme`).

### Dilim 4: Kesit çizimi

- Yeni: `frontend/components/site/kesit-illustration.tsx`, `kesit.module.css`.
- Testler: `tests/kesit.test.ts` (node, sunucu bileşenini dizgeye çizerek): SVG ≤ 10 KB, `aria-hidden="true"`, `path`+`polygon` ≤ 60. `tests/browser/landing.spec.ts`: `reducedMotion: "reduce"` ile `document.getAnimations().length === 0` ve tüm kat gruplarının hesaplanan opaklığı 1; `no-preference` ile 1,5 s sonra animasyon kalmaz (döngü yok).

### Dilim 5: Tanıtım sayfası içeriği

- Değişen: `frontend/app/(site)/page.tsx`. Yeni: `flow-steps.tsx`, `feature-list.tsx`, `fact-row.tsx`, `cta-band.tsx`, `frontend/app/opengraph-image.tsx`.
- Silinen: `frontend/components/landing/` (üç dosya).
- Testler: `landing.spec.ts` güncellenir (yeni h1, beş adımlı `ol`, dört öğeli `dl`, oturumsuz konsol hatası yok: `page.on("console")` ile `error` sayısı 0, oturum açıkken `Panele git`). Mevcut taşma testi korunur.

### Dilim 6: Belge düzeni ve yasal sayfalar

- Yeni: `frontend/components/site/document-layout.tsx`, `legal-document.tsx`; `frontend/content/legal/types.ts`, `company.ts`, `kvkk-aydinlatma.ts`, `gizlilik.ts`, `cerez.ts`, `kullanim-kosullari.ts`; `frontend/app/(site)/kvkk-aydinlatma-metni/page.tsx`, `gizlilik-politikasi/page.tsx`, `cerez-politikasi/page.tsx`, `kullanim-kosullari/page.tsx`.
- Testler: `tests/legal-content.test.ts` (node): her belgede zorunlu bölüm `id`leri var; `LEGAL_CONTENT_REQUIRED=1` iken yer tutucu bulunursa başarısız. `tests/browser/legal.spec.ts`: yer tutucu varken taslak uyarısı ve `meta[name=robots][content*=noindex]`; içindekiler bağlantıları doğru başlığa gider; çerez tablosundaki adlar kodda kullanılan adlarla aynı (`mulk.session`, `mulk-theme`, `mulk-sidebar`).
- CI (ana ajan): `main` hedefli işte `LEGAL_CONTENT_REQUIRED=1 pnpm test`.

### Dilim 7: Güvenlik ve iletişim sayfaları

- Yeni: `frontend/app/(site)/guvenlik/page.tsx`, `frontend/app/(site)/iletisim/page.tsx`, `frontend/components/site/copy-button.tsx`.
- Testler: `tests/browser/public-pages.spec.ts`: iletişim sayfasında `form` sayısı 0, `mailto:` bağlantıları var; `Kopyala` klavyeyle çalışır ve `role=status` metni değişir (izin `context.grantPermissions(["clipboard-write"])`).

### Dilim 8: Giriş kabuğu ve kayıt bilgilendirmesi

- Değişen: `frontend/components/auth-shell.tsx`, `frontend/components/auth-shell.module.css`, `frontend/app/giris/page.tsx`, `frontend/app/kayit/page.tsx`; `noindex` için parola ve doğrulama sayfalarına `metadata` (istemci bileşenlerse sayfa yanına `layout.tsx`).
- Testler: kayıt sayfasında aydınlatma bağlantısı gönder düğmesinden önce; marka bağlantısı `/`; `auth-shell.module.css` içinde hex yok (node testi). Mevcut kimlik doğrulama testleri geçer.

### Dilim 9: Kullanım koşullarının kabulü (yasal metin kesinleşince; backend + ana ajan)

- Kontrat: kayıt isteğine `acceptedTermsVersion: string` (zorunlu); API güncel sürümle eşleşmezse `400`. Kullanıcıda `TermsAcceptedVersion`, `TermsAcceptedAtUtc` (UTC); EF migration; OpenAPI ve `lib/api/generated.ts` yeniden üretilir.
- Testler: backend unit (sürüm eşleşmesi), integration (gerçek SQL Server, alanlar yazılıyor), Playwright (kutu işaretlenmeden gönderimde odak kutuya gider ve hata okunur).

### Dilim 10: Erişilebilirlik ve performans kapısı (ana ajan + frontend)

- `@axe-core/playwright` geliştirme bağımlılığı (sabit sürüm). `tests/browser/a11y.spec.ts`: her herkese açık yol ve giriş/kayıt, açık ve koyu tema, `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` etiketleriyle sıfır ihlal.
- `tests/browser/public-site.spec.ts` (toplu tarama): her yol 375, 768, 1280 px × açık/koyu: 200 durum, tek h1, `scrollWidth - clientWidth <= 0`, `title` beklenen değer, odaklanan öğe bar altında kalmıyor (Tab ile on adım, her adımda `getBoundingClientRect().top >= 72`); oturumsuz gezinme sonunda `context.cookies()` boş.
- Lighthouse: `frontend/lighthouserc.json` ve `pnpm lh` betiği (`@lhci/cli` sabit sürüm, mobil ön ayar, `pnpm start` üzerinde). CI'da `main` hedefli PR'larda bloklayıcı.

**Lighthouse bütçesi (mobil, simüle 4G, Moto G Power)**

| Sayfa | Performans | Erişilebilirlik | En iyi uyg. | SEO | LCP | CLS | TBT | İlk yük JS (gzip) |
|---|---|---|---|---|---|---|---|---|
| `/` | ≥ 95 | 100 | 100 | 100 | ≤ 2,0 s | ≤ 0,02 | ≤ 100 ms | ≤ 175 KB (bugün 165 KB) |
| `/guvenlik` | ≥ 97 | 100 | 100 | 100 | ≤ 1,8 s | ≤ 0,01 | ≤ 50 ms | ≤ 170 KB |
| `/iletisim` | ≥ 97 | 100 | 100 | 100 | ≤ 1,8 s | ≤ 0,01 | ≤ 50 ms | ≤ 172 KB |
| Yasal dört sayfa | ≥ 97 | 100 | 100 | 100 (taslakta `noindex` nedeniyle SEO denetimi atlanır) | ≤ 1,8 s | ≤ 0,01 | ≤ 50 ms | ≤ 170 KB |
| 404 | ≥ 97 | 100 | 100 | — | ≤ 1,8 s | ≤ 0,01 | ≤ 50 ms | ≤ 170 KB |
| `/giris`, `/kayit` | ≥ 95 | 100 | 100 | 100 | ≤ 2,0 s | ≤ 0,02 | ≤ 100 ms | ≤ 185 KB |

Ek sınırlar: yazı tipi ≤ 80 KB; site CSS'i ≤ 20 KB gzip; üçüncü taraf istek 0; `backdrop-filter` yalnız üst bar, mobil menü ve ≥ 1024 px'teki yükseltilmiş paneller.

### Ertelenen: iletişim formu

Bölüm 4.3'teki sözleşmeyle, ayrı bir ADR (006) ve backend dilimiyle; KVKK aydınlatma metnine iletişim formu bölümü eklenmeden açılmaz.

### Doğrulanacak açık noktalar (uygulama sırasında)

- Instrument Sans'ın Google dosyasında `wdth` ekseninin bulunması (Dilim 1).
- `animation-timeline: view()` desteklemeyen tarayıcıda hero'nun durağan kalması (Dilim 4, Firefox ile elle).
- Popover desteklemeyen tarayıcıda menünün düz liste olarak okunur kalması (Dilim 3, eski Safari ile elle veya özellik kapatılarak).

---

## 7. Sahibin onaylaması gereken kararlar

1. **Yasal metinlerin kaynağı ve şirket bilgileri.** Dört yasal metin ve `company.ts` alanları (unvan, MERSİS, adres, KEP, VERBİS durumu, destek ve KVKK e-postaları, API sunucusu konumu) kimden ve ne zaman gelecek? Bu bilgiler gelmeden üretim yayını CI tarafından durdurulur. Proje bir şirket adına değilse, kayıt formunun herkese açık kalıp kalmayacağı ayrıca kararlaştırılmalıdır.
2. **İletişim: `mailto:` (önerilen) mı, form mu?** Öneri: 20 Kasım için yalnız `mailto:` ve görünür adresler; form yayın sonrası, bölüm 4.3'teki sözleşmeyle.
3. **Görsel imza kararları.** (a) Üst bar ve mobil menünün açık temada da koyu cam olması; (b) yeni yazı tipinin (Instrument Sans) panele de uygulanması; (c) kayıtlı tercih yoksa temanın sistem tercihini izlemesi (bugün her zaman koyu). Üçü de önerilen yöndür; panel ekran görüntüsü referansları buna göre güncellenir.
