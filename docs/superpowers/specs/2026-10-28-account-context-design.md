# Aktif hesap çözümleme

## Amaç

API, `AccountId` yetkisini istemci girdisinden değil doğrulanmış kullanıcı kimliği ve SQL Server üyeliğinden elde eder.

## Tasarım

`AccountMembershipResolver`, yalnız authenticated principal içindeki `NameIdentifier` kullanıcı GUID'ini okur. SQL sorgusu e-postası doğrulanmış kullanıcıyı, `OWNER`/`ACTIVE` üyeliği ve `ACTIVE` hesabı birlikte denetler. Tam bir sonuç varsa hesap GUID'i döner; sıfır veya birden fazla sonuçta yetki vermez. Çoklu hesap seçimi MVP'de tanımlanmadığından belirsiz üyelikte kapalı davranır.

Servis istemciden `AccountId` parametresi almaz. API endpoint'leri ve her ürün sorgusu bu sonuçla kapsamlanacak; bu dilim tek başına API yetkilendirmesi sağlamaz.

## Doğrulama

Gerçek SQL Server integration testi iki kullanıcı/iki hesapla doğru eşleşmeyi, yanıltıcı `AccountId` claim'inin yok sayılmasını, doğrulanmamış e-posta ve askıdaki üyelik reddini, çoklu aktif üyelikte kapalı davranışı denetler.
