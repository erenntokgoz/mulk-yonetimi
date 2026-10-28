# Temel ürün sayfaları tasarımı

## Amaç ve kapsam

PRD'deki mülk sahibinin ana çalışma alanı için anlaşılır gezinme ve kullanılamayan bölüm durumları kurulur. Bugünkü backend yalnız kimlik/üyelik ve sağlık uçları sunduğu için ürün verisi veya mutasyon varmış gibi gösterilmez. Mevcut sistem durumu kartı şimdilik genel bakışta kalır; veri API'si geldiğinde gerçek dashboard ile değiştirilir.

## Yaklaşım

Her sayfaya ayrı tekrar eden JSX yazmak yerine merkezi bir sayfa tanımı ve ortak kullanılamayan bölüm bileşeni kullanılır. Masaüstünde metinli, mobilde Sheet içindeki aynı gezinme listesi sunulur. Next App Router tek segmentli rotaları önceden üretir; bilinmeyen segment 404 olur. Detay ve oluşturma ekranları ilgili API dilimlerinde ele alınır.

## Metin ve etkileşim

Kısa Türkçe başlıklar kullanılır; karşılama ve pazarlama metni yoktur. Veri API'si olmayan bölümde kayıt yokmuş gibi davranılmaz; bölümün kullanıma açık olmadığı belirtilir. Çalışmayan CRUD düğmesi, sahte kayıt, sahte toplam veya örnek bildirim bulunmaz. Aktif rota `aria-current`, ana içerik skip link ve mobil menü klavye ile çalışır.

## Değerlendirilen seçenekler

- Her ekranı ayrı bileşenle kurmak: ürün akışları hazırken doğru, bugün tekrarlı ve yanıltıcı içerik üretir.
- Ortak sayfa tanımı ve kullanılamayan bölüm durumu: mevcut API sınırına uygun, bütün ana rotaları gezilebilir kılar. Bu dilim için seçildi.
