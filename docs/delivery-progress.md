# Delivery readiness progress

Branch: `codex/delivery-readiness`, based on `develop` on 2026-11-15. Baseline had one untracked owner file, `frontend/lint.txt`; preserve it.

The plan is `docs/superpowers/plans/2026-11-15-delivery-readiness.md`.

## Local checklist

- [x] Pagination and complete selection lists (user-triggered next-page controls; browser regression for 101/26 records)
- [x] Unit archive (code, migration, API/BFF/UI; SQL acceptance pending)
- [x] Lease renewal (code, migration, API/BFF/UI; SQL acceptance pending)
- [x] Configurable quota and pilot activation (code, migration, API test; SQL acceptance pending)
- [x] Audit reason and correlation ID (code and targeted unit tests; SQL audit acceptance pending)
- [x] Cashflow and payment CSV (code and targeted unit tests; SQL acceptance pending)
- [ ] Expired auth tokens (deterministic SQL integration assertions compile; execution pending)
- [ ] Component, real API E2E and visual regression tests
- [x] Typed server API client and CI contract/dependency gates (local type/build checks; CI run pending)
- [x] Malware scanner and R2 acceptance harness (ClamAV protocol tests done; real R2 pending)
- [x] Staging, restore, release and rollout docs (operational acceptance still open)
- [x] First setup guidance (real API state and existing forms)
- [ ] Full verification and self-review

## External evidence

Production deployment, production restore and real R2 acceptance require credentials or operator access unavailable in this workspace. Record attempted local checks and keep these as open release gates.

## Verification log

- OpenAPI route contract: red exit 1 before unit archive/renewal/CSV routes, green exit 0 (4 selected tests including CSV cell cases).
- Correlation header: red 3/3 failed before middleware; green 3/3 passed, exit 0.
- `dotnet build backend/MulkYonetimi.slnx -c Release --no-restore`: exit 0, 0 warnings/errors after first backend/UI slices.
- `pnpm typecheck`: exit 0 after API type generation and frontend routes/forms. `frontend/next-env.d.ts` restored after generated typecheck.
- SQL integration test cannot run: Docker executable absent in PATH and standard Docker Desktop location, `MULK_SQL_TEST_ADMIN_CONNECTION` unset. Integration assertions were added, not marked passing.
- SAAS OpenAPI route: red exit 1 before activation endpoint, green 1/1 exit 0 after code. Pending registration and quota SQL assertions added; not run.
- ClamAV protocol: red compile exit 1 before adapter, then 4/4 clean/infected/error/disconnected tests pass, exit 0. Integration test project builds exit 0, 0 warnings/errors; database tests not run.
- Expired confirmation/reset token assertions use a negative token lifetime in the real provider and compile in SQL integration project. Their API result is unverified until SQL is available.
- `pnpm api:types` and `pnpm typecheck`: exit 0 after pilot endpoint; generated types updated, `next-env.d.ts` restored.
- Pagination/404: targeted `pnpm build` exit 0, 4 Playwright tests passed (property #101, notification #26, tenant picker #101, unauthenticated unknown route 404). Unknown route test first failed at received 200, then passed after proxy guard narrowed to known sections and Turkish 404 page. Targeted ESLint exit 0. Full browser suite remains pending.
- Initial setup: Playwright test failed before route existed, then `pnpm build` exit 0 and 2/2 targeted tests passed; first empty state and real form progression checked. The typed server client compiles against generated OpenAPI GET paths/responses. CI schema regeneration and Dependabot files added but workflow has not run.
- Operations: `docs/release-readiness.md` defines isolated staging, an operator-accepted RPO/RTO proposal, Azure PITR restore rehearsal, smoke/rollback and explicit no-go gates. ADR 010 records account-lock financial concurrency. Existing local backup/restore evidence dates to 2026-11-13; Docker/SQL is absent now and Azure PITR is untested.
- R2: `R2AcceptanceTests` builds and is explicitly **SKIP 1/1** with exit 0 because R2 credentials are absent. It is an executable real-bucket acceptance path, not a passed R2 acceptance result. CORS check additionally requires two explicit origins.
