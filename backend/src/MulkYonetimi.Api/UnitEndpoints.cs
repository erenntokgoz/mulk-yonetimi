using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class UnitEndpoints
{
    public static void Map(RouteGroupBuilder properties)
    {
        properties.MapGet("/{id:guid}/units", ListAsync).WithName("ListPropertyUnits")
            .Produces<UnitPage>().ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(403).ProducesProblem(404);
        properties.MapPost("/{id:guid}/units", CreateAsync).WithName("CreatePropertyUnit")
            .Produces<UnitResponse>(201).ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(403).ProducesProblem(404).ProducesProblem(409);
        properties.MapPost("/{id:guid}/units/{unitId:guid}/archive", ArchiveAsync).WithName("ArchivePropertyUnit")
            .Produces(204).ProducesProblem(404).ProducesProblem(409);
    }

    private static async Task<IResult> ListAsync(Guid id, bool? includeArchived, int? page, int? pageSize, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (!await db.Properties.AnyAsync(property => property.AccountId == accountId && property.Id == id, ct))
            return Results.NotFound();
        var currentPage = page ?? 1;
        var size = pageSize ?? 25;
        if (ValidatePage(currentPage, size) is { } invalid) return invalid;

        var rows = await db.Units.AsNoTracking().Where(unit => unit.AccountId == accountId && unit.PropertyId == id &&
                (includeArchived == true || unit.ArchivedAtUtc == null))
            .OrderBy(unit => unit.Label).ThenBy(unit => unit.Id)
            .Skip((currentPage - 1) * size).Take(size + 1).ToListAsync(ct);
        return Results.Ok(new UnitPage(rows.Take(size).Select(ToResponse).ToArray(), currentPage, size, rows.Count > size));
    }

    private static async Task<IResult> ArchiveAsync(Guid id, Guid unitId, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var unit = await db.Units.SingleOrDefaultAsync(item => item.AccountId == accountId &&
            item.PropertyId == id && item.Id == unitId, ct);
        if (unit is null) return Results.NotFound();
        if (unit.ArchivedAtUtc is not null) return Results.NoContent();
        if (await db.Leases.AnyAsync(lease => lease.AccountId == accountId && lease.UnitId == unitId &&
            lease.Status == LeaseStatus.ACTIVE, ct))
            return Results.Problem(statusCode: 409, title: "Etkin sözleşmesi olan birim arşivlenemez.");
        unit.ArchivedAtUtc = DateTime.UtcNow;
        AddAudit(db, principal, accountId, unit.Id, "UNIT", "ARCHIVED");
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> CreateAsync(Guid id, CreateUnitRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        var property = await db.Properties.AsNoTracking()
            .SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        if (property is null) return Results.NotFound();
        if (property.ArchivedAtUtc is not null || property.Kind == PropertyKind.SINGLE_UNIT)
            return Results.Problem(statusCode: 409, title: "Bu mülke yeni birim eklenemez.");

        var errors = ValidateCreation(input);
        if (errors.Count != 0) return Results.ValidationProblem(errors);
        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = id,
            Label = input.Label.Trim(),
            UsageType = input.UsageType!.Value,
            DoorNumber = string.IsNullOrWhiteSpace(input.DoorNumber) ? null : input.DoorNumber.Trim(),
            AreaM2 = input.AreaM2
        };
        db.Units.Add(unit);
        AddAudit(db, principal, accountId, unit.Id, "UNIT", "CREATED");
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
        {
            return Results.Problem(statusCode: 409, title: "Bu mülkte aynı etiketle bir birim var.");
        }
        await transaction.CommitAsync(ct);
        return Results.Created((string?)null, ToResponse(unit));
    }

    internal static Dictionary<string, string[]> ValidateCreation(CreateUnitRequest input)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(input.Label) || input.Label.Trim().Length > 100)
            errors["label"] = ["Birim etiketi 1 ile 100 karakter arasında olmalıdır."];
        if (input.UsageType is null) errors["usageType"] = ["Kullanım türü zorunludur."];
        if (input.DoorNumber?.Trim().Length > 32)
            errors["doorNumber"] = ["Kapı numarası en çok 32 karakter olmalıdır."];
        if (input.AreaM2 is { } area && (area <= 0 || area > 9_999_999.99m || decimal.Round(area, 2) != area))
            errors["areaM2"] = ["Alan pozitif ve en çok iki ondalık basamaklı olmalıdır."];
        return errors;
    }

    private static UnitResponse ToResponse(Unit unit) =>
        new(unit.Id, unit.PropertyId, unit.Label, unit.UsageType, unit.DoorNumber, unit.AreaM2, unit.IsDefault,
            AsUtc(unit.ArchivedAtUtc));
}

public sealed record CreateUnitRequest([property: Required] string Label,
    [property: Required] UnitUsageType? UsageType, string? DoorNumber, decimal? AreaM2);
public sealed record UnitResponse(Guid Id, Guid PropertyId, string Label, UnitUsageType UsageType,
    string? DoorNumber, decimal? AreaM2, bool IsDefault, DateTime? ArchivedAtUtc);
public sealed record UnitPage(UnitResponse[] Items, int Page, int PageSize, bool HasMore);
