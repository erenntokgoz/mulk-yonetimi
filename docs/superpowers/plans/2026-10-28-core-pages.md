# Temel Ürün Sayfaları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PRD ana bölümlerini gezilebilir, erişilebilir ve kullanılabilirlik durumunu doğru ifade eden sayfalara dönüştürmek.

**Architecture:** Ortak rota tanımı hem masaüstü hem mobil menüye kaynak olur. Dinamik App Router sayfası yalnız tanımlı bölümleri render eder; veri API'si yokken sayfalar kayıt yok mesajı, sahte veri veya sahte eylem üretmez.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-core-pages-design.md`

## Global Constraints

- Türkçe, sade ve profesyonel metin; karşılama/dolgu cümlesi yok.
- Sahte veri, işlem düğmesi ve finansal toplam yok.
- Kullanıcının `frontend/next-env.d.ts` değişikliği korunur.

## Review Focus

- Bilinmeyen rota 404 verir.
- Aktif gezinme bağlantısı erişilebilir biçimde işaretlenir.
- Mobil menü açılır ve seçilen sayfaya gider.
- Dar ekranda yatay taşma olmaz.
- Genel bakışta yasaklanan karşılama metni kalmaz.

## Tasks

### Task 1: Metin standardı ve sayfa rotaları

**Files:** `AGENTS.md`, `frontend/lib/navigation.ts`, `frontend/app/[section]/page.tsx`, `frontend/components/unavailable-section.tsx`, `frontend/tests/browser/page.spec.ts`

- [ ] Playwright'da rota, 404 ve metin kabul testini yaz; başarısızlığını gör.
- [ ] Rota tanımını ve ortak kullanılamayan bölüm bileşenini uygula.
- [ ] Hedef testleri geçir.

### Task 2: Gezintiyi bütün ekranlara bağla

**Files:** `frontend/components/dashboard-shell.tsx`, `frontend/components/mobile-menu.tsx`, `frontend/tests/browser/page.spec.ts`

- [ ] Masaüstü/mobil gezinme ve aktif rota testini yaz; başarısızlığını gör.
- [ ] İki menüyü ortak tanımdan render et; odak ve dokunma hedeflerini koru.
- [ ] Browser testlerini geçir.

### Task 3: Kapılar ve teslim

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:browser` çalıştır.
- [ ] Diff ve GitHub CI kontrolünden sonra PR'ı `develop` ile birleştir.
