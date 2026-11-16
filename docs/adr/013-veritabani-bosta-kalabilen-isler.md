# ADR 013 · Ücretsiz Azure SQL'i uyutan arka plan işleri

Durum: kabul edildi. Tarih: 16 Kasım 2026.

Üretim veritabanı Azure SQL serverless ücretsiz teklifidir: ayda 100.000 vCore-saniye, bitince ay sonuna kadar otomatik duraklama. Veritabanı yalnız oturum sayısı ve CPU, ayarlı boşta kalma süresi (auto-pause delay) boyunca sıfırsa duraklar. Etkin her saniye en az alt vCore sınırı (0,5) kadar faturalanır; hiç duraklamayan veritabanı ayda yaklaşık 0,5 × 2.592.000 ≈ 1,3 milyon vCore-saniye harcar.

API'nin arka plan işleri veritabanını sürekli sorguluyordu: e-posta outbox işleyicisi 15 saniyede bir, kira alacağı, bildirim ve belge temizliği 15 dakikada bir. Veritabanı hiç duraklamadı ve ilk ücretsiz veritabanı `MulkYonetimi` Kasım kotasını birkaç günde bitirip ay sonuna kadar kapandı. Yeni kotayla `MulkYonetimi2` oluşturuldu; üretim bağlantısı bu veritabanını kullanır. Şema aynı idempotent migration scriptiyle kurulur, yeni migration yoktur.

## Karar

- **Outbox olay güdümlüdür.** Bir istek outbox kaydı eklediğinde EF Core interceptor'ı, kayıt commit edildikten sonra süreç içi sinyalle işleyiciyi uyandırır. Posta, isteğin veritabanı etkinliği sürerken hemen gönderilir. Açık transaction varsa sinyal commit'e ertelenir; rollback sinyal üretmez.
- **Güvenlik taraması seyrektir.** İşleyici açılışta bir tur çalışır (önceki süreçten kalan kayıtlar), sonra `Jobs:OutboxSweepMinutes` (varsayılan 360) aralığında tarar. Zamanı gelmiş bir tekrar denemesi taramadan önceyse işleyici o zaman uyanır; son turdan en az 5 dakika sonra ve yalnız bekleyen iş varken. Teslim kuralları, deneme sayısı (5), `FAILED` durumu ve claim/idempotency değişmez; yalnız 1-2-4 dakikalık erken denemeler en az 5 dakika aralıkla yapılır.
- **Zamanlı işler** açılışta bir kez, sonra başlangıçtan ölçülen sabit tempoyla çalışır: `Jobs:RentChargeHours` ve `Jobs:NotificationHours` varsayılan 12, üst sınır 24; `Jobs:DocumentCleanupHours` varsayılan 12. Başarısız tur 5 dakikadan başlayıp aralığa kadar katlanarak yeniden denenir.
- **Dönem kaçmaz, çift kayıt olmaz.** Kira üretimi kaçırılan bütün ayları tamamlar ve `(AccountId, LeaseId, PeriodStart)` tekildir. Bildirim anahtarları çalışma saatinden değil olaydan türetilir (alacak ve vade, gecikme, bitiş tarihi, yıl). Vade penceresi 4 gün, bitiş penceresi 31 gündür. Yalnız gününde tetiklenen yıl dönümü için 24 saatlik üst sınır her İstanbul takvim gününe en az bir tur düşürür. Bildirim turu önce eksik kira alacaklarını tamamlar; ayrı alacak işinin zamanlamasına bağlı kalmaz.
- **Başka zamanlayıcı yoktur.** `/health` SQL'i yalnız çağrıldığında çalıştırır. API kendini pinglemez. Harici izleyicinin `/health`'i sık çağırmaması [yayın belgesinde](../deploy-ubuntu-azure.md) yazılıdır.

## Sonuçlar

- Veritabanı duraklamışken gelen ilk istek, veritabanı uyanırken 30-60 saniye sürebilir veya zaman aşımına düşebilir. Kota korunması için bu soğuk başlangıç kabul edilir.
- Zamanlanmış uyanmalar açılıştan itibaren 6 saatte birdir; 12 saatlik işler taramalarla aynı anlara denk gelir. Her uyanma, auto-pause delay ve bağlantı havuzunun boşta tuttuğu birkaç dakika kadar faturalanır. Auto-pause delay 15 dakikaya çekilmelidir: günde 4 uyanma × yaklaşık 25 dakika × 0,5 vCore ≈ 3.000 vCore-saniye/gün, ayda yaklaşık 90.000 eder. Kullanıcı trafiğine pay kalması için `Jobs__OutboxSweepMinutes=720` taramayı 12 saatlik işlerle hizalar ve bu payı yaklaşık 45.000'e indirir. Tekrar denemeleri taramadan bağımsız olarak kendi zamanlarında uyanır.
- Uygulama tek API örneğiyle çalışır. İkinci bir örnek kendi isteklerinin sinyalini alır; diğer örneğin kayıtlarını en geç taramada görür.

Alternatif olarak dakikalık sorguyu korumak, ücretli sağlanmış (provisioned) katmana geçmeyi gerektirir. Harici zamanlayıcıya (cron) taşımak da aynı uyanma bedelini öder ve yeni bir işletim parçası ekler.
