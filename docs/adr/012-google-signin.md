# ADR 012 · Google girişi ve mevcut hesaplar

Durum: kabul edildi. Tarih: 16 Kasım 2026.

PRD FR-01 e-posta doğrulamalı kimlik ve pilot onayı ister. Google girişi eklenirken ASP.NET Core Identity'nin oturum ve tenant otoritesi korunur. Next BFF, yetkilendirme kodunu Google ile sunucuda değiştirir; Identity çerezini yalnız API üretir.

- BFF yalnız kayıtlı callback kökenlerine izin verir. Kod akışı PKCE S256, state ve nonce kullanır. İlgili değerler on dakika yaşayan, şifreli, HttpOnly, Secure ve SameSite=Lax akış çerezinde tutulur. Callback çerezi temizler ve yalnız uygulama içi bir hedefe gider.
- Kullanıcı Google'ı açılır pencerede açar. Callback, aynı origin'deki ana pencereye yalnız işlem sonucunu gönderir. Ana pencere mesajın origin ve pencere kaynağını doğrular ve pencereyi kapatır. Uygulama sayfalarında COOP açılır pencerelere izin verir. Yalnız callback, Google'dan dönüşte opener bağlantısının korunması için unsafe-none kullanır.

- API, Google JWKS ile RS256 imzasını, issuer, tek audience, süre, nonce ve doğrulanmış e-postayı denetler. Beklenen audience sunucudaki OAuth client ID'dir. Google'ın kalıcı kimliği olan `sub`, bağlı kullanıcıyı seçer; e-posta değişikliği ikinci kullanıcı veya tenant üretmez.
- İlk hesap oluşturma veya e-posta eşleşmesiyle bağlantı, Google'ın posta adresi için otorite olduğu doğrulanmış Gmail/Googlemail veya Workspace (`hd`) adresleriyle sınırlıdır. Başka sağlayıcıdaki doğrulanmış adresin güncel sahipliği Google'dan kanıtlanamaz. Aynı kullanıcıya ikinci bir Google kimliği otomatik bağlanmaz. Aynı e-posta ile önceden açılmış doğrulanmamış kaydın parolası kaldırılır ve eski bağlantıları geçersiz kılınır.
- Yeni Google kullanıcısı mevcut pilot planında `PENDING` başlar. Kilitli, onay bekleyen veya tek etkin sahip üyeliği olmayan kullanıcıya oturum verilmez. Uygun oturum, parola girişinde kullanılan Identity çerezi ve aynı tenant kurallarıyla çalışır.
- Google istemci sırrı yalnız BFF sunucusundadır; API yalnız client ID bilir. Kod, belirteç ve çerezler loglanmaz. Geliştirme için sahte sağlayıcı ve imzalı test token'ları, canlı kabul için gerçek Google hesabı kullanılır.

Alternatif olarak tüm `email_verified` adreslerini eşleştirmek, sağlayıcının güncel sahipliğini kanıtlayamadığı e-postalarda hesap devralma riski doğurur. Bu adresler parola ve e-posta doğrulama yolu ile devam eder. Açık ve ayrı bir hesap bağlama ekranı bu dilimin dışındadır.

Kaynak: [Google'ın sunucuda token ve e-posta otoritesi doğrulaması](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
