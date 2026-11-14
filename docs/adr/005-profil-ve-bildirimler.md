# ADR 005 — Profil ve bildirim kapsamı

- Durum: Kabul edildi
- Tarih: 14 Kasım 2026

## Karar

- Kullanıcının görünen adı Identity kullanıcısında tutulur; e-posta adresi ve doğrulama durumu yalnız okunur.
- Bildirim tercihleri, aktif hesap üyeliği başına saklanır. E-posta varsayılan kapalıdır; olay türleri varsayılan açıktır.
- E-posta aboneliği yalnız doğrulanmış kullanıcı için açılır. Gönderim sırasında worker tercih ve doğrulama durumunu tekrar denetler.
- Vade yaklaşma eşiği 3 takvim günü, planlanan sözleşme bitiş uyarısı 30 takvim günüdür. Gecikmiş kira ilk vade sonrası gün üretilir. Kira yıl dönümü sözleşme başlangıcının her yıl aynı ay/gün tarihindedir.
- Her olay için kullanıcıya ve hesaba bağlı tek `EventKey` vardır. Bildirim ve SMTP outbox yeniden çalıştırmada çoğaltılmaz. Sözleşme tarihi bildirimi fesih işlemi başlatmaz.
- Hesap-kullanıcı bileşik FK'si bildirim ve tercihlerin üyeliğe ait olmasını SQL seviyesinde zorunlu kılar.

## Gerekçe

PRD bildirim türlerini ve tekrar üretiminde tekilliği belirler ancak zaman eşiklerini, varsayılan tercihleri ve e-posta aboneliğinin kapsamını belirtmez. Bunlar ilk uygulama için operasyonel varsayılanlardır; hukukî fesih veya kiracıya mesaj gönderimi anlamına gelmez.

## Sonuç

Eşikler ve varsayılanlar konfigürasyonsuz ürün davranışıdır; değiştirilmek istendiğinde bu karar güncellenir. SMTP ayarları olmadan e-posta outbox teslim edilmez. Uygulama içi bildirimler bundan bağımsızdır.
