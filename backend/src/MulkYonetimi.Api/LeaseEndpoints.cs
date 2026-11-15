using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class LeaseEndpoints
{
    public static void MapLeaseEndpoints(this WebApplication app)
    {
        var group = app.MapPortfolioGroup("/api/v1/leases");
        group.MapGet("", ListAsync).WithName("ListLeases").Produces<LeasePage>().ProducesValidationProblem();
        group.MapGet("/{id:guid}", GetAsync).WithName("GetLease").Produces<LeaseResponse>().ProducesProblem(404);
        group.MapPost("", CreateAsync).WithName("CreateLease").Produces<LeaseResponse>(201)
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        group.MapPost("/{id:guid}/activate", ActivateAsync).WithName("ActivateLease").Produces<LeaseResponse>()
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        group.MapPost("/{id:guid}/terminate", TerminateAsync).WithName("TerminateLease").Produces<LeaseResponse>()
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        group.MapGet("/{id:guid}/rates", RatesAsync).WithName("ListLeaseRates").Produces<LeaseRateResponse[]>()
            .ProducesProblem(404);
        group.MapPost("/{id:guid}/rates", AddRateAsync).WithName("AddLeaseRate").Produces<LeaseRateResponse>(201)
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        group.MapGet("/{id:guid}/renewals", RenewalsAsync).WithName("ListLeaseRenewals")
            .Produces<LeaseRenewalResponse[]>().ProducesProblem(404);
        group.MapPost("/{id:guid}/renewals", RenewAsync).WithName("RenewLease")
            .Produces<LeaseRenewalResponse>(201).ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
    }

    private static async Task<IResult> ListAsync(LeaseStatus? status, Guid? unitId, Guid? tenantId, int? page,
        int? pageSize, ClaimsPrincipal principal, AccountMembershipResolver memberships, ApplicationDbContext db,
        CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var current = page ?? 1;
        var size = pageSize ?? 25;
        if (ValidatePage(current, size) is { } invalid) return invalid;
        var query = db.Leases.AsNoTracking().Where(lease => lease.AccountId == accountId &&
            (status == null || lease.Status == status) && (unitId == null || lease.UnitId == unitId) &&
            (tenantId == null || lease.TenantId == tenantId));
        var rows = await query.OrderByDescending(lease => lease.StartDate).ThenBy(lease => lease.Id)
            .Skip((current - 1) * size).Take(size + 1).ToListAsync(ct);
        return Results.Ok(new LeasePage(rows.Take(size).Select(ToResponse).ToArray(), current, size, rows.Count > size));
    }

    private static async Task<IResult> GetAsync(Guid id, ClaimsPrincipal principal, AccountMembershipResolver memberships,
        ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var lease = await FindAsync(db, accountId, id, ct);
        return lease is null ? Results.NotFound() : Results.Ok(ToResponse(lease));
    }

    private static async Task<IResult> CreateAsync(CreateLeaseRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var errors = new Dictionary<string, string[]>();
        if (input.StartDate.Year < 1900 || input.StartDate.Year > 9998)
            errors["startDate"] = ["Başlangıç yılı 1900 ile 9998 arasında olmalıdır."];
        if (input.PlannedEndDate < input.StartDate) errors["plannedEndDate"] = ["Bitiş başlangıçtan önce olamaz."];
        if (input.DueDay is < 1 or > 31) errors["dueDay"] = ["Vade günü 1 ile 31 arasında olmalıdır."];
        if (input.MonthlyAmount <= 0 || !RentRules.IsMoney(input.MonthlyAmount))
            errors["monthlyAmount"] = ["Geçerli bir pozitif kira bedeli girin."];
        if (!RentRules.IsMoney(input.DepositAmount)) errors["depositAmount"] = ["Geçerli bir depozito tutarı girin."];
        if (input.Note?.Trim().Length > 1000) errors["note"] = ["Not en çok 1000 karakter olmalıdır."];
        if (errors.Count != 0) return Results.ValidationProblem(errors);

        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        if (await CheckReferencesAsync(db, accountId, input.UnitId, input.TenantId, ct) is { } failure) return failure;
        var lease = new Lease
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            UnitId = input.UnitId,
            TenantId = input.TenantId,
            StartDate = input.StartDate,
            PlannedEndDate = input.PlannedEndDate,
            DueDay = input.DueDay,
            DepositAmount = input.DepositAmount,
            Note = input.Note?.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };
        db.Leases.Add(lease);
        db.RentRatePeriods.Add(new RentRatePeriod
        {
            AccountId = accountId,
            LeaseId = lease.Id,
            EffectiveFrom = lease.StartDate,
            MonthlyAmount = input.MonthlyAmount
        });
        AddAudit(db, principal, accountId, lease.Id, "LEASE", "CREATED");
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.CreatedAtRoute("GetLease", new { id = lease.Id }, ToResponse(lease));
    }

    private static async Task<IResult> ActivateAsync(Guid id, LeaseVersionRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var lease = await FindAsync(db, accountId, id, ct);
        if (lease is null) return Results.NotFound();
        if (CheckVersion(lease, input.Version) is { } error) return error;
        if (lease.Status != LeaseStatus.DRAFT) return Conflict("Yalnızca taslak sözleşme etkinleştirilebilir.");
        if (await CheckReferencesAsync(db, accountId, lease.UnitId, lease.TenantId, ct) is { } failure) return failure;
        var conflicting = await db.Leases.AnyAsync(other => other.AccountId == accountId && other.UnitId == lease.UnitId &&
            (other.Status == LeaseStatus.ACTIVE ||
            (other.Status == LeaseStatus.TERMINATED && other.TerminationDate >= lease.StartDate)), ct);
        if (conflicting) return Conflict("Bu birimde sözleşme tarihleri çakışıyor.");

        lease.Status = LeaseStatus.ACTIVE;
        await RentRules.AddMissingChargesAsync(db, lease, lease.StartDate, ct);
        AddAudit(db, principal, accountId, id, "LEASE", "ACTIVATED");
        return await SaveAsync(db, transaction, lease, ct);
    }

    private static async Task<IResult> TerminateAsync(Guid id, TerminateLeaseRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var lease = await FindAsync(db, accountId, id, ct);
        if (lease is null) return Results.NotFound();
        if (CheckVersion(lease, input.Version) is { } error) return error;
        if (lease.Status != LeaseStatus.ACTIVE) return Conflict("Yalnızca etkin sözleşme sonlandırılabilir.");
        if (input.TerminationDate < lease.StartDate || input.TerminationDate > RentRules.Today)
            return Invalid("terminationDate", "Sonlandırma tarihi başlangıç ile bugün arasında olmalıdır.");
        if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Trim().Length > 500)
            return Invalid("reason", "Sonlandırma gerekçesi 1 ile 500 karakter arasında olmalıdır.");
        var finalPeriod = RentRules.Month(input.TerminationDate);
        if (await db.RentCharges.AnyAsync(charge => charge.AccountId == accountId && charge.LeaseId == id &&
            charge.PeriodStart > finalPeriod && charge.Amount > 0, ct))
            return Conflict("Sonlandırma ayından sonraki alacakları önce açık düzeltmeyle sıfırlayın.");
        await RentRules.AddMissingChargesAsync(db, lease, input.TerminationDate, ct);
        lease.Status = LeaseStatus.TERMINATED;
        lease.TerminationDate = input.TerminationDate;
        lease.TerminationReason = input.Reason.Trim();
        AddAudit(db, principal, accountId, id, "LEASE", "TERMINATED", lease.TerminationReason);
        return await SaveAsync(db, transaction, lease, ct);
    }

    private static async Task<IResult> RatesAsync(Guid id, ClaimsPrincipal principal, AccountMembershipResolver memberships,
        ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (await FindAsync(db, accountId, id, ct) is null) return Results.NotFound();
        var rates = await db.RentRatePeriods.AsNoTracking().Where(rate => rate.AccountId == accountId && rate.LeaseId == id)
            .OrderBy(rate => rate.EffectiveFrom)
            .Select(rate => new LeaseRateResponse(rate.EffectiveFrom, rate.MonthlyAmount, rate.Reason)).ToArrayAsync(ct);
        return Results.Ok(rates);
    }

    private static async Task<IResult> AddRateAsync(Guid id, CreateLeaseRateRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var lease = await FindAsync(db, accountId, id, ct);
        if (lease is null) return Results.NotFound();
        if (lease.Status != LeaseStatus.ACTIVE) return Conflict("Kira bedeli yalnızca etkin sözleşmede değiştirilebilir.");
        if (input.EffectiveFrom <= RentRules.Today || input.EffectiveFrom <= lease.StartDate || input.EffectiveFrom.Day != 1)
            return Invalid("effectiveFrom", "Sözleşme başlangıcından sonraki bir gelecek ayın ilk gününü girin.");
        if (input.MonthlyAmount <= 0 || !RentRules.IsMoney(input.MonthlyAmount))
            return Invalid("monthlyAmount", "Geçerli bir pozitif kira bedeli girin.");
        if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Trim().Length > 500)
            return Invalid("reason", "Değişiklik gerekçesi 1 ile 500 karakter arasında olmalıdır.");
        if (await db.RentRatePeriods.AnyAsync(rate => rate.AccountId == accountId && rate.LeaseId == id &&
            rate.EffectiveFrom == input.EffectiveFrom, ct) ||
            await db.RentCharges.AnyAsync(charge => charge.AccountId == accountId && charge.LeaseId == id &&
                charge.PeriodStart >= input.EffectiveFrom, ct))
            return Conflict("Bu tarih için kira bedeli veya sonraki bir alacak kaydı mevcut.");

        db.RentRatePeriods.Add(new RentRatePeriod
        {
            AccountId = accountId,
            LeaseId = id,
            EffectiveFrom = input.EffectiveFrom,
            MonthlyAmount = input.MonthlyAmount,
            Reason = input.Reason.Trim()
        });
        AddAudit(db, principal, accountId, id, "LEASE", "RATE_ADDED", input.Reason.Trim());
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Created($"/api/v1/leases/{id}/rates",
            new LeaseRateResponse(input.EffectiveFrom, input.MonthlyAmount, input.Reason.Trim()));
    }

    private static async Task<IResult> RenewalsAsync(Guid id, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (await FindAsync(db, accountId, id, ct) is null) return Results.NotFound();
        var history = await db.LeaseRenewals.AsNoTracking().Where(item => item.AccountId == accountId && item.LeaseId == id)
            .OrderBy(item => item.EffectiveFrom).Select(item => new LeaseRenewalResponse(item.Id,
                item.PreviousEndDate, item.NewEndDate, item.EffectiveFrom, item.MonthlyAmount, item.Reason,
                item.OccurredAtUtc)).ToArrayAsync(ct);
        return Results.Ok(history);
    }

    private static async Task<IResult> RenewAsync(Guid id, RenewLeaseRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var lease = await FindAsync(db, accountId, id, ct);
        if (lease is null) return Results.NotFound();
        if (CheckVersion(lease, input.Version) is { } stale) return stale;
        if (lease.Status != LeaseStatus.ACTIVE || lease.PlannedEndDate is not { } previousEnd)
            return Conflict("Yalnız bitiş tarihi olan etkin sözleşme yenilenebilir.");
        if (input.NewEndDate <= previousEnd || input.NewEndDate.Year > 9998)
            return Invalid("newEndDate", "Yeni bitiş tarihi mevcut bitişten sonra olmalıdır.");
        if (input.EffectiveFrom <= RentRules.Today || input.EffectiveFrom <= lease.StartDate ||
            input.EffectiveFrom.Day != 1 || input.EffectiveFrom > input.NewEndDate)
            return Invalid("effectiveFrom", "Yeni bitişten önceki bir gelecek ayın ilk gününü girin.");
        if (input.MonthlyAmount <= 0 || !RentRules.IsMoney(input.MonthlyAmount))
            return Invalid("monthlyAmount", "Geçerli bir pozitif kira bedeli girin.");
        if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Trim().Length > 500)
            return Invalid("reason", "Yenileme gerekçesi 1 ile 500 karakter arasında olmalıdır.");
        if (await db.RentRatePeriods.AnyAsync(rate => rate.AccountId == accountId && rate.LeaseId == id &&
            rate.EffectiveFrom >= input.EffectiveFrom, ct) ||
            await db.RentCharges.AnyAsync(charge => charge.AccountId == accountId && charge.LeaseId == id &&
                charge.PeriodStart >= input.EffectiveFrom, ct))
            return Conflict("Bu tarihten sonra bedel veya alacak kaydı var.");
        var renewal = new LeaseRenewal
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            LeaseId = id,
            PreviousEndDate = previousEnd,
            NewEndDate = input.NewEndDate,
            EffectiveFrom = input.EffectiveFrom,
            MonthlyAmount = input.MonthlyAmount,
            Reason = input.Reason.Trim(),
            OccurredAtUtc = DateTime.UtcNow
        };
        lease.PlannedEndDate = input.NewEndDate;
        db.LeaseRenewals.Add(renewal);
        db.RentRatePeriods.Add(new RentRatePeriod
        {
            AccountId = accountId,
            LeaseId = id,
            EffectiveFrom = renewal.EffectiveFrom,
            MonthlyAmount = renewal.MonthlyAmount,
            Reason = renewal.Reason
        });
        AddAudit(db, principal, accountId, id, "LEASE", "RENEWED", renewal.Reason);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Created($"/api/v1/leases/{id}/renewals", ToRenewalResponse(renewal));
    }

    private static LeaseRenewalResponse ToRenewalResponse(LeaseRenewal renewal) =>
        new(renewal.Id, renewal.PreviousEndDate, renewal.NewEndDate, renewal.EffectiveFrom,
            renewal.MonthlyAmount, renewal.Reason, AsUtc(renewal.OccurredAtUtc)!.Value);

    private static async Task<IResult?> CheckReferencesAsync(ApplicationDbContext db, Guid accountId, Guid unitId,
        Guid tenantId, CancellationToken ct)
    {
        var unitAndProperty = await (from unit in db.Units
                                     join parent in db.Properties on new { unit.AccountId, Id = unit.PropertyId }
                                         equals new { parent.AccountId, parent.Id }
                                     where unit.AccountId == accountId && unit.Id == unitId
                                     select new { unit.ArchivedAtUtc, Property = parent }).SingleOrDefaultAsync(ct);
        var tenant = await db.Tenants.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == tenantId, ct);
        if (unitAndProperty is null || tenant is null) return Results.NotFound();
        return unitAndProperty.ArchivedAtUtc != null || unitAndProperty.Property.ArchivedAtUtc != null ||
            tenant.ArchivedAtUtc != null
            ? Conflict("Arşivli mülk, birim veya kiracı sözleşmeye bağlanamaz.") : null;
    }

    private static Task<Lease?> FindAsync(ApplicationDbContext db, Guid accountId, Guid id, CancellationToken ct) =>
        db.Leases.SingleOrDefaultAsync(lease => lease.AccountId == accountId && lease.Id == id, ct);

    private static IResult? CheckVersion(Lease lease, byte[]? version)
    {
        if (version is not { Length: 8 }) return Invalid("version", "Geçerli bir kayıt sürümü zorunludur.");
        return lease.Version.AsSpan().SequenceEqual(version) ? null : Conflict("Sözleşme değişti. Kaydı yenileyin.");
    }

    private static IResult Conflict(string title) => Results.Problem(statusCode: 409, title: title);

    private static async Task<IResult> SaveAsync(ApplicationDbContext db,
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction, Lease lease, CancellationToken ct)
    {
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Ok(ToResponse(lease));
    }

    private static LeaseResponse ToResponse(Lease lease) =>
        new(lease.Id, lease.UnitId, lease.TenantId, lease.Status, lease.StartDate, lease.PlannedEndDate,
            lease.TerminationDate, lease.DueDay, lease.DepositAmount, lease.Note, lease.TerminationReason, lease.Version);
}

public sealed record CreateLeaseRequest([property: Required] Guid UnitId, [property: Required] Guid TenantId,
    [property: Required] DateOnly StartDate, DateOnly? PlannedEndDate, [property: Required] int DueDay,
    [property: Required] decimal MonthlyAmount, decimal DepositAmount = 0, string? Note = null);
public sealed record LeaseVersionRequest([property: Required] byte[] Version);
public sealed record TerminateLeaseRequest([property: Required] byte[] Version,
    [property: Required] DateOnly TerminationDate, [property: Required] string Reason);
public sealed record CreateLeaseRateRequest([property: Required] DateOnly EffectiveFrom,
    [property: Required] decimal MonthlyAmount, [property: Required] string Reason);
public sealed record LeaseRateResponse(DateOnly EffectiveFrom, decimal MonthlyAmount, string? Reason);
public sealed record RenewLeaseRequest([property: Required] byte[] Version, [property: Required] DateOnly NewEndDate,
    [property: Required] DateOnly EffectiveFrom, [property: Required] decimal MonthlyAmount,
    [property: Required] string Reason);
public sealed record LeaseRenewalResponse(Guid Id, DateOnly PreviousEndDate, DateOnly NewEndDate,
    DateOnly EffectiveFrom, decimal MonthlyAmount, string Reason, DateTime OccurredAtUtc);
public sealed record LeaseResponse(Guid Id, Guid UnitId, Guid TenantId, LeaseStatus Status, DateOnly StartDate,
    DateOnly? PlannedEndDate, DateOnly? TerminationDate, int DueDay, decimal DepositAmount, string? Note,
    string? TerminationReason, byte[] Version);
public sealed record LeasePage(LeaseResponse[] Items, int Page, int PageSize, bool HasMore);
