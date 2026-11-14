# Video referansına göre yönetim arayüzü

## Amaç

Mülk Yönetimi ekranlarını kullanıcının verdiği 6 saniyelik Admin Dashboard videosunun görsel düzenine yaklaştırmak. Video bir e-ticaret paneli gösterdiği için örnek mağaza alanları mülk kavramlarıyla eşleştirilir; uygulama işlevleri ve mevcut API akışları korunur.

## Seçilen yaklaşım

1. Videonun tam kopyası: satış grafikleri, hedef kartları ve Orders kanbanını mülk ekranlarına kopyalamak. Bu, mevcut API'de olmayan metrikler ve iş akışları uydurmayı gerektirir; seçilmedi.
2. Mevcut veriye dayalı uyarlama (seçilen): dar ve sabit sol gezinme, üst sayfa/hesap çubuğu, koyu paneller, mavi vurgular, yoğun liste ve kart düzeni ile mevcut bölümlerde başlık hiyerarşisi. Var olan kayıtlar kendi API'sinden gelir; desteklenmeyen analitik/finansal özetler eklenmez.

## Kapsam ve kurallar

- Açık ve koyu tema desteği sunulur; tema seçimi saklanır.
- Tüm mevcut bölümlerde ortak kabuk ve tutarlı görsel dil uygulanır.
- Ana sayfa yalnız mevcut sistem sağlık verisini sunar; sahte mülk sayısı, kira toplamı, hedef veya grafik çizmez.
- Portföy, kiracı, sözleşme ve tahsilat içerikleri mevcut API ve iş kurallarını korur.
- Önceki tercihe uygun olarak videodaki büyük renkli daire arka planları kullanılmaz.
- Geçiş ve kart giriş animasyonları eklenir; azaltılmış hareket tercihi korunur.
- Mobil gezinme, formlar, tablolar ve kartlar yatay taşma oluşturmaz.
- Değişiklikler `frontend/` altında kalır; API sözleşmesi ve backend değişmez.

## Kabul

Açık/koyu görünüm tüm mevcut ekranlarda tutarlı; bölümlerde yalnız API'de olan kayıt ve işlemler görünür; klavye, azaltılmış hareket ve mobil düzen korunur.
