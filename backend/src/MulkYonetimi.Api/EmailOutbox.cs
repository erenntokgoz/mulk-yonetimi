using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

public sealed class EmailOutboxQueue(ApplicationDbContext db, IDataProtectionProvider protection)
{
    private readonly IDataProtector protector = protection.CreateProtector("MulkYonetimi.EmailOutbox.v1");

    public void Add(Guid accountId, string kind, string recipientEmail, string url)
    {
        db.OutboxMessages.Add(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Kind = kind,
            RecipientEmail = recipientEmail,
            ProtectedUrl = protector.Protect(url),
            NextAttemptAtUtc = DateTime.UtcNow
        });
    }
}

public sealed class EmailOutboxDispatcher(ApplicationDbContext db, IDataProtectionProvider protection,
    IConfirmationMailer mailer, IConfiguration configuration, ILogger<EmailOutboxDispatcher> logger)
{
    private readonly IDataProtector protector = protection.CreateProtector("MulkYonetimi.EmailOutbox.v1");

    public async Task<int> DispatchOnceAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var ids = await db.OutboxMessages.AsNoTracking()
            .Where(item => (item.Status == "PENDING" && item.NextAttemptAtUtc <= now) ||
                (item.Status == "PROCESSING" && item.ClaimedUntilUtc < now))
            .OrderBy(item => item.NextAttemptAtUtc).Select(item => item.Id)
            .Take(20).ToListAsync(cancellationToken);
        var processed = 0;
        foreach (var id in ids)
        {
            var claimId = Guid.NewGuid();
            now = DateTime.UtcNow;
            var claimed = await db.OutboxMessages.Where(item => item.Id == id &&
                ((item.Status == "PENDING" && item.NextAttemptAtUtc <= now) ||
                 (item.Status == "PROCESSING" && item.ClaimedUntilUtc < now)))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(item => item.Status, "PROCESSING")
                    .SetProperty(item => item.ClaimId, claimId)
                    .SetProperty(item => item.ClaimedUntilUtc, now.AddMinutes(2)), cancellationToken);
            if (claimed != 1) continue;

            var message = await db.OutboxMessages.AsNoTracking().SingleAsync(item => item.Id == id, cancellationToken);
            try
            {
                using var sendTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                sendTimeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(configuration.GetValue("Email:SendTimeoutSeconds", 90), 1, 90)));
                var url = protector.Unprotect(message.ProtectedUrl);
                if (message.Kind == "CONFIRM_EMAIL")
                    await mailer.SendAsync(message.RecipientEmail, url, sendTimeout.Token);
                else if (message.Kind == "RESET_PASSWORD")
                    await mailer.SendPasswordResetAsync(message.RecipientEmail, url, sendTimeout.Token);
                else
                    throw new InvalidOperationException("Unknown outbox message kind.");

                await db.OutboxMessages.Where(item => item.Id == id && item.ClaimId == claimId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(item => item.Status, "SENT")
                        .SetProperty(item => item.SentAtUtc, DateTime.UtcNow)
                        .SetProperty(item => item.ClaimId, (Guid?)null)
                        .SetProperty(item => item.ClaimedUntilUtc, (DateTime?)null), cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                var attempts = message.AttemptCount + 1;
                var next = DateTime.UtcNow.AddMinutes(Math.Min(1 << Math.Min(attempts - 1, 4), 16));
                var status = attempts >= 5 ? "FAILED" : "PENDING";
                await db.OutboxMessages.Where(item => item.Id == id && item.ClaimId == claimId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(item => item.Status, status)
                        .SetProperty(item => item.AttemptCount, attempts)
                        .SetProperty(item => item.NextAttemptAtUtc, next)
                        .SetProperty(item => item.ClaimId, (Guid?)null)
                        .SetProperty(item => item.ClaimedUntilUtc, (DateTime?)null), cancellationToken);
                logger.LogWarning("Outbox delivery failed: MessageId={MessageId} Kind={Kind} Attempt={Attempt} Status={Status}",
                    id, message.Kind, attempts, status);
            }
            processed++;
        }
        return processed;
    }
}

public sealed class EmailOutboxHealthCheck(ApplicationDbContext db,
    ILogger<EmailOutboxHealthCheck> logger) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var failedCount = await db.OutboxMessages.CountAsync(item => item.Status == "FAILED", cancellationToken);
        if (failedCount == 0) return HealthCheckResult.Healthy();
        logger.LogWarning("Outbox has {FailedCount} failed messages.", failedCount);
        return HealthCheckResult.Degraded(data: new Dictionary<string, object> { ["failedCount"] = failedCount });
    }
}

public sealed class EmailOutboxWorker(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<EmailOutboxWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Email:WorkerEnabled", true)) return;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<EmailOutboxDispatcher>()
                    .DispatchOnceAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning("E-posta outbox işleyicisi başarısız oldu; bir sonraki turda tekrar denenecek.");
            }
        }
    }
}
