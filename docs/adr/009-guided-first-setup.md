# ADR 009: İlk kurulum rehberi

**Durum:** Kabul edildi, 2026-11-15.

PRD ilk kurulumda mülk, birim, kiracı ve sözleşme sırasını ister. MVP'de bu kayıtların gerçek formları zaten ilgili bölümlerde bulunur. Yeni form ve ayrı bir kayıt durumu oluşturmadan `/kurulum` ekranı bu dört adımı API'nin gerçek özet/liste verisiyle gösterir ve sıradaki mevcut forma yönlendirir. Böylece form doğrulaması, tenant kuralları ve para hesabı tek backend yolunda kalır. Veri alınamazsa adım tamamlandı varsayılmaz; hata gösterilir. Arşivli mülk/birim dashboard sayımına girmez. Bu rehber formu değiştirmez; kullanıcı işlemden sonra menüdeki İlk kurulum bağlantısına dönüp güncel durumu görür.
