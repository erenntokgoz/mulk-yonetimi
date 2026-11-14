# Account Context Implementation Plan

> **For agentic workers:** Apply TDD and verify the SQL behavior.

**Goal:** Resolve a single active account from authenticated membership.

**Architecture:** Infrastructure queries Identity users, memberships and accounts; no client account ID is accepted.

**Tech Stack:** EF Core 10, SQL Server, xUnit.

**Spec:** `docs/superpowers/specs/2026-10-28-account-context-design.md`

## Task

- [x] Write a real SQL test covering two accounts, misleading claim, email verification, suspension and ambiguous membership; see expected compile failure.
- [x] Implement `AccountMembershipResolver.ResolveAsync(ClaimsPrincipal, CancellationToken)` and pass the test.
- [x] Run locked restore, Release build, unit and integration tests, and format checks.
- [x] Document the API wiring still required.
