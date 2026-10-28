# Mülk Yönetimi Temel Tasarımı

## Amaç

Frontend ve backend'i bağımsız geliştirilebilir ve dağıtılabilir tutan, fakat tek repository ve tek ürün kontratıyla yönetilen üretim temeli kurmak.

## Yaklaşım

Seçilen yaklaşım monorepo içinde iki uygulamadır:

- `frontend/`: Next.js 16 App Router uygulaması.
- `backend/`: ASP.NET Core 10 çözümü ve testleri.
- Kök: Docker Compose, ortak ortam örnekleri, CI ve proje dokümantasyonu.

Ayrı repository yaklaşımı ilk aşamada reddedildi; kontrat ve CI koordinasyon maliyetini artırır. Tek uygulama yaklaşımı da reddedildi; .NET iş kuralları ile Next.js sunum/BFF sınırını bulanıklaştırır.

## Sorumluluklar

Frontend ajanı yalnız `frontend/`, backend ajanı yalnız `backend/` altında çalışır. Ana ajan kök altyapıyı hazırlar ve sonuçları entegre eder. İlk paralel dilimde ajanlar ortak dosya düzenlemez.

## İlk dilimin hedefleri

- Her iki uygulamanın yerel olarak başlatılabilmesi.
- Backend health endpoint'inin gerçek SQL Server bağımlılığını raporlaması.
- Frontend'in backend base URL sözleşmesini kullanması ve basit sağlık durumunu gösterebilmesi.
- Kök Docker Compose ile SQL Server'ın tekrar üretilebilir biçimde çalışması.
- Secret içermeyen `.env.example` dosyaları ve başlangıç dokümantasyonu.
- Her iki uygulama için lint/build/test doğrulaması.

## İlk dilimin kapsam dışı işleri

- Ürün CRUD ekranları.
- Identity/BFF oturum uygulaması.
- Cloudflare R2 entegrasyonu.
- Domain varlıkları ve migration'ları.
- Git remote, push veya deployment.

## Kısıtlar

- Repo henüz kullanıcı tarafından oluşturulmadı; commit/push yapılmayacak.
- Varsayılan değerler production secret'ı gibi kullanılmayacak.
- Frontend backend'in veritabanına erişmeyecek.
- Framework şablonlarındaki demo veri ve auth çözümleri ürün davranışı kabul edilmeyecek.

## Başarı ölçütü

Temiz bir makinede dokümante edilmiş komutlarla SQL Server, backend ve frontend başlatılabilir; health akışı görülebilir; test, lint ve build kontrolleri geçer.
