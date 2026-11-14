# Video referanslı arayüz uygulama planı

**Hedef:** Mülk Yönetimi ekranlarında açık/koyu tema, videoyla uyumlu ortak yönetim paneli düzeni ve kısa geçiş animasyonları.

**Sınırlar:** `frontend/` içinde kal. API ve mevcut gerçek kayıt akışlarını değiştirme. API'de olmayan rapor/metrik üretme. Büyük daire arka planı ekleme.

## Adımlar

- [x] Tema seçimini test et: açık/koyu değiştir ve yenileme sonrası koru.
- [x] Ortak CSS değişkenleriyle açık ve koyu paleti tüm sayfalara uygula.
- [x] Kabuğa erişilebilir tema anahtarı ekle; renkleri semantik paletten kullan.
- [x] Kart/bağlantı/eylem geçişlerini ekle ve azaltılmış hareketi koru.
- [x] Sağlık, kimlik, portföy, kiracı, sözleşme ve finans BFF senaryolarını doğrula.
- [x] Lint, typecheck, birim test, production build ve tarayıcı paketini çalıştır.

## Not

Tarayıcı uçtan uca testleri backend yerine bellek fixture'ı kullanır; gerçek SQL Server/tenant entegrasyonu kanıtı değildir.
