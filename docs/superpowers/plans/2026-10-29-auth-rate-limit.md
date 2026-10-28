# Auth Rate Limit Implementation Plan

**Goal:** Auth POST uçlarında aşırı isteği 429 ile sınırlandırmak.

**Spec:** `docs/superpowers/specs/2026-10-29-auth-rate-limit-design.md`

- [x] Gerçek SQL entegrasyon testinde 40 isteğin sınırsız kaldığını göster.
- [x] ASP.NET Core policy'yi yedi auth ucuna bağla.
- [x] Frontend 429 metnini ekle ve yerel kapıları çalıştır.
- [ ] GitHub CI'yi doğrula, PR'ı birleştir.
