using System.Security.Claims;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

internal static class PortfolioAccess
{
    public static RouteGroupBuilder MapPortfolioGroup(this WebApplication app, string path) =>
        app.MapGroup(path).RequireAuthorization()
            .AddEndpointFilter(async (invocation, next) =>
            {
                var context = invocation.HttpContext;
                context.Response.Headers.CacheControl = "no-store";
                if (!HttpMethods.IsGet(context.Request.Method) &&
                    !RequestOrigin.IsAllowed(context, app.Configuration))
                    return Results.Forbid();
                return await next(invocation);
            });

    public static void AddAudit(ApplicationDbContext db, ClaimsPrincipal principal, Guid accountId,
        Guid entityId, string entityType, string action) =>
        db.AuditEvents.Add(new AuditEvent
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            ActorUserId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!),
            EntityId = entityId,
            EntityType = entityType,
            Action = action,
            OccurredAtUtc = DateTime.UtcNow
        });

    public static IResult? ValidatePage(int page, int size)
    {
        if (page is < 1 or > 100_000) return Invalid("page", "Sayfa 1 ile 100000 arasında olmalıdır.");
        if (size is < 1 or > 100) return Invalid("pageSize", "Sayfa boyutu 1 ile 100 arasında olmalıdır.");
        return null;
    }

    public static IResult Invalid(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    public static DateTime? AsUtc(DateTime? value) =>
        value is { } date ? DateTime.SpecifyKind(date, DateTimeKind.Utc) : null;
}
