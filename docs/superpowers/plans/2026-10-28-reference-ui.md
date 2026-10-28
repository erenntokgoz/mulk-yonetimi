# Referans Arayüz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sağlık ekranını Vercel admin şablonunun onaylanan görünümüne taşımak.

**Architecture:** Kaynak commit'ten yalnız görsel temel ve gerekli UI bileşenleri alınır. Next.js 16 uygulaması ve backend health istemcisi korunur. Postgres/Auth.js kodu alınmaz.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 3, Radix Sheet/Tooltip, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-reference-ui-design.md`

## Global Constraints

- Sabit kaynak commit `fe026711c19ac3ee4589c86a738f59b84e611559` ve MIT lisansı korunur.
- SQL, auth ve veri modeli yalnız .NET backend sorumluluğundadır.
- İşlevsiz demo butonları veya `#` bağlantıları bırakılmaz.
- Git repository henüz kullanıcı tarafından oluşturulmadığı için commit/push yapılmaz.

## Review Focus

- Mobil Sheet klavyeyle açılır ve kapanır; dialog başlığı okunur.
- Skip link ana içeriğe odaklanır.
- Health başarısızlığında teknik environment/secret bilgisi görünmez.
- Yenileme güncel backend durumunu gösterir.
- Desktop ve mobil yatay taşma yoktur.

---

### Task 1: Referans görünüm ve bileşen temeli

**Files:** `frontend/app/globals.css`, `frontend/tailwind.config.ts`, `frontend/postcss.config.cjs`, `frontend/components/ui/{button,card,sheet,tooltip,breadcrumb}.tsx`, `frontend/lib/utils.ts`, `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/LICENSE.reference.md`.

- [x] Kaynak commit'teki gerekli görsel dosyaları incele; sadece gerekenleri taşı.
- [x] Tailwind ve UI bağımlılıklarını sabitle, kilit dosyasını güncelle.
- [x] `pnpm lint` ve `pnpm typecheck` çalıştır.

### Task 2: Sağlık ekranını referans düzenine taşı

**Files:** `frontend/app/page.tsx`, `frontend/components/dashboard-shell.tsx`, `frontend/tests/browser/page.spec.ts`.

- [x] Önce mobil menü, navigasyon ve mevcut sağlık durumları için başarısız Playwright kontrolleri yaz.
- [x] Kaynak sidebar/header/breadcrumb/mobil Sheet düzenini uygula.
- [x] Sağlık kartını kaynak Card/Button stiline taşı; güvenli hata metinlerini koru.
- [x] Playwright kontrollerini geçir; desktop ve mobil ekran görüntüsünü incele.

### Task 3: Son doğrulama ve kaynak kaydı

**Files:** `frontend/README.md`, `docs/superpowers/plans/2026-10-28-reference-ui.md`.

- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:browser`, `pnpm build` çalıştır.
- [x] Referans commit, lisans, geçici kapsam ve gerçek doğrulama sonuçlarını README'de belirt.
