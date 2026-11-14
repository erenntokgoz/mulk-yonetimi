using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class PaymentEndpoints
{
    public static void MapPaymentEndpoints(this WebApplication app)
    {
        var group = app.MapPortfolioGroup("/api/v1/payments");
        group.MapGet("", ListAsync).WithName("ListPayments").Produces<PaymentPage>().ProducesValidationProblem();
        group.MapGet("/{id:guid}", GetAsync).WithName("GetPayment").Produces<PaymentResponse>().ProducesProblem(404);
        group.MapPost("", CreateAsync).WithName("CreatePayment").Produces<PaymentResponse>(201).Produces<PaymentResponse>()
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        group.MapPost("/{id:guid}/allocations", AllocateAsync).WithName("AllocatePayment")
            .Produces<PaymentAllocationResponse>(201).Produces<PaymentAllocationResponse>()
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        group.MapPost("/{id:guid}/void", VoidAsync).WithName("VoidPayment").Produces<PaymentResponse>()
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
    }

    private static async Task<IResult> ListAsync(Guid? tenantId, int? page, int? pageSize, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var current = page ?? 1;
        var size = pageSize ?? 25;
        if (ValidatePage(current, size) is { } invalid) return invalid;
        var payments = await db.Payments.AsNoTracking()
            .Where(payment => payment.AccountId == accountId && (tenantId == null || payment.TenantId == tenantId))
            .OrderByDescending(payment => payment.PaidOn).ThenBy(payment => payment.Id)
            .Skip((current - 1) * size).Take(size + 1).ToListAsync(ct);
        var items = new List<PaymentResponse>();
        var ids = payments.Take(size).Select(payment => payment.Id).ToArray();
        var allocations = await db.PaymentAllocations.AsNoTracking()
            .Where(item => item.AccountId == accountId && ids.Contains(item.PaymentId))
            .OrderBy(item => item.Id).ToListAsync(ct);
        var byPayment = allocations.ToLookup(item => item.PaymentId);
        foreach (var payment in payments.Take(size))
            items.Add(ToResponse(payment, byPayment[payment.Id]));
        return Results.Ok(new PaymentPage(items.ToArray(), current, size, payments.Count > size));
    }

    private static async Task<IResult> GetAsync(Guid id, ClaimsPrincipal principal, AccountMembershipResolver memberships,
        ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var payment = await FindAsync(db, accountId, id, ct);
        return payment is null ? Results.NotFound() : Results.Ok(await ResponseAsync(db, payment, ct));
    }

    private static async Task<IResult> CreateAsync(CreatePaymentRequest input,
        [FromHeader(Name = "Idempotency-Key")] string? key, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (!ValidKey(key)) return Invalid("idempotencyKey", "1 ile 64 karakter arasında işlem anahtarı girin.");
        if (input.PaidOn.Year < 1900 || input.PaidOn > RentRules.Today)
            return Invalid("paidOn", "Geçerli bir geçmiş veya bugün tarihi girin.");
        if (input.Amount <= 0 || !RentRules.IsMoney(input.Amount))
            return Invalid("amount", "Geçerli bir pozitif tahsilat tutarı girin.");
        if (input.Method is null) return Invalid("method", "Ödeme yöntemi zorunludur.");
        var reference = string.IsNullOrWhiteSpace(input.Reference) ? null : input.Reference.Trim();
        if (reference?.Length > 500) return Invalid("reference", "Referans en çok 500 karakter olmalıdır.");

        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var existing = await db.Payments.SingleOrDefaultAsync(payment =>
            payment.AccountId == accountId && payment.IdempotencyKey == key, ct);
        if (existing is not null)
        {
            if (existing.TenantId != input.TenantId || existing.PaidOn != input.PaidOn ||
                existing.Amount != input.Amount || existing.Method != input.Method || existing.Reference != reference)
                return Conflict("İşlem anahtarı başka bir tahsilat için kullanılmış.");
            return Results.Ok(await ResponseAsync(db, existing, ct));
        }
        if (!await db.Tenants.AnyAsync(tenant => tenant.AccountId == accountId && tenant.Id == input.TenantId, ct))
            return Results.NotFound();

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            TenantId = input.TenantId,
            PaidOn = input.PaidOn,
            Amount = input.Amount,
            Method = input.Method.Value,
            Reference = reference,
            IdempotencyKey = key!
        };
        db.Payments.Add(payment);
        AddAudit(db, principal, accountId, payment.Id, "PAYMENT", "CREATED");
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.CreatedAtRoute("GetPayment", new { id = payment.Id }, ToResponse(payment, []));
    }

    private static async Task<IResult> AllocateAsync(Guid id, AllocatePaymentRequest input,
        [FromHeader(Name = "Idempotency-Key")] string? key, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var payment = await FindAsync(db, accountId, id, ct);
        if (payment is null) return Results.NotFound();
        if (!ValidKey(key)) return Invalid("idempotencyKey", "1 ile 64 karakter arasında işlem anahtarı girin.");
        if (input.Amount <= 0 || !RentRules.IsMoney(input.Amount))
            return Invalid("amount", "Geçerli bir pozitif dağıtım tutarı girin.");

        var charge = await (from item in db.RentCharges
                            join lease in db.Leases on new { item.AccountId, Id = item.LeaseId }
                                equals new { lease.AccountId, lease.Id }
                            where item.AccountId == accountId && item.Id == input.RentChargeId &&
                                lease.TenantId == payment.TenantId
                            select item).SingleOrDefaultAsync(ct);
        if (charge is null) return Results.NotFound();

        var allocations = db.PaymentAllocations.Where(item => item.AccountId == accountId && item.PaymentId == id);
        var existing = await allocations.SingleOrDefaultAsync(item => item.IdempotencyKey == key, ct);
        if (existing is not null)
        {
            if (existing.RentChargeId != input.RentChargeId || existing.Amount != input.Amount)
                return Conflict("İşlem anahtarı başka bir dağıtım için kullanılmış.");
            return Results.Ok(ToAllocationResponse(existing, payment.VoidedAtUtc == null));
        }
        if (payment.VoidedAtUtc is not null) return Conflict("İptal edilmiş tahsilat dağıtılamaz.");
        var distributed = await allocations.SumAsync(item => (decimal?)item.Amount, ct) ?? 0m;
        var chargePaid = await RentChargeEndpoints.ValidAllocations(db, accountId)
            .Where(item => item.RentChargeId == charge.Id).SumAsync(item => (decimal?)item.Amount, ct) ?? 0m;
        if (input.Amount > payment.Amount - distributed || input.Amount > charge.Amount - chargePaid)
            return Conflict("Dağıtım tutarı tahsilat veya alacak bakiyesini aşıyor.");

        var allocation = new PaymentAllocation
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PaymentId = id,
            RentChargeId = charge.Id,
            Amount = input.Amount,
            IdempotencyKey = key!
        };
        db.PaymentAllocations.Add(allocation);
        AddAudit(db, principal, accountId, allocation.Id, "PAYMENT_ALLOCATION", "CREATED");
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Created($"/api/v1/payments/{id}", ToAllocationResponse(allocation, true));
    }

    private static async Task<IResult> VoidAsync(Guid id, VoidPaymentRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var payment = await FindAsync(db, accountId, id, ct);
        if (payment is null) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Trim().Length > 500)
            return Invalid("reason", "İptal gerekçesi 1 ile 500 karakter arasında olmalıdır.");
        if (payment.VoidedAtUtc is not null)
        {
            if (payment.VoidReason != input.Reason.Trim()) return Conflict("Bu tahsilat daha önce iptal edildi.");
            return Results.Ok(await ResponseAsync(db, payment, ct));
        }
        payment.VoidedAtUtc = DateTime.UtcNow;
        payment.VoidReason = input.Reason.Trim();
        AddAudit(db, principal, accountId, id, "PAYMENT", "VOIDED");
        await db.SaveChangesAsync(ct);
        var response = await ResponseAsync(db, payment, ct);
        await transaction.CommitAsync(ct);
        return Results.Ok(response);
    }

    internal static bool ValidKey(string? key) => key is { Length: > 0 and <= 64 } &&
        key.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_');

    private static IResult Conflict(string title) => Results.Problem(statusCode: 409, title: title);

    private static Task<Payment?> FindAsync(ApplicationDbContext db, Guid accountId, Guid id, CancellationToken ct) =>
        db.Payments.SingleOrDefaultAsync(payment => payment.AccountId == accountId && payment.Id == id, ct);

    private static async Task<PaymentResponse> ResponseAsync(ApplicationDbContext db, Payment payment, CancellationToken ct) =>
        ToResponse(payment, await db.PaymentAllocations.AsNoTracking()
            .Where(item => item.AccountId == payment.AccountId && item.PaymentId == payment.Id)
            .OrderBy(item => item.Id).ToListAsync(ct));

    private static PaymentResponse ToResponse(Payment payment, IEnumerable<PaymentAllocation> allocations)
    {
        var valid = payment.VoidedAtUtc == null;
        var items = allocations.Select(item => ToAllocationResponse(item, valid)).ToArray();
        var allocated = valid ? items.Sum(item => item.Amount) : 0;
        return new PaymentResponse(payment.Id, payment.TenantId, payment.PaidOn, payment.Amount, payment.Method,
            payment.Reference, valid ? "RECORDED" : "VOIDED", allocated, valid ? payment.Amount - allocated : 0,
            AsUtc(payment.VoidedAtUtc), payment.VoidReason, items);
    }

    private static PaymentAllocationResponse ToAllocationResponse(PaymentAllocation allocation, bool valid) =>
        new(allocation.Id, allocation.RentChargeId, allocation.Amount, valid);
}

public sealed record CreatePaymentRequest([property: Required] Guid TenantId, [property: Required] DateOnly PaidOn,
    [property: Required] decimal Amount, [property: Required] PaymentMethod? Method, string? Reference);
public sealed record AllocatePaymentRequest([property: Required] Guid RentChargeId, [property: Required] decimal Amount);
public sealed record VoidPaymentRequest([property: Required] string Reason);
public sealed record PaymentAllocationResponse(Guid Id, Guid RentChargeId, decimal Amount, bool IsEffective);
public sealed record PaymentResponse(Guid Id, Guid TenantId, DateOnly PaidOn, decimal Amount, PaymentMethod Method,
    string? Reference, string Status, decimal AllocatedAmount, decimal UnallocatedAmount, DateTime? VoidedAtUtc,
    string? VoidReason, PaymentAllocationResponse[] Allocations);
public sealed record PaymentPage(PaymentResponse[] Items, int Page, int PageSize, bool HasMore);
