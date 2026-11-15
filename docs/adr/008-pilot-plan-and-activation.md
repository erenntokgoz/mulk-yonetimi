# ADR 008: Pilot planı, kota ve hesap onayı

**Durum:** Kabul edildi, 2026-11-15.

Backlog SAAS-01/02 yeni hesabın PENDING açılmasını ve kota aşımında mevcut verinin okunmasını ister. PRD birim sınırının sayısal değerini belirlemez. Bu yüzden sınır kodda sabitlenmez: `Pilot__DefaultUnitLimit` pozitif sayıysa yeni hesapta `UNIT_LIMIT` hakkına yazılır; yoksa pilotun varsayılanı **sınırsızdır**. Mevcut hesaplara migration sırasında plan veya kota atanmaz; erişimleri değişmez. Arşivli birim veya arşivli mülkün birimi kullanım sayısına girmez. Kota kontrolü hesap satırı kilidi altında yapılır; aşımda yeni birim veya varsayılan birimli mülk 409 döner, okumalar sürer.

Yeni hesap e-posta doğrulansa da PENDING kalır. Etkinleştirme yalnız API'de oturum açmış, sunucu yapılandırmasındaki `Pilot__AdminUserId` ile eşleşen mevcut operatör ve sunucuda saklanan en az 32 karakterli `Pilot__AdminKey` ile yapılır. Bu kimlik ve anahtar frontend'e verilmez. Operatör API'ye HTTPS üzerinden `Origin`, oturum çerezi ve `X-Pilot-Admin-Key` ile doğrudan başvurur. Onay, doğrulanmış hesap sahibini gerektirir ve actor/UTC/correlation ile audit kaydı üretir. Kurulumda operatör kimliği veya anahtar yoksa aktivasyon 403 ile kapalı kalır.

Bu, kullanıcıya hesap onayı beklediğini giriş ekranında 423 ile açıklar. Üretim dağıtımında operatör kimliği, anahtar, kota ve güvenli aktivasyon komutu runbook'ta doğrulanmadan pilot kullanıcı davet edilmez.
