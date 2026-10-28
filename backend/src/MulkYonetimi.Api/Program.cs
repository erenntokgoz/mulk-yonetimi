using System.Text.Json.Serialization;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using System.Net;
using MulkYonetimi.Api;
using MulkYonetimi.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
var keysPath = builder.Configuration["Auth:DataProtectionKeysPath"];
if (!builder.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(keysPath))
    throw new InvalidOperationException("Auth:DataProtectionKeysPath must be configured.");
if (!string.IsNullOrWhiteSpace(keysPath))
    builder.Services.AddDataProtection().SetApplicationName("MulkYonetimi")
        .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter<HealthStatus>(allowIntegerValues: false)));
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddIdentityCore<ApplicationUser>(options => options.SignIn.RequireConfirmedEmail = true)
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddCookie(IdentityConstants.ApplicationScheme, options =>
    {
        options.Cookie.Name = "mulk.session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events = new CookieAuthenticationEvents
        {
            OnValidatePrincipal = async context =>
            {
                var users = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
                var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                var stamp = context.Principal?.FindFirstValue(users.Options.ClaimsIdentity.SecurityStampClaimType);
                var user = userId is null ? null : await users.FindByIdAsync(userId);
                if (user is null || !user.EmailConfirmed || stamp is null ||
                    stamp != await users.GetSecurityStampAsync(user))
                    context.RejectPrincipal();
            },
            OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<AccountMembershipResolver>();
builder.Services.AddScoped<IConfirmationMailer, SmtpConfirmationMailer>();
builder.Services.AddScoped<EmailOutboxQueue>();
builder.Services.AddScoped<EmailOutboxDispatcher>();
builder.Services.AddHostedService<EmailOutboxWorker>();
var trustedProxies = builder.Configuration.GetSection("Network:KnownProxies").Get<string[]>() ?? [];
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    if (trustedProxies.Length == 0) return;
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownProxies.Clear();
    options.KnownIPNetworks.Clear();
    foreach (var proxy in trustedProxies)
    {
        if (!IPAddress.TryParse(proxy, out var address))
            throw new InvalidOperationException("Network:KnownProxies contains an invalid IP address.");
        options.KnownProxies.Add(address);
    }
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, _) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        return ValueTask.CompletedTask;
    };
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 25,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
});
builder.Services.AddHealthChecks().AddDbContextCheck<ApplicationDbContext>("sqlserver")
    .AddCheck<EmailOutboxHealthCheck>("outbox");

var app = builder.Build();
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health", async (HealthCheckService healthChecks, HttpContext context,
    CancellationToken cancellationToken) =>
{
    var report = await healthChecks.CheckHealthAsync(cancellationToken);
    var response = new HealthResponse(report.Status, report.Entries.Select(entry =>
        new HealthCheckResponse(entry.Key, entry.Value.Status,
            entry.Value.Duration.TotalMilliseconds, null)).ToArray());

    context.Response.Headers.CacheControl = "no-store";
    return Results.Json(response, statusCode: report.Status == HealthStatus.Unhealthy ? 503 : 200);
})
    .WithName("GetHealth")
    .Produces<HealthResponse>()
    .Produces<HealthResponse>(StatusCodes.Status503ServiceUnavailable);

app.MapGet("/api/v1/me", async (ClaimsPrincipal principal, AccountMembershipResolver resolver,
    HttpContext context, CancellationToken cancellationToken) =>
{
    context.Response.Headers.CacheControl = "no-store";
    var accountId = await resolver.ResolveAsync(principal, cancellationToken);
    return accountId is { } id ? Results.Ok(new MeResponse(id)) : Results.Forbid();
})
    .RequireAuthorization()
    .WithName("GetMe")
    .Produces<MeResponse>()
    .Produces(StatusCodes.Status401Unauthorized)
    .Produces(StatusCodes.Status403Forbidden);

app.MapPost("/api/v1/auth/login", async (LoginRequest input, HttpContext context,
    UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn,
    AccountMembershipResolver memberships, IConfiguration configuration) =>
{
    context.Response.Headers.CacheControl = "no-store";
    if (!AllowedOrigin(context, configuration)) return Results.Forbid();
    if (string.IsNullOrWhiteSpace(input.Email) || string.IsNullOrWhiteSpace(input.Password))
        return Results.BadRequest();

    var user = await users.FindByEmailAsync(input.Email.Trim());
    if (user is null || !(await signIn.CheckPasswordSignInAsync(user, input.Password, lockoutOnFailure: true)).Succeeded)
        return Results.Unauthorized();
    var principal = await signIn.CreateUserPrincipalAsync(user);
    if (await memberships.ResolveAsync(principal) is null) return Results.Forbid();

    await signIn.SignInAsync(user, isPersistent: false);
    return Results.NoContent();
})
    .WithName("Login")
    .RequireRateLimiting("auth")
    .Produces(StatusCodes.Status204NoContent)
    .Produces(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status401Unauthorized)
    .Produces(StatusCodes.Status403Forbidden);

app.MapPost("/api/v1/auth/logout", async (HttpContext context,
    SignInManager<ApplicationUser> signIn, IConfiguration configuration) =>
{
    context.Response.Headers.CacheControl = "no-store";
    if (!AllowedOrigin(context, configuration)) return Results.Forbid();
    await signIn.SignOutAsync();
    return Results.NoContent();
})
    .WithName("Logout")
    .RequireRateLimiting("auth")
    .Produces(StatusCodes.Status204NoContent)
    .Produces(StatusCodes.Status403Forbidden);

app.MapPost("/api/v1/auth/register", async (RegisterRequest input, HttpContext context,
    UserManager<ApplicationUser> users, ApplicationDbContext db, EmailOutboxQueue outbox,
    IConfiguration configuration, CancellationToken cancellationToken) =>
{
    context.Response.Headers.CacheControl = "no-store";
    if (!AllowedOrigin(context, configuration)) return Results.Forbid();
    if (string.IsNullOrWhiteSpace(configuration["Email:SmtpHost"]) ||
        string.IsNullOrWhiteSpace(configuration["Email:From"])) return Results.StatusCode(503);
    var email = input.Email?.Trim();
    var accountName = input.AccountName?.Trim();
    if (string.IsNullOrWhiteSpace(email) || email.Length > 256 || !new EmailAddressAttribute().IsValid(email) ||
        string.IsNullOrWhiteSpace(accountName) || accountName.Length > 200 ||
        string.IsNullOrWhiteSpace(input.Password)) return Results.BadRequest();
    if (await users.FindByEmailAsync(email) is not null) return Results.Accepted();

    await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
    var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = email, Email = email, LockoutEnabled = true };
    var result = await users.CreateAsync(user, input.Password);
    if (!result.Succeeded) return Results.BadRequest(new { errors = result.Errors.Select(error => error.Code) });

    var account = new Account { Id = Guid.NewGuid(), Name = accountName };
    db.Accounts.Add(account);
    db.AccountMembers.Add(new AccountMember { AccountId = account.Id, UserId = user.Id, Role = "OWNER", Status = "ACTIVE" });
    await db.SaveChangesAsync(cancellationToken);

    var token = await users.GenerateEmailConfirmationTokenAsync(user);
    var url = $"{configuration["Auth:FrontendOrigin"]}/dogrula?userId={user.Id}&token={Uri.EscapeDataString(token)}";
    outbox.Add(account.Id, "CONFIRM_EMAIL", email, url);
    await db.SaveChangesAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);
    return Results.Accepted();
})
    .WithName("Register")
    .RequireRateLimiting("auth")
    .Produces(StatusCodes.Status202Accepted)
    .Produces(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status403Forbidden)
    .Produces(StatusCodes.Status503ServiceUnavailable);

app.MapPost("/api/v1/auth/confirm-email", async (ConfirmEmailRequest input, HttpContext context,
    UserManager<ApplicationUser> users, IConfiguration configuration) =>
{
    context.Response.Headers.CacheControl = "no-store";
    if (!AllowedOrigin(context, configuration)) return Results.Forbid();
    var user = await users.FindByIdAsync(input.UserId.ToString());
    if (user is null || user.EmailConfirmed || string.IsNullOrWhiteSpace(input.Token)) return Results.BadRequest();
    var result = await users.ConfirmEmailAsync(user, input.Token);
    return result.Succeeded ? Results.NoContent() : Results.BadRequest();
})
    .WithName("ConfirmEmail")
    .RequireRateLimiting("auth")
    .Produces(StatusCodes.Status204NoContent)
    .Produces(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status403Forbidden);

app.MapPost("/api/v1/auth/resend-confirmation", async (EmailRequest input, HttpContext context,
    UserManager<ApplicationUser> users, ApplicationDbContext db, EmailOutboxQueue outbox, IConfiguration configuration,
    CancellationToken cancellationToken) =>
{
    context.Response.Headers.CacheControl = "no-store";
    if (!AllowedOrigin(context, configuration)) return Results.Forbid();
    if (string.IsNullOrWhiteSpace(configuration["Email:SmtpHost"]) ||
        string.IsNullOrWhiteSpace(configuration["Email:From"])) return Results.StatusCode(503);
    if (!ValidEmail(input.Email)) return Results.BadRequest();
    var user = await users.FindByEmailAsync(input.Email.Trim());
    if (user is { EmailConfirmed: false })
    {
        var accountIds = await (from member in db.AccountMembers
                                join account in db.Accounts on member.AccountId equals account.Id
                                where member.UserId == user.Id && member.Status == "ACTIVE" && account.Status == "ACTIVE"
                                select member.AccountId).Take(2).ToListAsync(cancellationToken);
        if (accountIds.Count != 1) return Results.Accepted();
        var token = await users.GenerateEmailConfirmationTokenAsync(user);
        var url = $"{configuration["Auth:FrontendOrigin"]}/dogrula?userId={user.Id}&token={Uri.EscapeDataString(token)}";
        outbox.Add(accountIds[0], "CONFIRM_EMAIL", user.Email!, url);
        await db.SaveChangesAsync(cancellationToken);
    }
    return Results.Accepted();
})
    .WithName("ResendConfirmation")
    .RequireRateLimiting("auth")
    .Produces(StatusCodes.Status202Accepted)
    .Produces(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status403Forbidden)
    .Produces(StatusCodes.Status503ServiceUnavailable);

app.MapPost("/api/v1/auth/forgot-password", async (EmailRequest input, HttpContext context,
    UserManager<ApplicationUser> users, ApplicationDbContext db, EmailOutboxQueue outbox, IConfiguration configuration,
    CancellationToken cancellationToken) =>
{
    context.Response.Headers.CacheControl = "no-store";
    if (!AllowedOrigin(context, configuration)) return Results.Forbid();
    if (string.IsNullOrWhiteSpace(configuration["Email:SmtpHost"]) ||
        string.IsNullOrWhiteSpace(configuration["Email:From"])) return Results.StatusCode(503);
    if (!ValidEmail(input.Email)) return Results.BadRequest();
    var user = await users.FindByEmailAsync(input.Email.Trim());
    if (user is { EmailConfirmed: true })
    {
        var accountIds = await (from member in db.AccountMembers
                                join account in db.Accounts on member.AccountId equals account.Id
                                where member.UserId == user.Id && member.Status == "ACTIVE" && account.Status == "ACTIVE"
                                select member.AccountId).Take(2).ToListAsync(cancellationToken);
        if (accountIds.Count != 1) return Results.Accepted();
        var token = await users.GeneratePasswordResetTokenAsync(user);
        var url = $"{configuration["Auth:FrontendOrigin"]}/parola-sifirla?userId={user.Id}&token={Uri.EscapeDataString(token)}";
        outbox.Add(accountIds[0], "RESET_PASSWORD", user.Email!, url);
        await db.SaveChangesAsync(cancellationToken);
    }
    return Results.Accepted();
})
    .WithName("ForgotPassword")
    .RequireRateLimiting("auth")
    .Produces(StatusCodes.Status202Accepted)
    .Produces(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status403Forbidden)
    .Produces(StatusCodes.Status503ServiceUnavailable);

app.MapPost("/api/v1/auth/reset-password", async (ResetPasswordRequest input, HttpContext context,
    UserManager<ApplicationUser> users, IConfiguration configuration) =>
{
    context.Response.Headers.CacheControl = "no-store";
    if (!AllowedOrigin(context, configuration)) return Results.Forbid();
    if (input.UserId == Guid.Empty || string.IsNullOrWhiteSpace(input.Token) ||
        string.IsNullOrWhiteSpace(input.Password)) return Results.BadRequest();
    var user = await users.FindByIdAsync(input.UserId.ToString());
    if (user is null || !user.EmailConfirmed) return Results.BadRequest();
    var result = await users.ResetPasswordAsync(user, input.Token, input.Password);
    return result.Succeeded ? Results.NoContent() : Results.BadRequest();
})
    .WithName("ResetPassword")
    .RequireRateLimiting("auth")
    .Produces(StatusCodes.Status204NoContent)
    .Produces(StatusCodes.Status400BadRequest)
    .Produces(StatusCodes.Status403Forbidden);

app.Run();

static bool AllowedOrigin(HttpContext context, IConfiguration configuration)
{
    var configured = configuration["Auth:FrontendOrigin"];
    return Uri.TryCreate(configured, UriKind.Absolute, out var allowed) &&
           (allowed.Scheme == Uri.UriSchemeHttp || allowed.Scheme == Uri.UriSchemeHttps) &&
           allowed.UserInfo.Length == 0 && allowed.AbsolutePath == "/" &&
           allowed.Query.Length == 0 && allowed.Fragment.Length == 0 &&
           context.Request.Headers.Origin == allowed.GetLeftPart(UriPartial.Authority);
}

static bool ValidEmail(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 256 &&
    new EmailAddressAttribute().IsValid(value);

public partial class Program;
