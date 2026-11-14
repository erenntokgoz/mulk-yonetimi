# ADR 006 — Özel belge depolama ve yaşam döngüsü

- Durum: Kısmen uygulanmış
- Tarih: 14 Kasım 2026

## Karar

- Dosya byte'ları SQL Server'a konmaz. Cloudflare R2'nin S3 uyumlu endpoint'i AWS SDK for .NET ile imzalanır.
- Bucket private kalır. Tarayıcıya en çok 120 saniyelik PUT ve 60 saniyelik GET presigned URL verilir. URL'ler bearer token kabul edilir; API loguna yazılmaz.
- Upload intent hesap kapsamı, tam bir entity bağı ve allowlist MIME/boyut denetiminden geçer. Complete, object metadata ve PDF/JPEG/PNG magic bytes denetler; etkinleştirmeden önce AV tarayıcısından `Clean` sonucu gerekir.
- Upload anahtarı geçici, etkin dosya anahtarı ayrı ve rastgele olur. Complete, dosyayı yeni anahtara kopyalayıp DB durumunu `ACTIVE` yapar; eski PUT URL etkin dosyanın içeriğini değiştiremez.
- Silme soft delete'tir. Tarayıcıya verilen PUT URL'si sona erene kadar geçici nesne temizlik için bekler; etkin nesne silme çağrısında kaldırılır. Süresi dolan pending/soft-delete yüklemeleri ve başarısız temizlikler 15 dakikalık worker tarafından tekrar denenir.
- Tam R2 konfigürasyonu yoksa yazma/indirme işlemleri HTTP 503 döndürür; yerel sahte provider başarı sonucu üretmez.
- AV tarayıcı adaptörü yoksa varsayılan tarama sonucu `Unavailable` olur; complete HTTP 503 ile kapanır. Tehdit sonucu HTTP 422 döndürür ve belgeyi etkinleştirmez. Tarayıcı yokken dosya türü imzası temiz tarama yerine kullanılmaz.

## Açık güvenlik kararı

PRD ve teknik tasarım yüklemeden önce zararlı dosya taraması ister, fakat depoda AV sağlayıcısı, çalışma ortamı veya tarayıcı seçimi yoktur. İmzalı metadata kontrolü virüs taramasının yerini tutmaz. Mevcut varsayılan tarama adaptörü `Unavailable` döndürür ve API belgeyi etkinleştirmez. AV sağlayıcısı seçilip doğrulanana kadar bu özellik üretime hazır sayılmaz. Gerçek R2 bucket/credential ve bucket CORS ayarı da sağlayıcı kabul testi için gereklidir.
