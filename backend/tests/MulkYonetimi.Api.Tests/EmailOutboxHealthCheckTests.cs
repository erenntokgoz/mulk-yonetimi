using MulkYonetimi.Api;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api.Tests;

public sealed class EmailOutboxHealthCheckTests
{
    private static readonly DateTime Now = new(2026, 11, 15, 12, 0, 0, DateTimeKind.Utc);

    private static OutboxMessage Message(string status, DateTime nextAttempt) => new()
    {
        Kind = "TEST",
        RecipientEmail = "a@example.com",
        ProtectedUrl = "x",
        Status = status,
        NextAttemptAtUtc = nextAttempt
    };

    [Fact]
    public void OldFailed_IsIgnored() =>
        Assert.Empty(EmailOutboxHealthCheck.RecentFailed(
            new[] { Message("FAILED", Now.AddDays(-3)) }.AsQueryable(), Now));

    [Fact]
    public void RecentFailed_IsReported() =>
        Assert.Single(EmailOutboxHealthCheck.RecentFailed(
            new[] { Message("FAILED", Now.AddHours(-2)) }.AsQueryable(), Now));

    [Fact]
    public void OverduePending_IsReported_FreshPendingIsNot()
    {
        var items = new[]
        {
            Message("PENDING", Now.AddMinutes(-30)),
            Message("PENDING", Now.AddMinutes(-2)),
            Message("SENT", Now.AddDays(-1))
        }.AsQueryable();
        Assert.Single(EmailOutboxHealthCheck.OverduePending(items, Now));
    }
}
