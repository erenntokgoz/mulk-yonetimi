# FND-03 Auth Spike Implementation Plan

> **For agentic workers:** Use test-driven-development and verify each behavior before completion.

**Goal:** Prove BFF cookie forwarding and cross-origin mutation rejection with real HTTP servers.

**Architecture:** A narrow Next route handler forwards only fixed auth paths to the configured backend. Playwright uses a separate fixture server to exercise cookie and Origin handling.

**Tech Stack:** Next.js 16, TypeScript, Playwright, Node HTTP fixture.

**Spec:** `docs/superpowers/specs/2026-10-28-fnd-03-auth-spike-design.md`

## Task 1: Failing browser tests

- [x] Add fixture login, logout and `/api/v1/me` endpoints with an HttpOnly cookie.
- [x] Show test failure for login Set-Cookie forwarding, authenticated `/me`, and rejected foreign Origin.

## Task 2: Narrow BFF routes

- [x] Implement fixed BFF routes with configured frontend origin and backend URL.
- [x] Reject missing/foreign Origin on POST; forward Cookie and Set-Cookie without leaking response headers.
- [x] Return controlled 502 on upstream failure.

## Task 3: Verification

- [x] Run frontend lint, typecheck, unit tests, production build and Playwright tests.
- [x] Document spike result and remaining backend Identity/antiforgery work.
