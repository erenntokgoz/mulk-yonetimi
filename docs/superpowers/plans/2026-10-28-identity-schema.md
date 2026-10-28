# Identity Schema Implementation Plan

> **For agentic workers:** Execute with TDD and verify against real SQL Server.

**Goal:** Add Identity users, accounts and membership relationships as the first FND-03 backend slice.

**Architecture:** Infrastructure owns Identity EF tables and account membership. The API still has no auth endpoints; migration deployment stays explicit.

**Tech Stack:** ASP.NET Core Identity 10, EF Core 10, SQL Server, xUnit.

**Spec:** `docs/superpowers/specs/2026-10-28-identity-schema-design.md`

## Task 1: SQL test and schema

- [x] Add a real SQL migration test that fails before entities exist.
- [x] Add Identity user, Account and AccountMember with database keys and FKs.
- [x] Generate EF migration and pass the real SQL test.

## Task 2: Repeatable verification

- [x] Run the separate integration project against provisioned test SQL in CI.
- [x] Apply migration to the existing local development database without deleting data.
- [x] Run locked restore, Release build, unit/integration tests and format; document results.
