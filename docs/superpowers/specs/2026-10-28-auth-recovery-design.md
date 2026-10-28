# Hesap kurtarma

Doğrulanmamış kullanıcı e-posta bağlantısını yeniden isteyebilir. Doğrulanmış kullanıcı parola sıfırlama bağlantısı isteyebilir. Her iki istek bilinen ve bilinmeyen e-postaya aynı 202 yanıtını verir. Identity tokenı SMTP üzerinden gönderilir ve BFF formundan POST ile tüketilir. Yeni parola kaydedildiğinde security stamp değişir; cookie her istekte yeniden kontrol edildiğinden eski oturum reddedilir.

Mevcut Identity token sağlayıcısı ve SMTP servisi kullanılır. Üç kısa Türkçe form eklenir. Rate limiting ve e-posta outbox'ı ayrı operasyon dilimidir; bunlar tamamlanmadan internet trafiğine açılmamalıdır.
