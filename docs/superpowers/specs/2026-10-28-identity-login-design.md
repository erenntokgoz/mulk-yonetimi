# Identity giriş dilimi

Kayıt ve e-posta teslimi henüz hazır değilken mevcut doğrulanmış hesapların gerçek oturum açması sağlanır. Giriş yalnız e-posta/parola ve tek aktif OWNER üyeliğiyle kabul edilir. Backend, BFF'den iletilen Origin'i açıkça yapılandırılmış frontend origin'iyle karşılaştırır; logout da aynı kuralı uygular. HttpOnly cookie ve `/me` üyelik çözümü mevcut altyapıyı kullanır.

Mevcut Identity servislerini kullanmak yeni auth kütüphanesi eklemekten daha küçük ve tutarlıdır. Form kısa Türkçe hata metni gösterir; parola ve cookie tarayıcı JS'sinde saklanmaz. Kayıt, doğrulama e-postası ve parola sıfırlama ayrı sonraki dilimdir. Bu uçlar olmadan self servis kayıt tamamlanmış sayılmaz.
