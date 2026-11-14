# Me Endpoint Implementation Plan

> **For agentic workers:** Apply TDD and verify with real SQL Server.

**Goal:** Expose authenticated account context through `/api/v1/me`.

**Architecture:** Identity cookie authenticates the principal; the existing membership resolver authorizes the account on every request.

**Tech Stack:** ASP.NET Core 10 Identity, EF Core 10, SQL Server, xUnit.

**Spec:** `docs/superpowers/specs/2026-10-28-me-endpoint-design.md`

## Task

- [x] Write failing anonymous `/me` test and confirm 404 before implementation.
- [x] Configure Identity cookie auth and `/me` with 401/403 behavior.
- [x] Verify real cookie 200 and suspended membership 403 against SQL Server.
- [x] Run locked restore, build, unit/integration tests and format locally; check CI on the PR.
- [x] Document cookie boundary and remaining auth work.
