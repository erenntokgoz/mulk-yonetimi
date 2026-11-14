# Delivery Readiness Implementation Plan

> **For agentic workers:** Execute each slice with a failing test, minimal implementation, passing targeted test, and a focused commit.

**Goal:** Close the locally actionable MVP audit gaps and leave external deployment dependencies explicit.

**Architecture:** Extend the existing ASP.NET Core endpoints, EF Core model and Next.js BFF/components. Keep all tenant, money and authorization rules in the API. Use the current SQL Server integration harness and generated OpenAPI types.

**Tech Stack:** .NET 10, EF Core 10, SQL Server, Next.js 16, TypeScript, Playwright.

**Spec:** PRD v1.1, Technical Design v1.1, Backlog v1.1, `docs/requirements-audit.md`, `AGENTS.md`.

## Global constraints

- Preserve user files and `frontend/next-env.d.ts`; no push, merge or deploy.
- No secrets or personal data in logs or commits. Financial history is append/void only.
- New behavior requires a failing test first. Run each targeted check after implementation; run broad suites once at the end.
- Record conflicts as ADRs, and record blocked external acceptance separately from local code.

## Tasks

- [ ] 1. Fix list pagination and selection completeness. Test results beyond page one, then add accessible paging or bounded fetch controls.
- [ ] 2. Add unit archive, lease renewal and audit correlation/reason. Start with API and SQL tests, then migration, BFF and UI.
- [ ] 3. Add configurable plan quota and pending pilot activation with authorization and audit tests.
- [ ] 4. Add safe CSV exports preserving filters and covering formula injection.
- [ ] 5. Add auth expiry tests, component tests, real API E2E, visual snapshots, typed client and CI contract gate.
- [ ] 6. Add fail-closed malware scanner, R2 acceptance harness and deploy configuration.
- [ ] 7. Complete onboarding guidance and operational docs, ADRs and release criteria.
- [ ] 8. Run unit, SQL integration, frontend lint/typecheck/component/build/Playwright checks; self-review and focused commits; produce `.superpowers/delivery-review.diff`.

## Review focus

- Two tenants using each other's IDs must get no data or side effects.
- Concurrent renewal, archive and quota writes must preserve invariants.
- A partial or overpaid historical period must retain its original rate and audit trail.
- Invalid correlation headers and malicious CSV cells must not reach logs or spreadsheets unsafely.
- External R2 and production restore evidence must remain unclaimed when credentials or access are unavailable.
