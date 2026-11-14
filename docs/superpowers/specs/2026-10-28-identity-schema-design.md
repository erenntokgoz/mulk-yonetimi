# Identity ve hesap üyeliği şeması

## Amaç

Kullanıcı kimliğini ASP.NET Core Identity'de, mülk sahibi hesabını `Accounts` tablosunda ve kullanıcı-hesap yetkisini `AccountMembers` tablosunda ayrı tutmak. API daha sonra `AccountId` değerini yalnız doğrulanmış üyelikten çözer.

## Yaklaşım

`ApplicationDbContext`, `IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>` olur. `Account` UUID anahtar ve UTC oluşturma zamanı taşır. `AccountMember` bileşik `(AccountId, UserId)` anahtar, `OWNER` rolü ve durum taşır; her iki ilişki SQL FK ile korunur. Kullanıcı birden fazla hesaba üye olabilir; MVP oturum seçimi bir sonraki dilimde açıkça çözülecek. İstemci `AccountId` yetki kaynağı olamaz.

Tek tabloya kullanıcı ve hesabı birleştirmek üyelik/yetki sınırını kaybettirir. Özel parola tablosu ise Identity güvenlik özelliklerini tekrar uygulamayı gerektirir.

## Doğrulama

Yeni EF migration gerçek SQL Server test veritabanına uygulanır. Test Identity, Accounts ve AccountMembers tablolarını, üyelik anahtarını ve olmayan account/user için FK reddini doğrular. Uygulama açılışında migration çalışmaz.

## Sınır

Bu dilim kayıt/giriş endpoint'i, cookie oluşturma, e-posta doğrulama, aktif hesap seçimi ve mülk verisine tenant policy uygulaması içermez. Bunlar FND-03 devamı ve AUTH-01/02 kapsamındadır.
