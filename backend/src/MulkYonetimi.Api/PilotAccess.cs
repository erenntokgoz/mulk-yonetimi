using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class PilotAccess
{
    public static async Task<IResult?> CheckUnitQuotaAsync(ApplicationDbContext db, Guid accountId, CancellationToken ct)
    {
        var limit = await db.AccountEntitlements.AsNoTracking()
            .Where(item => item.AccountId == accountId && item.Code == "UNIT_LIMIT")
            .Select(item => item.LimitValue).SingleOrDefaultAsync(ct);
        if (limit is not { } maximum) return null;
        var used = await (from unit in db.Units
                          join property in db.Properties on new { unit.AccountId, Id = unit.PropertyId }
                              equals new { property.AccountId, property.Id }
                          where unit.AccountId == accountId && unit.ArchivedAtUtc == null &&
                              property.ArchivedAtUtc == null
                          select unit.Id).CountAsync(ct);
        return used >= maximum ? Results.Problem(statusCode: 409, title: "Birim kotası doldu.") : null;
    }

    public static void MapPilotEndpoints(this WebApplication app)
    {
        var group = app.MapPortfolioGroup("/api/v1/admin/accounts");
        group.MapGet("/pending", ListPendingAsync).WithName("ListPendingPilotAccounts")
            .Produces<PilotPendingAccountResponse[]>().Produces(StatusCodes.Status403Forbidden);
        group
            .MapPost("/{id:guid}/activate", ActivateAsync).WithName("ActivatePilotAccount")
            .Produces(204).ProducesProblem(403).ProducesProblem(404).ProducesProblem(409);
    }

    private static async Task<IResult> ListPendingAsync(HttpContext context, ClaimsPrincipal principal,
        IConfiguration configuration, ApplicationDbContext db, CancellationToken ct)
    {
        if (!IsOperator(context, principal, configuration)) return Results.Forbid();
        var rows = await (from account in db.Accounts.AsNoTracking()
                          join member in db.AccountMembers.AsNoTracking() on account.Id equals member.AccountId
                          join user in db.Users.AsNoTracking() on member.UserId equals user.Id
                          where account.Status == "PENDING" && member.Role == "OWNER" && member.Status == "ACTIVE"
                          orderby account.CreatedAtUtc, account.Id
                          select new PilotPendingAccountResponse(account.Id, account.Name, account.CreatedAtUtc,
                              user.EmailConfirmed))
            .ToArrayAsync(ct);
        return Results.Ok(rows);
    }

    private static async Task<IResult> ActivateAsync(Guid id, HttpContext context, ClaimsPrincipal principal,
        IConfiguration configuration, ApplicationDbContext db, CancellationToken ct)
    {
        if (!IsOperator(context, principal, configuration)) return Results.Forbid();
        if (!await db.Accounts.AnyAsync(item => item.Id == id, ct)) return Results.NotFound();
        await using var transaction = await RentRules.LockAccountAsync(db, id, ct);
        var account = await db.Accounts.SingleAsync(item => item.Id == id, ct);
        if (account.Status == "ACTIVE") return Results.NoContent();
        if (account.Status != "PENDING") return Results.Problem(statusCode: 409, title: "Hesap etkinleştirilemez.");
        if (!await (from member in db.AccountMembers
                    join user in db.Users on member.UserId equals user.Id
                    where member.AccountId == id && member.Role == "OWNER" && member.Status == "ACTIVE" &&
                        user.EmailConfirmed
                    select user.Id).AnyAsync(ct))
            return Results.Problem(statusCode: 409, title: "Hesap sahibinin e-postası doğrulanmadı.");
        account.Status = "ACTIVE";
        AddAudit(db, principal, id, id, "ACCOUNT", "ACTIVATED", "PILOT_APPROVAL");
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.NoContent();
    }

    internal static bool ValidAdminKey(string supplied, string? configured) =>
        configured is { Length: >= 32 } && supplied.Length == configured.Length &&
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(supplied), Encoding.UTF8.GetBytes(configured));

    private static bool IsOperator(HttpContext context, ClaimsPrincipal principal, IConfiguration configuration) =>
        Guid.TryParse(configuration["Pilot:AdminUserId"], out var adminId) &&
        Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var actorId) && actorId == adminId &&
        ValidAdminKey(context.Request.Headers["X-Pilot-Admin-Key"].ToString(), configuration["Pilot:AdminKey"]);
}

public sealed record PilotPendingAccountResponse(Guid Id, string Name, DateTime CreatedAtUtc, bool OwnerEmailConfirmed);
