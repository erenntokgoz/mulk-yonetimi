# Arayüz ve API akış durumu — 13 Kasım 2026

## Görsel yön

Video referansındaki koyu yönetim paneli, sabit sol gezinme, sayfa başlığı, yoğun ana içerik ve mavi seçili durumlar uyarlanmıştır. Açık/koyu tema kabuktan değişir ve tercih saklanır. Kart girişi ve etkileşim geçişleri azaltılmış hareket tercihini izler. Önceki tercihe göre büyük daire arka planı kullanılmaz.

Ana ekran gerçek sistem sağlık yanıtını gösterir. Portföy, kiracı, sözleşme ve tahsilat kayıtları kendi BFF/API akışlarından gelir. Gerçek veri API'si olmayan satış grafiği, kira toplamı, hedef veya örnek kayıt gösterilmez.

## API akışları

- Giriş, kayıt, e-posta doğrulama, doğrulama bağlantısı yenileme, parola unutma ve sıfırlama BFF üzerinden backend Identity uçlarına bağlıdır. Shell `/api/bff/me` ile oturum durumunu okur ve logout sunar.
- Portföy listesi, mülk oluşturma/düzenleme/arşivleme ile birim listeleme/ekleme BFF üzerinden backend'e bağlıdır.
- Kiracı listesi/arama, oluşturma, düzenleme ve arşivleme BFF üzerinden bağlıdır.
- Sözleşme taslağı, etkinleştirme, sonlandırma ve kira bedeli geçmişi/değişikliği BFF üzerinden bağlıdır.
- Alacak listesi/düzeltme, tahsilat oluşturma/listeleme, tahsilat dağıtma ve iptal API'ye bağlıdır; tekrarlanabilir yazmalarda aynı `Idempotency-Key` korunur.

## Doğrulama

Frontend Playwright senaryoları Next production server'ı ve bellek tabanlı API fixture'ını kullanır. Bunlar frontend-BFF istek/yanıt akışlarını doğrular, gerçek SQL Server veya tenant izolasyon testi değildir.

## Görsel doğrulama — 14 Kasım 2026

Portföyün tablo/kart görünümü ve 390 px mobil taşma kontrolü `ests/browser/glass-reference.spec.ts içindedir; fixture kaydı yalnız tarayıcı testinde kullanılır. page.spec.ts azaltılmış hareket kontrolü koyu arka plan (#060a10), 24 px cam bulanıklığı ve çok kısa animasyon süresini denetler. Bu turda browser doğrulaması 5089 test fixture port çakışması nedeniyle çalışmadı; ekran görüntüsü ve video kanıtı yeniden alınmadı. Uygulama localhost:3000 üzerinde önceki süreçle çalışıyordu; gerçek API 5080 bu kontrolde dinlemiyordu.
