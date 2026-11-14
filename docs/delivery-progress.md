# Delivery readiness progress

Branch: `codex/delivery-readiness`, based on `develop` on 2026-11-15. Baseline had one untracked owner file, `frontend/lint.txt`; preserve it.

The plan is `docs/superpowers/plans/2026-11-15-delivery-readiness.md`.

## Local checklist

- [ ] Pagination and complete selection lists
- [x] Unit archive (code, migration, API/BFF/UI; SQL acceptance pending)
- [x] Lease renewal (code, migration, API/BFF/UI; SQL acceptance pending)
- [ ] Configurable quota and pilot activation
- [x] Audit reason and correlation ID (code and targeted unit tests; SQL audit acceptance pending)
- [x] Cashflow and payment CSV (code and targeted unit tests; SQL acceptance pending)
- [ ] Expired auth tokens
- [ ] Component, real API E2E and visual regression tests
- [ ] Typed API client and CI contract/dependency gates
- [ ] Malware scanner and R2 acceptance harness
- [ ] Staging, restore, release and rollout docs
- [ ] First setup guidance
- [ ] Full verification and self-review

## External evidence

Production deployment, production restore and real R2 acceptance require credentials or operator access unavailable in this workspace. Record attempted local checks and keep these as open release gates.

## Verification log

- OpenAPI route contract: red exit 1 before unit archive/renewal/CSV routes, green exit 0 (4 selected tests including CSV cell cases).
- Correlation header: red 3/3 failed before middleware; green 3/3 passed, exit 0.
- `dotnet build backend/MulkYonetimi.slnx -c Release --no-restore`: exit 0, 0 warnings/errors after first backend/UI slices.
- `pnpm typecheck`: exit 0 after API type generation and frontend routes/forms. `frontend/next-env.d.ts` restored after generated typecheck.
- SQL integration test cannot run: Docker executable absent in PATH and standard Docker Desktop location, `MULK_SQL_TEST_ADMIN_CONNECTION` unset. Integration assertions were added, not marked passing.
