# Registration Implementation Plan

**Goal:** E-posta doğrulamalı self servis hesap açma.

**Spec:** `docs/superpowers/specs/2026-10-28-registration-design.md`

- [x] Identity kullanıcı/hesap/OWNER ilişkisini ve SMTP teslim sınırını belirle.
- [x] Backend kayıt ve doğrulama uçlarını, BFF yönlerini ve erişilebilir formları uygula.
- [x] Gerçek SQL üzerinde kayıt → doğrulama → giriş akışını doğrula.
- [ ] Frontend ve backend kapılarını, ardından GitHub CI'yi doğrula.
- [ ] PR'ı `develop` dalına birleştir.

**Sonraki işler:** parola sıfırlama, doğrulama e-postası yeniden gönderimi ve e-posta outbox'ı.
