using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class DepositEndpoints
{
    public static void MapDepositEndpoints(this WebApplication app)
    {
        var group = app.MapPortfolioGroup("/api/v1/deposits");
        group.MapGet("", ListAsync).WithName("ListDeposits").Produces<DepositPage>().ProducesValidationProblem();
        group.MapGet("/{id:guid}/movements", MovementsAsync).WithName("ListDepositMovements")
            .Produces<DepositMovementPage>().ProducesValidationProblem().ProducesProblem(404);
        group.MapPost("", CreateAsync).WithName("CreateDeposit").Produces<DepositResponse>(201)
            .Produces<DepositResponse>().ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        group.MapPost("/{id:guid}/movements", AddMovementAsync).WithName("AddDepositMovement")
            .Produces<DepositMovementResponse>(201).Produces<DepositMovementResponse>()
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
    }

    private static async Task<IResult> ListAsync(Guid? leaseId, int? page, int? pageSize, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var current = page ?? 1;
        var size = pageSize ?? 25;
        if (ValidatePage(current, size) is { } invalid) return invalid;
        var rows = await (from deposit in db.SecurityDeposits
                          join lease in db.Leases on new { deposit.AccountId, Id = deposit.LeaseId }
                              equals new { lease.AccountId, lease.Id }
                          where deposit.AccountId == accountId && (leaseId == null || deposit.LeaseId == leaseId)
                          orderby deposit.Id
                          select new DepositResponse(deposit.Id, lease.Id, lease.DepositAmount, deposit.CustodyType, deposit.Note,
                              db.DepositMovements.Where(item => item.AccountId == accountId && item.DepositId == deposit.Id)
                                  .Sum(item => (decimal?)item.Amount) ?? 0))
            .Skip((current - 1) * size).Take(size + 1).ToArrayAsync(ct);
        return Results.Ok(new DepositPage(rows.Take(size).ToArray(), current, size, rows.Length > size));
    }

    private static async Task<IResult> MovementsAsync(Guid id, int? page, int? pageSize, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (!await db.SecurityDeposits.AnyAsync(item => item.AccountId == accountId && item.Id == id, ct))
            return Results.NotFound();
        var current = page ?? 1;
        var size = pageSize ?? 25;
        if (ValidatePage(current, size) is { } invalid) return invalid;
        var rows = await db.DepositMovements.AsNoTracking().Where(item => item.AccountId == accountId && item.DepositId == id)
            .OrderByDescending(item => item.MovementOn).ThenBy(item => item.Id)
            .Skip((current - 1) * size).Take(size + 1).ToArrayAsync(ct);
        return Results.Ok(new DepositMovementPage(rows.Take(size).Select(ToResponse).ToArray(), current, size, rows.Length > size));
    }

    private static async Task<IResult> CreateAsync(CreateDepositRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (input.CustodyType is null) return Invalid("custodyType", "Muhafaza biçimini seçin.");
        var note = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
        if (note?.Length > 500) return Invalid("note", "Not en çok 500 karakter olmalıdır.");
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var lease = await db.Leases.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == input.LeaseId, ct);
        if (lease is null) return Results.NotFound();
        if (lease.DepositAmount <= 0) return Conflict("Sözleşmede pozitif bir teminat tutarı olmalıdır.");
        var existing = await db.SecurityDeposits.SingleOrDefaultAsync(item =>
            item.AccountId == accountId && item.LeaseId == lease.Id, ct);
        if (existing is not null)
        {
            if (existing.CustodyType != input.CustodyType || existing.Note != note)
                return Conflict("Sözleşmenin teminat kaydı mevcut.");
            return Results.Ok(new DepositResponse(existing.Id, lease.Id, lease.DepositAmount, existing.CustodyType,
                existing.Note, await BalanceAsync(db, accountId, existing.Id, ct)));
        }
        var deposit = new SecurityDeposit
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            LeaseId = lease.Id,
            CustodyType = input.CustodyType.Value,
            Note = note
        };
        db.SecurityDeposits.Add(deposit);
        AddAudit(db, principal, accountId, deposit.Id, "DEPOSIT", "CREATED");
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Created("/api/v1/deposits?leaseId=" + lease.Id,
            new DepositResponse(deposit.Id, lease.Id, lease.DepositAmount, deposit.CustodyType, note, 0));
    }

    private static async Task<IResult> AddMovementAsync(Guid id, AddDepositMovementRequest input,
        [FromHeader(Name = "Idempotency-Key")] string? key, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        if (!await db.SecurityDeposits.AnyAsync(item => item.AccountId == accountId && item.Id == id, ct))
            return Results.NotFound();
        if (!PaymentEndpoints.ValidKey(key)) return Invalid("idempotencyKey", "Geçerli bir işlem anahtarı girin.");
        if (input.MovementOn.Year < 1900 || input.MovementOn > RentRules.Today)
            return Invalid("movementOn", "Geçerli bir geçmiş veya bugün tarihi girin.");
        if (input.MovementType is not { } type) return Invalid("movementType", "Hareket türünü seçin.");
        if (SignedAmount(type, input.Amount) is not { } amount)
            return Invalid("amount", "Geçerli bir hareket tutarı girin.");
        var note = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
        if (note?.Length > 500 || (type == DepositMovementType.ADJUSTED && note is null))
            return Invalid("note", "Düzeltme gerekçesi zorunludur. Not en çok 500 karakter olmalıdır.");
        var movements = db.DepositMovements.Where(item => item.AccountId == accountId && item.DepositId == id);
        var existing = await movements.SingleOrDefaultAsync(item => item.IdempotencyKey == key, ct);
        if (existing is not null)
            return existing.Amount == amount && existing.MovementOn == input.MovementOn &&
                existing.MovementType == type && existing.Note == note
                ? Results.Ok(ToResponse(existing)) : Conflict("İşlem anahtarı başka bir hareket için kullanılmış.");
        // A backdated movement must preserve the balance at the end of every affected day.
        var days = await movements.GroupBy(item => item.MovementOn).OrderBy(day => day.Key)
            .Select(day => new { Date = day.Key, Amount = day.Sum(item => item.Amount) }).ToArrayAsync(ct);
        var balance = days.Where(day => day.Date <= input.MovementOn).Sum(day => day.Amount) + amount;
        if (balance < 0) return Conflict("Hareket teminat bakiyesini negatife düşürüyor.");
        foreach (var day in days.Where(day => day.Date > input.MovementOn))
        {
            balance += day.Amount;
            if (balance < 0) return Conflict("Hareket teminat bakiyesini negatife düşürüyor.");
        }
        if (!RentRules.IsMoney(balance)) return Conflict("Teminat bakiyesi izin verilen aralığı aşıyor.");
        var movement = new DepositMovement
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            DepositId = id,
            MovementOn = input.MovementOn,
            MovementType = type,
            Amount = amount,
            Note = note,
            IdempotencyKey = key!
        };
        db.DepositMovements.Add(movement);
        AddAudit(db, principal, accountId, movement.Id, "DEPOSIT_MOVEMENT", "CREATED");
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Created($"/api/v1/deposits/{id}/movements", ToResponse(movement));
    }

    private static async Task<decimal> BalanceAsync(ApplicationDbContext db, Guid accountId, Guid id, CancellationToken ct) =>
        await db.DepositMovements.Where(item => item.AccountId == accountId && item.DepositId == id)
            .SumAsync(item => (decimal?)item.Amount, ct) ?? 0;

    private static IResult Conflict(string title) => Results.Problem(statusCode: 409, title: title);

    internal static decimal? SignedAmount(DepositMovementType type, decimal amount)
    {
        if (amount == 0 || amount < -99_999_999_999_999_999.99m ||
            !RentRules.IsMoney(Math.Abs(amount)) || (type != DepositMovementType.ADJUSTED && amount < 0))
            return null;
        return type == DepositMovementType.RETURNED ? -amount : amount;
    }

    private static DepositMovementResponse ToResponse(DepositMovement movement) =>
        new(movement.Id, movement.DepositId, movement.MovementOn, movement.MovementType, movement.Amount, movement.Note);
}

public sealed record CreateDepositRequest([property: Required] Guid LeaseId,
    [property: Required] DepositCustody? CustodyType, string? Note);
public sealed record AddDepositMovementRequest([property: Required] DateOnly MovementOn,
    [property: Required] DepositMovementType? MovementType, [property: Required] decimal Amount, string? Note);
public sealed record DepositResponse(Guid Id, Guid LeaseId, decimal AmountAgreed, DepositCustody CustodyType, string? Note, decimal Balance);
public sealed record DepositPage(DepositResponse[] Items, int Page, int PageSize, bool HasMore);
public sealed record DepositMovementResponse(Guid Id, Guid DepositId, DateOnly MovementOn, DepositMovementType MovementType,
    decimal Amount, string? Note);
public sealed record DepositMovementPage(DepositMovementResponse[] Items, int Page, int PageSize, bool HasMore);
