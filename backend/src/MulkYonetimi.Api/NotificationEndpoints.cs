using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

public sealed record NotificationItem(Guid Id, string Type, string Title, string Message,
    DateTime CreatedAtUtc, DateTime? ReadAtUtc);
public sealed record NotificationPage(IReadOnlyList<NotificationItem> Items, int Page, int PageSize, bool HasMore);

internal static class NotificationEndpoints
{
    public static void MapNotificationEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/notifications").RequireAuthorization()
            .AddEndpointFilter(async (invocation, next) =>
            {
                var context = invocation.HttpContext;
                context.Response.Headers.CacheControl = "no-store";
                if (!HttpMethods.IsGet(context.Request.Method) &&
                    !RequestOrigin.IsAllowed(context, app.Configuration))
                    return Results.Forbid();
                return await next(invocation);
            });

        group.MapGet("", ListAsync).WithName("ListNotifications")
            .Produces<NotificationPage>().ProducesValidationProblem()
            .Produces(StatusCodes.Status401Unauthorized).Produces(StatusCodes.Status403Forbidden);
        group.MapPatch("/{id:guid}/read", MarkReadAsync).WithName("MarkNotificationRead")
            .Produces(StatusCodes.Status204NoContent).ProducesProblem(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status401Unauthorized).Produces(StatusCodes.Status403Forbidden);
        group.MapPost("/read-all", MarkAllReadAsync).WithName("MarkAllNotificationsRead")
            .Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden);
    }

    private static async Task<IResult> ListAsync(ClaimsPrincipal principal, AccountMembershipResolver resolver,
        ApplicationDbContext db, CancellationToken ct, int page = 1, int pageSize = 25, bool unreadOnly = false)
    {
        if (PortfolioAccess.ValidatePage(page, pageSize) is { } invalid) return invalid;
        if (await resolver.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var userId = UserId(principal);
        var query = db.Notifications.AsNoTracking()
            .Where(item => item.AccountId == accountId && item.UserId == userId);
        if (unreadOnly) query = query.Where(item => item.ReadAtUtc == null);
        var rows = await query.OrderByDescending(item => item.CreatedAtUtc).ThenBy(item => item.Id)
            .Skip((page - 1) * pageSize).Take(pageSize + 1).ToListAsync(ct);
        var items = rows.Select(item => new NotificationItem(item.Id, item.Type, item.Title, item.Message,
            DateTime.SpecifyKind(item.CreatedAtUtc, DateTimeKind.Utc),
            item.ReadAtUtc is { } readAt ? DateTime.SpecifyKind(readAt, DateTimeKind.Utc) : null)).ToList();
        var hasMore = items.Count > pageSize;
        if (hasMore) items.RemoveAt(items.Count - 1);
        return Results.Ok(new NotificationPage(items, page, pageSize, hasMore));
    }

    private static async Task<IResult> MarkReadAsync(Guid id, ClaimsPrincipal principal,
        AccountMembershipResolver resolver, ApplicationDbContext db, CancellationToken ct)
    {
        if (await resolver.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var notification = await db.Notifications.SingleOrDefaultAsync(item =>
            item.AccountId == accountId && item.UserId == UserId(principal) && item.Id == id, ct);
        if (notification is null) return Results.NotFound();
        notification.ReadAtUtc ??= DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> MarkAllReadAsync(ClaimsPrincipal principal,
        AccountMembershipResolver resolver, ApplicationDbContext db, CancellationToken ct)
    {
        if (await resolver.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await db.Notifications.Where(item => item.AccountId == accountId && item.UserId == UserId(principal) &&
            item.ReadAtUtc == null).ExecuteUpdateAsync(setters => setters
                .SetProperty(item => item.ReadAtUtc, DateTime.UtcNow), ct);
        return Results.NoContent();
    }

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
