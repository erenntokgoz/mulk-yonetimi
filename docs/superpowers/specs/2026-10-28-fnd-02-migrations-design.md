# FND-02 Migration Tasarımı

## Amaç

EF Core 10 migration zincirini gerçek SQL Server üzerinde tekrarlanabilir biçimde çalıştırmak; geliştirme, staging ve production veritabanlarını güvenli yapılandırma ile ayırmak. Uygulama başlangıcı migration uygulamaz.

## Yaklaşımlar

1. **Boş başlangıç migration'ı (seçilen öneri):** Mevcut boş `ApplicationDbContext` için başlangıç migration'ı ve migration history oluşturulur. Gerçek SQL Server integration testi migration'ı uygular ve tekrar çalıştırır. Identity ve `Account` şeması FND-03'te eklenir. En küçük şema kararıyla migration yolunu kanıtlar; henüz ürün tablosu oluşturmaz.
2. **Hesap şemasını şimdi eklemek:** `Account` ve üyelik tabloları bu adımda açılır. Daha fazla ürün ilerlemesi sağlar, ancak FND-03 kimlik ve tenant modelini erken sabitler.
3. **Migration olmadan yalnız araç ve konfigürasyon:** Kurulumu kısaltır, fakat FND-02'nin gerçek SQL Server üzerinde migration kabul kriterini karşılamaz.

## Kapsam

- EF Core migration aracı proje içinde sürüm sabitlenerek çalıştırılır.
- Migration'lar `MulkYonetimi.Infrastructure` projesinde tutulur; API başlangıç projesi konfigürasyon sağlar.
- `Development`, `Staging` ve `Production` ortamları ayrı bağlantı dizesi alır. Secret veya gerçek bağlantı dizesi commit edilmez; eksik bağlantı açıkça hata verir.
- Lokal SQL Server üzerinde migration oluşturma, uygulama ve tekrar uygulama doğrulanır. Testin kendine ait geçici veritabanı kullanması tercih edilir; mevcut `MulkYonetimi` veritabanı silinmez.
- Production için idempotent SQL script üretilir ve kontrollü deployment adımı belgelenir. Başlangıçta `Database.Migrate()` çağrısı eklenmez.

## Sınırlar ve riskler

- Bu dilimde ürün tablosu yoktur; Identity ve tenant ilişkileri FND-03 ile gelir.
- Staging/production sunucuları henüz tanımlanmadığı için bu ortamlara migration uygulanmaz. Yerel test gerçek SQL Server üzerinde çalışır.
- SQL Server erişimi ve migration tekrarı integration testinde doğrulanır; yalnız EF InMemory testi yeterli sayılmaz.
