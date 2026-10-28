# Auth Recovery Implementation Plan

**Goal:** E-posta doğrulamasını yeniden gönderme ve parola sıfırlama.

**Spec:** `docs/superpowers/specs/2026-10-28-auth-recovery-design.md`

- [x] Gerçek SQL testinde eksik uçları ve eski cookie açığını göster.
- [x] Identity token uçlarını, SMTP mesajını ve cookie security stamp kontrolünü uygula.
- [x] BFF yönlerini ve erişilebilir formları bağla.
- [x] Yerel API, SQL, frontend ve tarayıcı kapılarını çalıştır.
- [ ] GitHub CI'yi doğrula ve PR'ı birleştir.

**Sonraki dilim:** auth rate limiting ve kalıcı e-posta outbox'ı.
