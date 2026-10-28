using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Options;

namespace MulkYonetimi.Api.Tests;

public sealed class FoundationTests
{
    [Fact]
    public void Forwarded_headers_trust_only_explicit_proxy_addresses()
    {
        using var directFactory = new WebApplicationFactory<Program>();
        var directOptions = directFactory.Services.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;
        Assert.Equal(ForwardedHeaders.None, directOptions.ForwardedHeaders);

        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.UseSetting("Network:KnownProxies:0", "10.20.30.40"));
        var options = factory.Services.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;
        Assert.Single(options.KnownProxies);
        Assert.Contains(IPAddress.Parse("10.20.30.40"), options.KnownProxies);
        Assert.Empty(options.KnownIPNetworks);
        Assert.Equal(1, options.ForwardLimit);
    }

    [Theory]
    [InlineData(HealthStatus.Healthy, HttpStatusCode.OK, "Healthy")]
    [InlineData(HealthStatus.Degraded, HttpStatusCode.OK, "Degraded")]
    [InlineData(HealthStatus.Unhealthy, HttpStatusCode.ServiceUnavailable, "Unhealthy")]
    public async Task Health_reflects_sql_server_status_without_exposing_details(
        HealthStatus databaseStatus, HttpStatusCode expectedCode, string expectedStatus)
    {
        using var factory = CreateFactory(databaseStatus);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health");

        Assert.Equal(expectedCode, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(body);
        Assert.Equal(expectedStatus, json.RootElement.GetProperty("status").GetString());
        var check = Assert.Single(json.RootElement.GetProperty("checks").EnumerateArray());
        Assert.Equal("sqlserver", check.GetProperty("name").GetString());
        Assert.Equal(expectedStatus, check.GetProperty("status").GetString());
        Assert.True(check.GetProperty("durationMs").GetDouble() >= 0);
        Assert.Equal(JsonValueKind.Null, check.GetProperty("description").ValueKind);
        Assert.DoesNotContain("private-database-details", body);
        Assert.Contains("no-store", response.Headers.CacheControl?.ToString() ?? "");
    }

    [Fact]
    public async Task Health_is_unhealthy_without_a_configured_database()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.UseSetting("ConnectionStrings:DefaultConnection", ""));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var check = json.RootElement.GetProperty("checks").EnumerateArray()
            .Single(item => item.GetProperty("name").GetString() == "sqlserver");
        Assert.Equal("sqlserver", check.GetProperty("name").GetString());
        Assert.Equal("Unhealthy", check.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Unknown_route_returns_problem_details()
    {
        using var factory = CreateFactory(HealthStatus.Healthy);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/missing");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(404, json.RootElement.GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task Me_requires_an_authenticated_session_without_redirecting()
    {
        using var factory = CreateFactory(HealthStatus.Healthy);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        using var response = await client.GetAsync("/api/v1/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    [Fact]
    public async Task Development_openapi_describes_health_contract()
    {
        using var factory = CreateFactory(HealthStatus.Healthy);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var responses = json.RootElement.GetProperty("paths").GetProperty("/health").GetProperty("get").GetProperty("responses");
        Assert.True(responses.TryGetProperty("200", out _));
        Assert.True(responses.TryGetProperty("503", out _));
        foreach (var code in new[] { "200", "503" })
        {
            var schema = ResolveSchema(json.RootElement,
                responses.GetProperty(code).GetProperty("content").GetProperty("application/json").GetProperty("schema"));
            var properties = schema.GetProperty("properties");
            AssertHealthStatusSchema(json.RootElement, properties.GetProperty("status"));
            var checks = properties.GetProperty("checks");
            Assert.Equal("array", checks.GetProperty("type").GetString());
            var checkProperties = ResolveSchema(json.RootElement, checks.GetProperty("items")).GetProperty("properties");
            Assert.Equal("string", checkProperties.GetProperty("name").GetProperty("type").GetString());
            AssertHealthStatusSchema(json.RootElement, checkProperties.GetProperty("status"));
            var durationType = checkProperties.GetProperty("durationMs").GetProperty("type");
            Assert.Contains("number", durationType.ValueKind == JsonValueKind.Array
                ? durationType.EnumerateArray().Select(type => type.GetString())
                : [durationType.GetString()]);
            Assert.Equal("double", checkProperties.GetProperty("durationMs").GetProperty("format").GetString());
            Assert.Equal(new[] { "null", "string" }, checkProperties.GetProperty("description")
                .GetProperty("type").EnumerateArray().Select(type => type.GetString()).Order());
        }
    }

    private static JsonElement ResolveSchema(JsonElement document, JsonElement schema) =>
        schema.TryGetProperty("$ref", out var reference)
            ? document.GetProperty("components").GetProperty("schemas").GetProperty(reference.GetString()!.Split('/')[^1])
            : schema;

    private static void AssertHealthStatusSchema(JsonElement document, JsonElement schema)
    {
        var status = ResolveSchema(document, schema);
        Assert.True(status.TryGetProperty("enum", out var allowedValues), "Health status must declare its allowed values.");
        Assert.Equal(new[] { "Degraded", "Healthy", "Unhealthy" }, allowedValues
            .EnumerateArray().Select(value => value.GetString()).Order());
    }

    private static WebApplicationFactory<Program> CreateFactory(HealthStatus status) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.ConfigureServices(services => services.Configure<HealthCheckServiceOptions>(options =>
            {
                options.Registrations.Clear();
                options.Registrations.Add(new HealthCheckRegistration("sqlserver",
                    new FixedDatabaseHealthCheck(status), HealthStatus.Unhealthy, null));
            }));
        });

    private sealed class FixedDatabaseHealthCheck(HealthStatus status) : IHealthCheck
    {
        public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new HealthCheckResult(status, "private-database-details"));
    }
}
