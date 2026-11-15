using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class RentChargeEndpoints
{
    public static void MapRentChargeEndpoints(this WebApplication app)
    {
        var group = app.MapPortfolioGroup("/api/v1/rent-charges");
        group.MapGet("", ListAsync).WithName("ListRentCharges").Produces<RentChargePage>()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(403);
        group.MapPost("/{id:guid}/corrections", CorrectAsync).WithName("CorrectRentCharge")
            .Produces<RentChargeCorrectionResponse>(201).Produces<RentChargeCorrectionResponse>()
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
    }

    private static async Task<IResult> CorrectAsync(Guid id, CorrectRentChargeRequest input,
        [FromHeader(Name = "Idempotency-Key")] string? key, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var charge = await db.RentCharges.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        if (charge is null) return Results.NotFound();
        if (!PaymentEndpoints.ValidKey(key)) return Invalid("idempotencyKey", "Geçerli bir işlem anahtarı girin.");
        if (input.Amount is not { } amount || !RentRules.IsMoney(amount))
            return Invalid("amount", "Geçerli bir alacak tutarı girin.");
        if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Trim().Length > 500)
            return Invalid("reason", "Düzeltme gerekçesi 1 ile 500 karakter arasında olmalıdır.");
        var reason = input.Reason.Trim();
        var existing = await db.RentChargeCorrections.SingleOrDefaultAsync(item => item.AccountId == accountId &&
            item.RentChargeId == id && item.IdempotencyKey == key, ct);
        if (existing is not null)
            return existing.Amount == amount && existing.Reason == reason ? Results.Ok(ToResponse(existing)) :
                Results.Problem(statusCode: 409, title: "İşlem anahtarı başka bir düzeltme için kullanılmış.");
        if (await ValidAllocations(db, accountId).AnyAsync(item => item.RentChargeId == id, ct))
            return Results.Problem(statusCode: 409, title: "Etkin tahsilata bağlı alacak düzeltilemez.");
        var correction = new RentChargeCorrection
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            RentChargeId = id,
            PreviousAmount = charge.Amount,
            Amount = amount,
            Reason = reason,
            OccurredAtUtc = DateTime.UtcNow,
            IdempotencyKey = key!
        };
        charge.Amount = amount;
        db.RentChargeCorrections.Add(correction);
        AddAudit(db, principal, accountId, id, "RENT_CHARGE", "CORRECTED", reason,
            AuditDiffSummary.RentChargeCorrected(correction.PreviousAmount, correction.Amount));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Created((string?)null, ToResponse(correction));
    }

    private static RentChargeCorrectionResponse ToResponse(RentChargeCorrection correction) =>
        new(correction.Id, correction.RentChargeId, correction.PreviousAmount, correction.Amount, correction.Reason,
            DateTime.SpecifyKind(correction.OccurredAtUtc, DateTimeKind.Utc));

    internal static IQueryable<PaymentAllocation> ValidAllocations(ApplicationDbContext db, Guid accountId) =>
        from allocation in db.PaymentAllocations
        join payment in db.Payments on new { allocation.AccountId, Id = allocation.PaymentId }
            equals new { payment.AccountId, payment.Id }
        where allocation.AccountId == accountId && payment.VoidedAtUtc == null
        select allocation;

    private static async Task<IResult> ListAsync(Guid? leaseId, Guid? tenantId, DateOnly? startPeriod, DateOnly? endPeriod,
        int? page, int? pageSize, ClaimsPrincipal principal, AccountMembershipResolver memberships,
        ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var current = page ?? 1;
        var size = pageSize ?? 25;
        if (ValidatePage(current, size) is { } invalid) return invalid;
        if (startPeriod > endPeriod) return Invalid("endPeriod", "Bitiş başlangıçtan önce olamaz.");

        var validAllocations = ValidAllocations(db, accountId);
        var rows = await (from charge in db.RentCharges
                          join lease in db.Leases on new { charge.AccountId, Id = charge.LeaseId }
                              equals new { lease.AccountId, lease.Id }
                          where charge.AccountId == accountId &&
                              (leaseId == null || charge.LeaseId == leaseId) &&
                              (tenantId == null || lease.TenantId == tenantId) &&
                              (startPeriod == null || charge.PeriodStart >= startPeriod) &&
                              (endPeriod == null || charge.PeriodStart <= endPeriod)
                          orderby charge.PeriodStart descending, charge.Id
                          select new
                          {
                              charge.Id,
                              charge.LeaseId,
                              lease.TenantId,
                              charge.PeriodStart,
                              charge.DueDate,
                              charge.Amount,
                              Paid = validAllocations.Where(item => item.RentChargeId == charge.Id)
                                  .Sum(item => (decimal?)item.Amount) ?? 0m
                          }).Skip((current - 1) * size).Take(size + 1).ToListAsync(ct);
        var today = RentRules.Today;
        var items = rows.Take(size).Select(row => new RentChargeResponse(row.Id, row.LeaseId, row.TenantId,
            row.PeriodStart, row.DueDate, row.Amount, row.Paid, row.Amount - row.Paid,
            RentRules.ChargeStatus(row.Amount, row.Paid), row.DueDate < today && row.Amount > row.Paid)).ToArray();
        return Results.Ok(new RentChargePage(items, current, size, rows.Count > size));
    }
}

public sealed record RentChargeResponse(Guid Id, Guid LeaseId, Guid TenantId, DateOnly PeriodStart, DateOnly DueDate,
    decimal Amount, decimal PaidAmount, decimal Balance, string Status, bool IsOverdue);
public sealed record RentChargePage(RentChargeResponse[] Items, int Page, int PageSize, bool HasMore);
public sealed record CorrectRentChargeRequest([property: Required] decimal? Amount, [property: Required] string Reason);
public sealed record RentChargeCorrectionResponse(Guid Id, Guid RentChargeId, decimal PreviousAmount, decimal Amount,
    string Reason, DateTime OccurredAtUtc);
