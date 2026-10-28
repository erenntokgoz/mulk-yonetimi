# Auth e-posta outbox tasarımı

Kayıt, doğrulama tekrar gönderimi ve parola sıfırlama istekleri e-postayı SQL outbox'a yazar. Kayıt ile mesaj aynı transaction'da commit edilir. HTTP yanıtı SMTP hızına bağlı değildir.

Tek SQL Server tablosu `AccountId` FK, mesaj türü, payload sürümü, alıcı, Data Protection ile korunan URL, durum, deneme sayısı ve UTC zamanları tutar. URL içindeki Identity tokenı düz metin olarak saklanmaz. Hosted worker vadesi gelen mesajı koşullu SQL update ile claim eder; lease süresi bitince başka worker yeniden alabilir. SMTP gönderimi 90 saniyede iptal edilir, claim iki dakika geçerlidir. SMTP başarısında `SENT`, hatada sınırlı gecikmeyle tekrar `PENDING`, kalıcı deneme sınırında `FAILED` olur. Hata logu yalnız mesaj ID/tür/deneme/durum içerir. `FAILED` satır sayısı sağlık denetimini `Degraded` yapar. İşlem en az bir kez gönderim semantiğindedir; SMTP kabulünden sonra DB commit hatası nadiren tekrar e-postaya yol açabilir.

Alternatifler: doğrudan SMTP mevcut transaction'ı uzun süre açık tutuyor ve geçici sağlayıcı hatasında kayıt kayboluyor; ayrı broker MVP için ek işletim yükü getiriyor. SQL outbox mevcut veritabanıyla uyumlu.

SMTP sağlayıcısı ve staging host bilgisi bulunmadığından canlı teslim ve BFF staging testi dış ortam kurulumuna kalır. Migration uygulama açılışında çalışmaz.
