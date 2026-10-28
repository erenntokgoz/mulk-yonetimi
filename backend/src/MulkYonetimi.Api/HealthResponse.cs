using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace MulkYonetimi.Api;

public sealed record HealthResponse(HealthStatus Status, IReadOnlyList<HealthCheckResponse> Checks);

public sealed record HealthCheckResponse(string Name, HealthStatus Status, double DurationMs, string? Description);
