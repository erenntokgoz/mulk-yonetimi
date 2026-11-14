# ADR 004 — Herkese açık tanıtım sayfası

- Durum: Kabul edildi
- Tarih: 2026-11-15

## Bağlam

PRD'de herkese açık bir tanıtım sayfası yok. Kök adres (`/`) doğrudan oturum gerektiren genel bakış sayfasıydı; oturumsuz ziyaretçi ürünün ne yaptığını görmeden giriş ekranına yönleniyordu.

## Karar

- `/` herkese açık tanıtım sayfasıdır. Genel bakış `/panel` adresine taşındı; giriş sonrası varsayılan yönlendirme `/panel`'dir.
- `proxy.ts` yalnız `/` yolunu ek olarak herkese açık sayılır; `/panel` ve diğer bölümler oturum çerezi ister.
- İçerik yalnız uygulamada bulunan özellikleri anlatır; istatistik, fiyat, referans veya örnek rakam içermez.
- Oturum açık kullanıcı `/` sayfasında ortak `/api/bff/me` denetimiyle "Panele git" düğmesini görür. Denetim bitene kadar düğme alanı boş ama yer ayrılmış kalır.
- Hero görseli yalnız CSS 3B dönüşümüyle çizilen, marka işaretinden türetilmiş katmanlı bir sahnedir. WebGL ve ek bağımlılık yoktur; ekran dışında ve sekme gizliyken duraklar, azaltılmış harekette sabit kalır.

## Sonuçlar

- Eski `/` bağlantıları ve yer imleri tanıtım sayfasına gider; oturum açıksa tek tıkla panele ulaşılır.
- Tanıtım sayfası yeni bir özellik eklendiğinde elle güncellenmelidir; kapsam dışı vaat içermemesi için içerik kodda tutulur.
- Panel adresi değiştiği için testler ve gezinme `/panel` kullanır.
