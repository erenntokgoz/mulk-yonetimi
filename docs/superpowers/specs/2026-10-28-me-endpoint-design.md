# Korunmuş oturum bilgisi endpoint'i

## Amaç

`GET /api/v1/me`, oturumun doğrulanmış kullanıcıya ait olduğunu ve tek aktif OWNER hesabının SQL üyeliğinden çözüldüğünü doğrular. Anonim istek 401; üyeliği yetkisiz hale gelen oturum 403 alır.

## Yaklaşım

ASP.NET Core Identity kullanıcı/store ve cookie auth tek kimlik otoritesidir. Cookie HttpOnly, SameSite=Lax ve 8 saatliktir; staging/production'da Secure zorunludur. API isteklerinde redirect yerine 401/403 döner. `AccountMembershipResolver` her `/me` isteğinde SQL üyeliğini yeniden denetler; istemci claim'inde `AccountId` olsa bile yetki kaynağı değildir. Yanıt yalnız çözülen `AccountId` içerir ve önbelleğe alınmaz.

Auth.js veya istemci JWT modeli eklenmez. BFF oturum denemesi `/me` yanıtını taşıyabilir, ancak kayıt/giriş endpoint'leri ve backend CSRF koruması sonraki dilimde tamamlanır.

## Doğrulama

API testi anonim çağrının yönlendirme olmadan 401 verdiğini doğrular. Gerçek SQL integration testi oturum cookie'siyle hesabı A olarak görür, yanıltıcı B claim'ini yok sayar ve üyelik askıya alınınca aynı cookie ile 403 alır.
