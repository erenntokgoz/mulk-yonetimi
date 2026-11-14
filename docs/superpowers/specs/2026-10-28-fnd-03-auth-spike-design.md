# FND-03 BFF Oturum Denemesi

## Amaç

Next.js ile .NET API ayrı hostlarda çalışırken tarayıcıya HttpOnly oturum çerezi ulaştırılabildiğini, sonraki istekte API'ye taşınabildiğini ve farklı origin'den gelen mutation'ın reddedildiğini kanıtlamak.

## Yaklaşımlar

- Seçilen: Next route handler, yalnız izin verilen auth ve `/me` yollarını API'ye server tarafında iletir. Tarayıcı yalnız Next hostuyla konuşur. Cookie tarayıcı JS'sine açılmaz.
- Doğrudan browser→API: CORS, cookie domain ve credentials ayarlarını ortamlara yayar; tasarımdaki BFF sınırıyla uyuşmaz.
- Ayrı Auth.js oturumu: ikinci kimlik otoritesi yaratır.

## Kapsam

- Bir test fixture API oturum cookie'si üretir; production auth endpoint'i bu denemede taklit edilmez.
- Next BFF yalnız sabit login, logout ve `/me` yollarını proxy eder. İstemciden gelen URL, account ID veya backend host kabul edilmez.
- POST için yapılandırılmış frontend origin'i ile `Origin` eşleşir; eksik veya yabancı origin reddedilir. Backend ayrıca kendi antiforgery korumasını FND-03 devamında uygulayacaktır.
- `Set-Cookie` ve `Cookie` header'ları uçtan uca iletilir. Redirect takip edilmez; backend ağ hatası kontrollü 502 olur.
- Test gerçek Next sunucusu + ayrı HTTP fixture ile cookie ve CSRF davranışını kanıtlar.

## Sınır

Bu deneme kullanıcı kaydı, Identity veritabanı, e-posta doğrulaması ve tenant yetkilendirmesi içermez. Bu parçalar ayrı FND-03 dilimleridir; proxy denemesi tek başına güvenli oturumun tamamlandığı anlamına gelmez.
