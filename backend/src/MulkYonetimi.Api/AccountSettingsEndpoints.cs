using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

public sealed record ProfileUpdate(string? DisplayName);
public sealed record ProfileResponse(string? DisplayName, string? Email, bool EmailConfirmed);
public sealed record NotificationPreferenceUpdate(bool EmailEnabled, bool RentDueEnabled,
    bool OverdueRentEnabled, bool LeaseEndEnabled, bool RentAnniversaryEnabled);
public sealed record NotificationPreferenceResponse(bool EmailEnabled, bool RentDueEnabled,
    bool OverdueRentEnabled, bool LeaseEndEnabled, bool RentAnniversaryEnabled);

public static class AccountSettingsEndpoints
{
    public static void MapAccountSettingsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/me").RequireAuthorization()
            .AddEndpointFilter(async (invocation, next) =>
            {
                var context = invocation.HttpContext;
                context.Response.Headers.CacheControl = "no-store";
                if (!HttpMethods.IsGet(context.Request.Method) &&
                    !RequestOrigin.IsAllowed(context, app.Configuration))
                    return Results.Forbid();
                return await next(invocation);
            });

        group.MapGet("/profile", GetProfileAsync).WithName("GetProfile")
            .Produces<ProfileResponse>().Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden);
        group.MapPut("/profile", UpdateProfileAsync).WithName("UpdateProfile")
            .Produces<ProfileResponse>().ProducesValidationProblem()
            .Produces(StatusCodes.Status401Unauthorized).Produces(StatusCodes.Status403Forbidden);
        group.MapGet("/notification-preferences", GetPreferencesAsync).WithName("GetNotificationPreferences")
            .Produces<NotificationPreferenceResponse>().Produces(StatusCodes.Status401Unauthorized);
        group.MapPut("/notification-preferences", UpdatePreferencesAsync).WithName("UpdateNotificationPreferences")
            .Produces<NotificationPreferenceResponse>().ProducesValidationProblem()
            .Produces(StatusCodes.Status401Unauthorized).Produces(StatusCodes.Status403Forbidden);
    }

    private static async Task<IResult> GetProfileAsync(ClaimsPrincipal principal,
        AccountMembershipResolver resolver, ApplicationDbContext db, CancellationToken ct)
    {
        if (await resolver.ResolveAsync(principal, ct) is null) return Results.Forbid();
        var user = await CurrentUserAsync(principal, db, ct);
        return user is null ? Results.Forbid() : Results.Ok(ToProfile(user));
    }

    private static async Task<IResult> UpdateProfileAsync(ProfileUpdate input, HttpContext context,
        AccountMembershipResolver resolver, ApplicationDbContext db, CancellationToken ct)
    {
        if (await resolver.ResolveAsync(context.User, ct) is null) return Results.Forbid();
        var name = input.DisplayName?.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 200)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["displayName"] = ["Ad 1 ile 200 karakter arasında olmalıdır."] });
        var user = await CurrentUserAsync(context.User, db, ct);
        if (user is null) return Results.Forbid();
        user.DisplayName = name;
        await db.SaveChangesAsync(ct);
        return Results.Ok(ToProfile(user));
    }

    private static async Task<IResult> GetPreferencesAsync(ClaimsPrincipal principal,
        AccountMembershipResolver resolver, ApplicationDbContext db, CancellationToken ct)
    {
        var accountId = await resolver.ResolveAsync(principal, ct);
        if (accountId is null) return Results.Forbid();
        var userId = UserId(principal);
        var preferences = await db.NotificationPreferences.AsNoTracking()
            .SingleOrDefaultAsync(item => item.AccountId == accountId && item.UserId == userId, ct);
        return Results.Ok(ToPreferences(preferences ?? new NotificationPreference
        {
            AccountId = accountId.Value,
            UserId = userId
        }));
    }

    private static async Task<IResult> UpdatePreferencesAsync(NotificationPreferenceUpdate input,
        HttpContext context, AccountMembershipResolver resolver, ApplicationDbContext db, CancellationToken ct)
    {
        var accountId = await resolver.ResolveAsync(context.User, ct);
        if (accountId is null) return Results.Forbid();
        var userId = UserId(context.User);
        var user = await db.Users.SingleOrDefaultAsync(item => item.Id == userId, ct);
        if (user is null) return Results.Forbid();
        if (input.EmailEnabled && !user.EmailConfirmed)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["emailEnabled"] = ["E-posta bildirimleri için adres doğrulanmalıdır."] });
        var preferences = await db.NotificationPreferences.SingleOrDefaultAsync(
            item => item.AccountId == accountId && item.UserId == userId, ct);
        if (preferences is null)
        {
            preferences = new NotificationPreference { AccountId = accountId.Value, UserId = userId };
            db.NotificationPreferences.Add(preferences);
        }
        preferences.EmailEnabled = input.EmailEnabled;
        preferences.RentDueEnabled = input.RentDueEnabled;
        preferences.OverdueRentEnabled = input.OverdueRentEnabled;
        preferences.LeaseEndEnabled = input.LeaseEndEnabled;
        preferences.RentAnniversaryEnabled = input.RentAnniversaryEnabled;
        await db.SaveChangesAsync(ct);
        return Results.Ok(ToPreferences(preferences));
    }

    private static Task<ApplicationUser?> CurrentUserAsync(ClaimsPrincipal principal,
        ApplicationDbContext db, CancellationToken ct) =>
        db.Users.SingleOrDefaultAsync(item => item.Id == UserId(principal), ct);

    private static Guid UserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private static ProfileResponse ToProfile(ApplicationUser user) =>
        new(user.DisplayName, user.Email, user.EmailConfirmed);

    private static NotificationPreferenceResponse ToPreferences(NotificationPreference preferences) =>
        new(preferences.EmailEnabled, preferences.RentDueEnabled, preferences.OverdueRentEnabled,
            preferences.LeaseEndEnabled, preferences.RentAnniversaryEnabled);
}
