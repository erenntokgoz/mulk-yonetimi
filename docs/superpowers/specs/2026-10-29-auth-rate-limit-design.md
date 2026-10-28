# Auth istek sınırı

Tüm auth POST uçları aynı istemci IP'si için dakikada 25 istekle sınırlanır. Sınır aşımı 429 ve `Retry-After: 60` döner; frontend kısa Türkçe hata gösterir. Uygulama içinde ASP.NET Core RateLimiter kullanılır, ek paket gerekmez.

IP, doğrudan bağlantıdaki `RemoteIpAddress` değeridir. Ters proxy arkasında gerçek istemci IP'sinin yalnız güvenilen proxy üzerinden iletilmesi deployment sorumluluğudur; bu yapılandırma yapılmazsa kullanıcılar ortak limit paylaşır. Tek instance içi sayaçtır; çoklu instance için dağıtık sınır ayrıca gerekir. Kalıcı e-posta outbox'ı bu dilimin dışında kalır.
