# FND-02 Migrations Implementation Plan

> **For agentic workers:** Execute each task and record real verification results.

**Goal:** Prove controlled EF Core migrations against SQL Server with separate environment configuration.

**Architecture:** Infrastructure owns migrations. API provides runtime connection configuration. A local .NET tool manifest pins EF CLI; application startup never applies migrations.

**Tech Stack:** .NET 10, EF Core 10.0.14, SQL Server 2022.

**Spec:** `docs/superpowers/specs/2026-10-28-fnd-02-migrations-design.md`

## Constraints

- Keep database credentials in environment variables only.
- Do not delete or reset the existing `MulkYonetimi` database.
- Do not add product or Identity tables in this task.

## Task 1: Tool and baseline migration

- [x] Pin `dotnet-ef` 10.0.14 in a local tool manifest and add EF design dependency.
- [x] Generate initial migration in Infrastructure and include its snapshot in this change.
- [x] Build and verify migration list without database credentials.

## Task 2: Environment and deployment contract

- [x] Document Development, Staging and Production connection settings and secret boundary.
- [x] Document explicit migration script generation and controlled apply procedure.
- [x] Verify generated idempotent SQL contains migration history handling.

## Task 3: Real SQL verification

- [x] Apply migration to the existing local development database without destructive operations.
- [x] Apply it a second time and verify no duplicate history entry.
- [x] Run locked restore, Release build and tests; report GitHub CI separately.
