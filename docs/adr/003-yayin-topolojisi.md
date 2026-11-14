# ADR 003 — Yayın topolojisi: Vercel + Ubuntu API + Azure SQL

- Durum: Kabul edildi
- Tarih: 2026-11-14

## Bağlam

Technical Design v1.1 tek bir sunucu/IIS yayınını varsayıyor. Pilot için elimizde paylaşılan bir Ubuntu 24.04 sunucusu var:
3.8 GB RAM, üzerinde kasam360 ve Mailu çalışıyor. SQL Server en az 2 GB bellek istiyor; aynı sunucuda çalışırsa mevcut
servisleri bellek yetersizliğine sürükleme riski yüksek.

## Karar

- **Frontend:** Next.js Vercel'de. Tarayıcı yalnız Vercel'le konuşur; API çağrıları sunucu tarafı BFF üzerinden gider.
- **API:** ASP.NET Core 10, Ubuntu sunucuda Docker container (`deploy/compose.api.yaml`), yalnız `127.0.0.1:5180`'e bağlı,
  önünde mevcut host nginx + certbot ile HTTPS. Bellek sınırı 512 MB.
- **Veritabanı:** Azure SQL Database ücretsiz teklif (West Europe). Firewall'da yalnız Ubuntu sunucunun IP'si açık.
  Migration'lar `deploy/sql/migrations-idempotent.sql` ile yönetici hesabıyla uygulanır; uygulama ayrı, DDL yetkisi olmayan
  bir kullanıcıyla bağlanır.
- **E-posta:** Aynı sunucudaki Mailu, `587` STARTTLS.
- **Belgeler:** R2 ve zararlı yazılım tarayıcısı bağlanana kadar kapalı (fail-closed).

## Sonuçlar

- Mevcut servisler etkilenmez; API sunucuda ~250 MB kullanır.
- Azure ücretsiz kotası aşılırsa veritabanı ay sonuna kadar duraklar; kota Azure panelinden izlenir, gerekirse ücretli
  devam seçeneği açılır.
- API ile veritabanı arasında ~40–60 ms gecikme olur; MVP için kabul edilebilir.
- Rate limit istemci IP'sine göre çalışır, ama Vercel BFF üzerinden gelen istekler Vercel'in çıkış IP'leriyle görünür.
  Pilot hacminde kabul edildi; gerçek istemci IP'sinin güvenli aktarımı yayın sonrası iş olarak kalır.
- Yedek: Azure SQL otomatik nokta-zamanlı geri yükleme (ücretsiz katmanda 7 gün).
