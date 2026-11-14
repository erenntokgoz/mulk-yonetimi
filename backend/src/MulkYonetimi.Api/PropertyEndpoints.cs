using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class PropertyEndpoints
{
    public static void MapPropertyEndpoints(this WebApplication app)
    {
        var properties = app.MapPortfolioGroup("/api/v1/properties");
        UnitEndpoints.Map(properties);

        properties.MapGet("", ListAsync).WithName("ListProperties")
            .Produces<PropertyPage>().ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(403);
        properties.MapPost("", CreateAsync).WithName("CreateProperty")
            .Produces<PropertyResponse>(201).ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(403);
        properties.MapGet("/{id:guid}", GetAsync).WithName("GetProperty")
            .Produces<PropertyResponse>().ProducesProblem(404)
            .ProducesProblem(401).ProducesProblem(403);
        properties.MapPatch("/{id:guid}", UpdateAsync).WithName("UpdateProperty")
            .Produces<PropertyResponse>().ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409)
            .ProducesProblem(401).ProducesProblem(403);
        properties.MapPost("/{id:guid}/archive", ArchiveAsync).WithName("ArchiveProperty")
            .Produces(204).ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409)
            .ProducesProblem(401).ProducesProblem(403);
    }

    private static async Task<IResult> ListAsync(bool? includeArchived, int? page, int? pageSize,
        ClaimsPrincipal principal, AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var currentPage = page ?? 1;
        var size = pageSize ?? 25;
        if (ValidatePage(currentPage, size) is { } invalid) return invalid;

        var rows = await db.Properties.AsNoTracking()
            .Where(property => property.AccountId == accountId &&
                (includeArchived == true || property.ArchivedAtUtc == null))
            .OrderBy(property => property.Name).ThenBy(property => property.Id)
            .Skip((currentPage - 1) * size).Take(size + 1).ToListAsync(ct);
        return Results.Ok(new PropertyPage(rows.Take(size).Select(ToResponse).ToArray(),
            currentPage, size, rows.Count > size));
    }

    private static async Task<IResult> GetAsync(Guid id, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var property = await db.Properties.AsNoTracking()
            .SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        return property is null ? Results.NotFound() : Results.Ok(ToResponse(property));
    }

    private static async Task<IResult> CreateAsync(CreatePropertyRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var errors = ValidateCreation(input);
        if (errors.Count != 0) return Results.ValidationProblem(errors);

        var property = new Property
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Name = input.Name.Trim(),
            Address = input.Address.Trim(),
            Kind = input.PropertyKind!.Value
        };
        db.Properties.Add(property);
        if (input.DefaultUnitUsageType is { } usage)
        {
            db.Units.Add(new Unit
            {
                Id = Guid.NewGuid(),
                AccountId = accountId,
                PropertyId = property.Id,
                Label = "Varsayılan",
                UsageType = usage,
                IsDefault = true
            });
        }

        AddAudit(db, principal, accountId, property.Id, "PROPERTY", "CREATED");
        await db.SaveChangesAsync(ct);
        return Results.CreatedAtRoute("GetProperty", new { id = property.Id }, ToResponse(property));
    }

    private static async Task<IResult> UpdateAsync(Guid id, UpdatePropertyRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var property = await db.Properties.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        if (property is null) return Results.NotFound();
        var errors = ValidateDetails(input.Name, input.Address);
        if (input.Version is not { Length: 8 }) errors["version"] = ["Geçerli bir kayıt sürümü zorunludur."];
        if (errors.Count != 0) return Results.ValidationProblem(errors);
        if (!property.Version.AsSpan().SequenceEqual(input.Version)) return StaleVersion();
        if (property.ArchivedAtUtc is not null)
            return Results.Problem(statusCode: 409, title: "Arşivlenmiş mülk düzenlenemez.");

        var name = input.Name.Trim();
        var address = input.Address.Trim();
        if (property.Name == name && property.Address == address) return Results.Ok(ToResponse(property));

        property.Name = name;
        property.Address = address;
        AddAudit(db, principal, accountId, property.Id, "PROPERTY", "UPDATED");
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return StaleVersion(); }
        return Results.Ok(ToResponse(property));
    }

    private static async Task<IResult> ArchiveAsync(Guid id, ArchivePropertyRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var property = await db.Properties.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        if (property is null) return Results.NotFound();
        if (input.Version is not { Length: 8 }) return Invalid("version", "Geçerli bir kayıt sürümü zorunludur.");
        if (property.ArchivedAtUtc is not null) return Results.NoContent();
        if (!property.Version.AsSpan().SequenceEqual(input.Version)) return StaleVersion();

        property.ArchivedAtUtc = DateTime.UtcNow;
        AddAudit(db, principal, accountId, property.Id, "PROPERTY", "ARCHIVED");
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return StaleVersion(); }
        return Results.NoContent();
    }

    internal static Dictionary<string, string[]> ValidateCreation(CreatePropertyRequest input)
    {
        var errors = ValidateDetails(input.Name, input.Address);
        if (input.PropertyKind is null) errors["propertyKind"] = ["Mülk türü zorunludur."];
        if (input.PropertyKind == PropertyKind.SINGLE_UNIT && input.DefaultUnitUsageType is null)
            errors["defaultUnitUsageType"] = ["Varsayılan birimin kullanım türü zorunludur."];
        if (input.PropertyKind == PropertyKind.MULTI_UNIT && input.DefaultUnitUsageType is not null)
            errors["defaultUnitUsageType"] = ["Varsayılan birim yalnızca tek birimli mülkte oluşturulur."];
        return errors;
    }

    internal static Dictionary<string, string[]> ValidateDetails(string? name, string? address)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 200)
            errors["name"] = ["Mülk adı 1 ile 200 karakter arasında olmalıdır."];
        if (string.IsNullOrWhiteSpace(address) || address.Trim().Length > 500)
            errors["address"] = ["Adres 1 ile 500 karakter arasında olmalıdır."];
        return errors;
    }

    private static IResult StaleVersion() =>
        Results.Problem(statusCode: 409, title: "Mülk değişti. Kaydı yenileyin.");

    private static PropertyResponse ToResponse(Property property) =>
        new(property.Id, property.Name, property.Address, property.Kind,
            AsUtc(property.ArchivedAtUtc), property.Version);
}

public sealed record CreatePropertyRequest([property: Required] string Name, [property: Required] string Address,
    [property: Required] PropertyKind? PropertyKind,
    UnitUsageType? DefaultUnitUsageType);
public sealed record UpdatePropertyRequest([property: Required] string Name, [property: Required] string Address,
    [property: Required] byte[] Version);
public sealed record ArchivePropertyRequest([property: Required] byte[] Version);
public sealed record PropertyResponse(Guid Id, string Name, string Address, PropertyKind PropertyKind,
    DateTime? ArchivedAtUtc, byte[] Version);
public sealed record PropertyPage(PropertyResponse[] Items, int Page, int PageSize, bool HasMore);
