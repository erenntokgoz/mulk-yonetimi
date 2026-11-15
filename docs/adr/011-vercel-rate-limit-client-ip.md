# ADR 011 — Vercel istemci IP'si ve kimlik doğrulama hız sınırı

- Durum: Kabul edildi, 2026-11-15

## Karar

API, auth hız sınırını socket kaynak IP'sine göre kurar. BFF üzerinden gelen isteklerde bu adres Vercel çıkış adresidir ve kullanıcılar arasında paylaşılabilir. Vercel'in istek başlıkları belgesi, Vercel'in `X-Forwarded-For` değerini istemci IP'si olarak yeniden yazdığını ve sahteciliği önlemek için üst proxy'den gelen IP'yi aktarmadığını belirtir: [Vercel request headers](https://vercel.com/docs/headers/request-headers).

BFF yalnız Vercel'in aldığı `X-Forwarded-For` tek bir geçerli IP ise onu alır; tarayıcıdan gelen aynı adlı veya özel imza başlıklarını aktarmaz. BFF IP metnini ortak, rastgele 32+ karakterli gizli anahtarla HMAC-SHA256 imzalar ve `X-Mulk-Client-IP` ile küçük harf hex `X-Mulk-Client-IP-Signature` başlıklarında API'ye yollar. API imzayı sabit zamanlı karşılaştırmayla doğrular; eksik/geçersiz imza varsa yalnız gerçek socket IP'sini kullanır. `X-Forwarded-For` API'de rate limit anahtarı olarak güvenilmez. `Network:KnownProxies` yalnız gerçek nginx hop'u için forwarded headers işlevini sürdürür.

Anahtarın aynı bağımsız değeri Vercel `BACKEND_RATE_LIMIT_SIGNING_KEY` ve API `Network__RateLimitSigningKey` ortamlarına konur; `Pilot__AdminKey` ile paylaşılmaz. Production API anahtar eksik veya 32 karakterden kısaysa başlamaz. Anahtar değişimi iki ortamda uyumlu rollout gerektirir.

## Gerekçe

Mevcut forwarded-header yapılandırması spoofing'i önler, fakat yalnız `127.0.0.1` nginx proxy'sine güvenir. Nginx tarayıcı IP'sini değil, Vercel'den aldığı bağlantı adresini API'ye aktarır; bu nedenle IP başına 25/dakika limiter beta kullanıcılarının tamamına ortak kota uygular. API'de herkesten gelen `X-Forwarded-For`'u güvenilir yapmak spoofing açığı oluşturur. İmzalı BFF başlığı iki gereksinimi ayırır: istemci IP'sini edge'de almak ve API'de yalnız BFF'nin oluşturduğu değere güvenmek.

İmzalı IP yalnız kaba abuse/rate-limit bölümlemesidir; kimlik doğrulama veya yetkilendirme yerine geçmez. Taşıma TLS zorunludur. İmza replay'i yetki vermez; geçerli IP bölümündeki isteği artırmakla sınırlıdır.
