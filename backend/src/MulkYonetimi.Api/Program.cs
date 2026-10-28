using System.Text.Json.Serialization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using MulkYonetimi.Api;
using MulkYonetimi.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter<HealthStatus>(allowIntegerValues: false)));
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddIdentityCore<ApplicationUser>(options => options.SignIn.RequireConfirmedEmail = true)
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddSignInManager();
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
builder.Services.AddHealthChecks().AddDbContextCheck<ApplicationDbContext>("sqlserver");

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
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

app.Run();

public partial class Program;
