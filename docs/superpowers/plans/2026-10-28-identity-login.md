# Identity Login Implementation Plan

**Goal:** Doğrulanmış mevcut kullanıcının güvenli cookie oturumu açıp kapatması.

**Spec:** `docs/superpowers/specs/2026-10-28-identity-login-design.md`

- [x] Gerçek SQL üzerinde login/cookie, yanlış parola ve Origin negatif testini önce yaz; 404 başarısızlığını gör.
- [x] Backend Identity login/logout ve Origin sınırını uygula.
- [x] BFF Origin aktarımını ve erişilebilir `/giris` formunu bağla.
- [x] API, SQL integration, frontend lint/typecheck/unit/build/Playwright kapılarını çalıştır.
- [ ] CI sonucunu doğrula ve PR'ı `develop` dalına birleştir.

**Devam:** Self servis kayıt için e-posta doğrulama teslimi, hesap/üyelik transaction'ı, yeniden gönderim ve parola sıfırlama gerekir.
