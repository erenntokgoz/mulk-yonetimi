# ADR 001 — Finans şeması

**Kabul edildi · 13 Kasım 2026**

Teknik Tasarım v1.1, para için `decimal(19,4)` ve kira alacağı için `(LeaseId, PeriodYear, PeriodMonth, ChargeType)` önerir. Bu hükümler proje çalışma kurallarıyla çelişir.

AGENTS.md ve PRD v1.1 esas alınır. Para alanları SQL Server'da `decimal(19,2)`, iş tarihleri .NET'te `DateOnly` ve SQL Server'da `date` olarak tutulur. Olay zamanları UTC'dir. Aylık kira alacağı için benzersiz anahtar `(AccountId, LeaseId, PeriodStart)` olur. Finansal kayıtlar void veya açık düzeltmeyle güncellenir.

Finans migration'ları bu hassasiyeti ve anahtarı uygulamalı. Aynı dönem için eşzamanlı üretimde tek alacak kalması gerçek SQL Server'da doğrulanmalı.

Portföy dilimi finans şeması eklemiyor; kurallar [ADR 007](007-portfoy-sozlesme-ve-finans-kurallari.md) içindedir.
