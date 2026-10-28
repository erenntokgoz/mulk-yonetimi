# Kayıt ve e-posta doğrulama

Kullanıcı e-posta, parola ve hesap adıyla kaydolur. Kullanıcı, hesap ve OWNER üyeliği tek SQL transaction'ında oluşturulur. Identity doğrulama tokenı SMTP ile gönderilir; teslim başarısızsa transaction geri alınır. Doğrulama bağlantısı frontend `/dogrula` sayfasına gider; sayfa tokenı BFF üzerinden backend'e POST eder. Doğrulama tamamlanmadan giriş kabul edilmez. SMTP yapılandırması yoksa kayıt 503 döner.

Bu dilim mevcut Identity ve BFF yapısını kullanır. Üretimde kalıcı, ortak Data Protection key dizini zorunludur. Parola sıfırlama, yeniden gönderim ve e-posta outbox'ı sonraki güvenlik/operasyon işidir. SMTP teslimi ile SQL commit arasındaki kısa aralıkta commit hatası yaşanırsa bağlantı geçersiz kalabilir; yeniden kayıt veya yeniden gönderim akışı bu durum için gereklidir.
