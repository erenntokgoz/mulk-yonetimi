# Referans arayüz uyarlama tasarımı

## Kaynak ve karar

Kaynak: `vercel/nextjs-postgres-nextauth-tailwindcss-template` commit `fe026711c19ac3ee4589c86a738f59b84e611559` (MIT). PRD v1.1 ve Technical Design v1.1 bu görünümün desktop ve mobil davranışını şart koşar. Kullanıcı 28 Ekim'de mevcut frontend'i bu kaynağa taşıma önerisini kabul etti.

## Kapsam

- Kaynağın Tailwind v3 renk tokenları, 56 px sidebar'ı, header/breadcrumb ölçüleri, mobil Sheet menüsü ve Card/Button stili temel alınır.
- Çalışan sağlık kontrolü aynı API kontratıyla ana ekranda gösterilir. Yalnız çalışan rota gezinmeye eklenir.
- Next.js 16, Türkçe erişilebilir etiketler, klavye odağı ve mobil taşmasız görünüm korunur.
- Şablonun Auth.js, Postgres/Neon, Drizzle, seed, örnek ürün verisi ve işlevsiz kontrolleri alınmaz.
- Kaynak MIT lisansı frontend içinde korunur. Bir sonraki ürün ekranları aynı bileşen ve düzen üzerinde kurulur.

## Kabul

- Masaüstünde kaynak sidebar/header/breadcrumb ve bileşen stilinin geometri ve renk sistemi izlenebilir.
- Mobilde sidebar gizlenir, erişilebilir menü butonu Sheet açar ve ana sayfa yatay taşmaz.
- Healthy/Degraded/Unhealthy/bağlantı yok durumları ve yenileme davranışı çalışır.
- Lint, typecheck, unit, Playwright ve production build geçer.
