using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

internal static class GoogleSignInEndpoint
{
    public const string Provider = "Google";

    public static void MapGoogleSignIn(this WebApplication app) =>
        app.MapPost("/api/v1/auth/google", SignInAsync)
            .WithName("GoogleSignIn")
            .RequireRateLimiting("auth")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status409Conflict)
            .Produces(423)
            .Produces(StatusCodes.Status503ServiceUnavailable);

    private static async Task<IResult> SignInAsync(GoogleSignInRequest input, HttpContext context,
        IGoogleIdTokenValidator validator, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn,
        AccountMembershipResolver memberships, ApplicationDbContext db, IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!RequestOrigin.IsAllowed(context, configuration)) return Results.Forbid();
        var clientId = configuration["Auth:Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId)) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        if (string.IsNullOrWhiteSpace(input.IdToken) || input.IdToken.Length > 8192 ||
            string.IsNullOrWhiteSpace(input.Nonce) || input.Nonce.Length > 128) return Results.BadRequest();

        GoogleIdTokenClaims? claims;
        try
        {
            claims = await validator.ValidateAsync(input.IdToken, clientId, cancellationToken);
        }
        catch (GoogleKeysUnavailableException)
        {
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
        var identity = claims is null ? null : GoogleIdTokenRules.Accept(claims, clientId, input.Nonce, DateTime.UtcNow);
        if (identity is null) return Results.Unauthorized();

        ApplicationUser? user;
        try
        {
            user = await users.FindByLoginAsync(Provider, identity.Subject);
            if (user is null)
            {
                user = await LinkOrCreateAsync(identity, users, db, configuration, cancellationToken);
            }
            else if (!(await users.GetLoginsAsync(user)).Any(login =>
                login.LoginProvider == Provider && login.ProviderKey == identity.Subject))
            {
                // SQL collation can match a different subject. Google subject identifiers are case-sensitive.
                return GoogleLoginConflict();
            }
        }
        catch (Exception exception) when (exception is DbUpdateException or IdentityOperationException)
        {
            // Eşzamanlı ilk girişte tekil e-posta/giriş anahtarı ikinci kaydı reddeder; kullanıcı yeniden dener.
            return Results.BadRequest();
        }
        if (user is null) return GoogleLoginConflict();

        // Parola girişiyle aynı kapılar: kilit, doğrulanmış e-posta, pilot onayı ve tek etkin üyelik.
        if (await users.IsLockedOutAsync(user) || !await signIn.CanSignInAsync(user)) return Results.Unauthorized();
        var pending = await (from member in db.AccountMembers.AsNoTracking()
                             join account in db.Accounts.AsNoTracking() on member.AccountId equals account.Id
                             where member.UserId == user.Id && member.Role == "OWNER" && member.Status == "ACTIVE" &&
                                 account.Status == "PENDING"
                             select account.Id).AnyAsync(cancellationToken);
        if (pending) return Results.Problem(statusCode: 423, title: "Hesap pilot onayı bekliyor.");
        var principal = await signIn.CreateUserPrincipalAsync(user);
        if (await memberships.ResolveAsync(principal, cancellationToken) is null) return Results.Forbid();

        await signIn.SignInAsync(user, isPersistent: false);
        return Results.NoContent();
    }

    private static IResult GoogleLoginConflict() => Results.Problem(statusCode: StatusCodes.Status409Conflict,
        title: "Bu e-posta adresiyle Google girişi kullanılamıyor.");

    private static async Task<ApplicationUser?> LinkOrCreateAsync(GoogleIdentity identity,
        UserManager<ApplicationUser> users, ApplicationDbContext db, IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        if (!identity.EmailIsAuthoritative) return null;
        var login = new UserLoginInfo(Provider, identity.Subject, Provider);
        var existing = await users.FindByEmailAsync(identity.Email);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        if (existing is not null)
        {
            // AddLoginAsync updates the user's concurrency stamp, so two concurrent first links cannot both commit.
            if ((await users.GetLoginsAsync(existing)).Any(loginInfo => loginInfo.LoginProvider == Provider))
                return null;
            if (!existing.EmailConfirmed)
            {
                // Doğrulanmamış kayıt, adresin sahibi olmayan biri tarafından açılmış olabilir; Google sahipliği
                // kanıtladığı için o parola kaldırılır ve eski bağlantılar damga yenilenerek geçersiz kılınır.
                existing.EmailConfirmed = true;
                Require(await users.HasPasswordAsync(existing)
                    ? await users.RemovePasswordAsync(existing)
                    : await users.UpdateSecurityStampAsync(existing));
            }
            Require(await users.AddLoginAsync(existing, login));
            var accountIds = await db.AccountMembers.AsNoTracking()
                .Where(member => member.UserId == existing.Id && member.Role == "OWNER")
                .Select(member => member.AccountId).Take(2).ToArrayAsync(cancellationToken);
            if (accountIds.Length == 1)
                db.AuditEvents.Add(new AuditEvent
                {
                    Id = Guid.NewGuid(),
                    AccountId = accountIds[0],
                    ActorUserId = existing.Id,
                    EntityId = existing.Id,
                    EntityType = "USER",
                    Action = "EXTERNAL_LOGIN_LINKED",
                    OccurredAtUtc = DateTime.UtcNow,
                    CorrelationId = CorrelationContext.Current,
                    Reason = "GOOGLE"
                });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return existing;
        }

        var defaultUnitLimit = configuration.GetValue<int?>("Pilot:DefaultUnitLimit");
        if (defaultUnitLimit is < 1) throw new InvalidOperationException("Pilot:DefaultUnitLimit must be positive when set.");
        var name = identity.Name ?? identity.Email[..identity.Email.LastIndexOf('@')];
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = identity.Email,
            Email = identity.Email,
            EmailConfirmed = true,
            DisplayName = Truncate(identity.Name, 200),
            LockoutEnabled = true
        };
        Require(await users.CreateAsync(user));
        Require(await users.AddLoginAsync(user, login));
        var account = new Account { Id = Guid.NewGuid(), Name = Truncate(name, 200)!, Status = PilotAccess.NewAccountStatus(configuration) };
        db.Accounts.Add(account);
        db.AccountMembers.Add(new AccountMember { AccountId = account.Id, UserId = user.Id, Role = "OWNER", Status = "ACTIVE" });
        db.AccountPlans.Add(new AccountPlan { AccountId = account.Id, Code = "PILOT" });
        db.AccountEntitlements.Add(new AccountEntitlement
        {
            AccountId = account.Id,
            Code = "UNIT_LIMIT",
            LimitValue = defaultUnitLimit
        });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return user;
    }

    private static void Require(IdentityResult result)
    {
        if (!result.Succeeded)
            throw new IdentityOperationException(string.Join(",", result.Errors.Select(error => error.Code)));
    }

    private sealed class IdentityOperationException(string codes) : Exception(codes);

    private static string? Truncate(string? value, int length) =>
        value is null || value.Length <= length ? value : value[..length];
}
