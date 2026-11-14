# Portföy API tasarımı

İlk dilim PORT-01 ve müstakil mülkün oluşturulma kuralını kapsar. Mülk adı ve tek satır adres zorunludur. İstemci oluştururken `SINGLE_UNIT` veya `MULTI_UNIT` seçer. `SINGLE_UNIT` için konut/ticari kullanım seçimi zorunludur ve varsayılan birim aynı SQL işleminde oluşur. Türün sonradan değiştirilmesi birim dönüşümü gerektirdiği için MVP'de sabittir.

Mülk listesi aktif kayıtlarla başlar, arşiv filtresini destekler ve sabit sıralamayla sayfalanır. Düzenleme ve arşivleme, önceki okumadan alınan SQL sürümünü ister. Eski sürüm 409, hesap dışı kimlik 404 döndürür. Tüm isteklerde hesap doğrulanmış üyelikten çözülür. Mutasyonlar mevcut auth Origin kontrolünü paylaşır. Arşivleme mülkü saklar ve birimleri silmez. Birim uçları eklendiğinde arşivli üst mülke yazmayı engellemelidir.

Oluşturma, güncelleme ve arşivleme aynı SQL işleminde aktör, eylem, kaynak kimliği ve UTC zamanı ile denetlenir. Denetim farkında kişisel alan değerleri saklanmaz. Birim listeleme ve ekleme, doluluk hesabı, kiracılar ve sözleşmeler ayrı dilimlerdir.

İkinci dilimde birimler üst mülkün altında sayfalanır. Arşivli veya tek birimli mülke yeni birim eklenemez. Ekleme sırasında üst mülk SQL işleminde kilitli okunur ve etiket tekilliğini SQL sağlar. Kapı numarası ve iki ondalığa kadar metrekare isteğe bağlıdır.

Kiracı kartları kişi ve şirket alanlarını ayrı doğrular. Arama ad, soyad, unvan, telefon ve e-postada yapılır. Düzenleme ve arşivleme SQL sürümü ister. Arşiv geçmişi saklar. Sözleşme dilimi arşivli birim ve kiracıları yeni sözleşmeye bağlamayı engellemelidir.

OpenAPI ve iş kuralı testleriyle birlikte her yeni uç için iki hesaplı gerçek SQL testi yazılır. SQL ortamı bulunmadığında entegrasyon testleri derlenir ve doğrulama durumu devir notunda tutulur.

Sözleşme ve finans mutasyonları hesap satırında SQL yazma kilidi alır. Sözleşme aktivasyonu birim ve kiracının arşiv durumunu işlem içinde kontrol eder. Etkin sözleşmenin bitişi açık sonlandırma tarihidir. Tarih aralıkları iki uçta da dahil kabul edilir. Kira bedeli değişikliği gelecek bir takvim ayının ilk gününden başlar. Üretilmiş dönemlerin bedeli ve tahsilatları korunur.

Depozito sözleşmedeki anlaşma tutarını kullanır. Muhafaza biçimi ve hareketler ayrı kaydedilir. İade veya eksi düzeltme bakiyeyi negatife düşüremez. Gider mülke ve isteğe bağlı olarak aynı mülkün birimine bağlanır. İptal geçmişi korur. Nakit raporu, tahsilatın ödeme tarihi ile giderin ödeme tarihini kullanır. Mülk/birim filtresinde yalnız o kapsama dağıtılan tahsilat tutarı yer alır. Dağıtılmamış kredi hesap düzeyinde gösterilir.
