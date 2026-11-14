using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class TenantEndpoints
{
    public static void MapTenantEndpoints(this WebApplication app)
    {
        var tenants = app.MapPortfolioGroup("/api/v1/tenants");
        tenants.MapGet("", ListAsync).WithName("ListTenants")
            .Produces<TenantPage>().ProducesValidationProblem().ProducesProblem(401).ProducesProblem(403);
        tenants.MapPost("", CreateAsync).WithName("CreateTenant")
            .Produces<TenantResponse>(201).ProducesValidationProblem().ProducesProblem(401).ProducesProblem(403);
        tenants.MapGet("/{id:guid}", GetAsync).WithName("GetTenant")
            .Produces<TenantResponse>().ProducesProblem(401).ProducesProblem(403).ProducesProblem(404);
        tenants.MapPatch("/{id:guid}", UpdateAsync).WithName("UpdateTenant")
            .Produces<TenantResponse>().ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(403).ProducesProblem(404).ProducesProblem(409);
        tenants.MapPost("/{id:guid}/archive", ArchiveAsync).WithName("ArchiveTenant")
            .Produces(204).ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(403).ProducesProblem(404).ProducesProblem(409);
    }

    private static async Task<IResult> ListAsync(string? q, bool? includeArchived, int? page, int? pageSize,
        ClaimsPrincipal principal, AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var currentPage = page ?? 1;
        var size = pageSize ?? 25;
        if (ValidatePage(currentPage, size) is { } invalid) return invalid;
        var search = q?.Trim();
        if (search?.Length > 200) return Invalid("q", "Arama en çok 200 karakter olmalıdır.");

        var query = db.Tenants.AsNoTracking().Where(tenant => tenant.AccountId == accountId &&
            (includeArchived == true || tenant.ArchivedAtUtc == null));
        if (!string.IsNullOrEmpty(search))
            query = query.Where(tenant =>
                ((tenant.FirstName ?? "") + " " + (tenant.LastName ?? "")).Contains(search) ||
                (tenant.CompanyName != null && tenant.CompanyName.Contains(search)) ||
                (tenant.Phone != null && tenant.Phone.Contains(search)) ||
                (tenant.Email != null && tenant.Email.Contains(search)));
        var rows = await query.OrderBy(tenant => tenant.CompanyName ?? tenant.FirstName)
            .ThenBy(tenant => tenant.LastName).ThenBy(tenant => tenant.Id)
            .Skip((currentPage - 1) * size).Take(size + 1).ToListAsync(ct);
        return Results.Ok(new TenantPage(rows.Take(size).Select(ToResponse).ToArray(), currentPage, size, rows.Count > size));
    }

    private static async Task<IResult> GetAsync(Guid id, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var tenant = await db.Tenants.AsNoTracking().SingleOrDefaultAsync(
            item => item.AccountId == accountId && item.Id == id, ct);
        return tenant is null ? Results.NotFound() : Results.Ok(ToResponse(tenant));
    }

    private static async Task<IResult> CreateAsync(TenantDetails input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var errors = ValidateDetails(input);
        if (errors.Count != 0) return Results.ValidationProblem(errors);
        var tenant = new Tenant { Id = Guid.NewGuid(), AccountId = accountId };
        ApplyDetails(tenant, input);
        db.Tenants.Add(tenant);
        AddAudit(db, principal, accountId, tenant.Id, "TENANT", "CREATED");
        await db.SaveChangesAsync(ct);
        return Results.CreatedAtRoute("GetTenant", new { id = tenant.Id }, ToResponse(tenant));
    }

    private static async Task<IResult> UpdateAsync(Guid id, UpdateTenantRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var tenant = await db.Tenants.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        if (tenant is null) return Results.NotFound();
        var errors = ValidateDetails(input);
        if (input.Version is not { Length: 8 }) errors["version"] = ["Geçerli bir kayıt sürümü zorunludur."];
        if (errors.Count != 0) return Results.ValidationProblem(errors);
        if (!tenant.Version.AsSpan().SequenceEqual(input.Version)) return StaleVersion();
        if (tenant.ArchivedAtUtc is not null)
            return Results.Problem(statusCode: 409, title: "Arşivlenmiş kiracı düzenlenemez.");

        ApplyDetails(tenant, input);
        if (db.Entry(tenant).State == EntityState.Unchanged) return Results.Ok(ToResponse(tenant));
        AddAudit(db, principal, accountId, tenant.Id, "TENANT", "UPDATED");
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return StaleVersion(); }
        return Results.Ok(ToResponse(tenant));
    }

    private static async Task<IResult> ArchiveAsync(Guid id, ArchiveTenantRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var tenant = await db.Tenants.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        if (tenant is null) return Results.NotFound();
        if (input.Version is not { Length: 8 }) return Invalid("version", "Geçerli bir kayıt sürümü zorunludur.");
        if (tenant.ArchivedAtUtc is not null) return Results.NoContent();
        if (!tenant.Version.AsSpan().SequenceEqual(input.Version)) return StaleVersion();

        tenant.ArchivedAtUtc = DateTime.UtcNow;
        AddAudit(db, principal, accountId, tenant.Id, "TENANT", "ARCHIVED");
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return StaleVersion(); }
        return Results.NoContent();
    }

    internal static Dictionary<string, string[]> ValidateDetails(TenantDetails input)
    {
        var errors = new Dictionary<string, string[]>();
        var firstName = Clean(input.FirstName);
        var lastName = Clean(input.LastName);
        var companyName = Clean(input.CompanyName);
        if (input.Kind is null) errors["kind"] = ["Kiracı türü zorunludur."];
        if (input.Kind == TenantKind.PERSON)
        {
            if (firstName is null || firstName.Length > 100)
                errors["firstName"] = ["Ad 1 ile 100 karakter arasında olmalıdır."];
            if (lastName is null || lastName.Length > 100)
                errors["lastName"] = ["Soyad 1 ile 100 karakter arasında olmalıdır."];
            if (companyName is not null) errors["companyName"] = ["Şirket unvanı yalnızca şirket için girilir."];
        }
        if (input.Kind == TenantKind.COMPANY)
        {
            if (companyName is null || companyName.Length > 200)
                errors["companyName"] = ["Şirket unvanı 1 ile 200 karakter arasında olmalıdır."];
            if (firstName is not null) errors["firstName"] = ["Ad yalnızca kişi için girilir."];
            if (lastName is not null) errors["lastName"] = ["Soyad yalnızca kişi için girilir."];
        }
        if (Clean(input.Phone)?.Length > 32) errors["phone"] = ["Telefon en çok 32 karakter olmalıdır."];
        if (Clean(input.Email) is { } email && (email.Length > 256 || !new EmailAddressAttribute().IsValid(email)))
            errors["email"] = ["Geçerli bir e-posta adresi girin."];
        return errors;
    }

    private static void ApplyDetails(Tenant tenant, TenantDetails input)
    {
        tenant.Kind = input.Kind!.Value;
        tenant.FirstName = Clean(input.FirstName);
        tenant.LastName = Clean(input.LastName);
        tenant.CompanyName = Clean(input.CompanyName);
        tenant.Phone = Clean(input.Phone);
        tenant.Email = Clean(input.Email);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static IResult StaleVersion() => Results.Problem(statusCode: 409, title: "Kiracı değişti. Kaydı yenileyin.");

    private static TenantResponse ToResponse(Tenant tenant) =>
        new(tenant.Id, tenant.Kind, tenant.FirstName, tenant.LastName, tenant.CompanyName, tenant.Phone,
            tenant.Email, AsUtc(tenant.ArchivedAtUtc), tenant.Version);
}

public record TenantDetails([property: Required] TenantKind? Kind, string? FirstName, string? LastName,
    string? CompanyName, string? Phone, string? Email);
public sealed record UpdateTenantRequest(TenantKind? Kind, string? FirstName, string? LastName,
    string? CompanyName, string? Phone, string? Email, [property: Required] byte[] Version)
    : TenantDetails(Kind, FirstName, LastName, CompanyName, Phone, Email);
public sealed record ArchiveTenantRequest([property: Required] byte[] Version);
public sealed record TenantResponse(Guid Id, TenantKind Kind, string? FirstName, string? LastName,
    string? CompanyName, string? Phone, string? Email, DateTime? ArchivedAtUtc, byte[] Version);
public sealed record TenantPage(TenantResponse[] Items, int Page, int PageSize, bool HasMore);
