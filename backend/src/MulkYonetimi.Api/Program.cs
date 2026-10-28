using System.Text.Json.Serialization;
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
builder.Services.AddHealthChecks().AddDbContextCheck<ApplicationDbContext>("sqlserver");

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();

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

app.Run();

public partial class Program;
