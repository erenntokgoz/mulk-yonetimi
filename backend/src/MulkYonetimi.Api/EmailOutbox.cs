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

    public void AddNotification(Guid accountId, Guid userId, string eventKey, string notificationType,
        string recipientEmail, string subject, string body)
    {
        db.OutboxMessages.Add(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            UserId = userId,
            EventKey = $"notification:{userId}:{eventKey}",
            NotificationType = notificationType,
            Kind = "NOTIFICATION",
            RecipientEmail = recipientEmail,
            Subject = subject,
            ProtectedUrl = protector.Protect(body),
            NextAttemptAtUtc = DateTime.UtcNow
        });
    }
}

public interface IEmailOutboxDispatcher
{
    Task<int> DispatchOnceAsync(CancellationToken cancellationToken);

    // Bekleyen iş yoksa null döner; işleyici o durumda yalnız seyrek güvenlik taramasında uyanır.
    Task<DateTime?> NextAttemptAtUtcAsync(CancellationToken cancellationToken);
}

public sealed class EmailOutboxDispatcher(ApplicationDbContext db, IDataProtectionProvider protection,
    IConfirmationMailer mailer, IConfiguration configuration, ILogger<EmailOutboxDispatcher> logger)
    : IEmailOutboxDispatcher
{
    public const int BatchSize = 20;

    private readonly IDataProtector protector = protection.CreateProtector("MulkYonetimi.EmailOutbox.v1");

    public async Task<DateTime?> NextAttemptAtUtcAsync(CancellationToken cancellationToken)
    {
        var pending = await db.OutboxMessages.AsNoTracking().Where(item => item.Status == "PENDING")
            .MinAsync(item => (DateTime?)item.NextAttemptAtUtc, cancellationToken);
        var reclaimable = await db.OutboxMessages.AsNoTracking().Where(item => item.Status == "PROCESSING")
            .MinAsync(item => item.ClaimedUntilUtc, cancellationToken);
        if (pending is null) return reclaimable;
        if (reclaimable is null) return pending;
        return pending < reclaimable ? pending : reclaimable;
    }

    public async Task<int> DispatchOnceAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var ids = await db.OutboxMessages.AsNoTracking()
            .Where(item => (item.Status == "PENDING" && item.NextAttemptAtUtc <= now) ||
                (item.Status == "PROCESSING" && item.ClaimedUntilUtc < now))
            .OrderBy(item => item.NextAttemptAtUtc).Select(item => item.Id)
            .Take(BatchSize).ToListAsync(cancellationToken);
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
                else if (message.Kind == "NOTIFICATION" && message.UserId is { } userId &&
                    message.Subject is { } subject && message.NotificationType is { } notificationType)
                {
                    var preferences = await db.NotificationPreferences.AsNoTracking().SingleOrDefaultAsync(item =>
                        item.AccountId == message.AccountId && item.UserId == userId, cancellationToken);
                    var enabled = preferences is not null && preferences.EmailEnabled &&
                        IsEmailEnabledForType(preferences, notificationType);
                    var confirmed = await db.Users.AsNoTracking().AnyAsync(item =>
                        item.Id == userId && item.EmailConfirmed, cancellationToken);
                    if (!enabled || !confirmed)
                    {
                        await db.OutboxMessages.Where(item => item.Id == id && item.ClaimId == claimId)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(item => item.Status, "CANCELLED")
                                .SetProperty(item => item.ClaimId, (Guid?)null)
                                .SetProperty(item => item.ClaimedUntilUtc, (DateTime?)null), cancellationToken);
                        processed++;
                        continue;
                    }
                    await mailer.SendNotificationAsync(message.RecipientEmail, subject, url, sendTimeout.Token);
                }
                else
                    throw new InvalidOperationException("Unknown outbox message kind.");

                await db.OutboxMessages.Where(item => item.Id == id && item.ClaimId == claimId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(item => item.Status, "SENT")
                        .SetProperty(item => item.SentAtUtc, DateTime.UtcNow)
                        .SetProperty(item => item.ClaimId, (Guid?)null)
                        .SetProperty(item => item.ClaimedUntilUtc, (DateTime?)null), cancellationToken);
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
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
                logger.LogWarning("Outbox delivery failed: MessageId={MessageId} Kind={Kind} Attempt={Attempt} Status={Status} Error={ErrorType}: {ErrorMessage}",
                    id, message.Kind, attempts, status, exception.GetType().Name, exception.Message);
            }
            processed++;
        }
        return processed;
    }

    private static bool IsEmailEnabledForType(NotificationPreference preferences, string type) => type switch
    {
        "RENT_DUE" => preferences.RentDueEnabled,
        "OVERDUE_RENT" => preferences.OverdueRentEnabled,
        "LEASE_END" => preferences.LeaseEndEnabled,
        "RENT_ANNIVERSARY" => preferences.RentAnniversaryEnabled,
        _ => false
    };
}

public sealed class EmailOutboxHealthCheck(ApplicationDbContext db,
    ILogger<EmailOutboxHealthCheck> logger) : IHealthCheck
{
    public static readonly TimeSpan FailedWindow = TimeSpan.FromHours(24);
    public static readonly TimeSpan PendingOverdueAfter = TimeSpan.FromMinutes(15);

    public static IQueryable<OutboxMessage> RecentFailed(IQueryable<OutboxMessage> source, DateTime nowUtc)
    {
        var since = nowUtc - FailedWindow;
        return source.Where(item => item.Status == "FAILED" && item.NextAttemptAtUtc >= since);
    }

    public static IQueryable<OutboxMessage> OverduePending(IQueryable<OutboxMessage> source, DateTime nowUtc)
    {
        var overdueBefore = nowUtc - PendingOverdueAfter;
        return source.Where(item => item.Status == "PENDING" && item.NextAttemptAtUtc < overdueBefore);
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var failedCount = await RecentFailed(db.OutboxMessages, now).CountAsync(cancellationToken);
        var overdueCount = await OverduePending(db.OutboxMessages, now).CountAsync(cancellationToken);
        if (failedCount == 0 && overdueCount == 0) return HealthCheckResult.Healthy();
        logger.LogWarning("Outbox has {FailedCount} recent failed and {OverdueCount} overdue messages.",
            failedCount, overdueCount);
        return HealthCheckResult.Degraded(data: new Dictionary<string, object>
        {
            ["failedCount"] = failedCount,
            ["overdueCount"] = overdueCount
        });
    }
}

// Azure SQL serverless ücretsiz katmanı yalnız oturum ve CPU sıfırken duraklar (ADR 013). Bu yüzden işleyici
// sabit aralıkla sorgu atmaz: istekler kayıt eklediğinde sinyalle uyanır, tekrar denemeler için en erken zamanı
// bekler ve kaza/çökme kurtarması için yalnız seyrek bir güvenlik taraması yapar.
public sealed class EmailOutboxWorker(IServiceScopeFactory scopes, EmailOutboxSignal signal,
    IConfiguration configuration, ILogger<EmailOutboxWorker> logger) : BackgroundService
{
    internal static readonly TimeSpan MinimumRetryGap = TimeSpan.FromMinutes(5);
    private const int MaxBatchesPerWake = 50;

    internal static TimeSpan SweepInterval(IConfiguration configuration) =>
        TimeSpan.FromMinutes(Math.Clamp(configuration.GetValue("Jobs:OutboxSweepMinutes", 360), 5, 1440));

    // Tekrar denemesi süpürmeden önceyse o zamana kadar beklenir; ama son turdan en az MinimumRetryGap sonra.
    internal static TimeSpan NextDelay(DateTime nowUtc, DateTime nextSweepUtc, DateTime? nextAttemptUtc)
    {
        var wakeUtc = nextSweepUtc;
        if (nextAttemptUtc is { } attempt)
        {
            var earliest = nowUtc + MinimumRetryGap;
            var retryUtc = attempt < earliest ? earliest : attempt;
            if (retryUtc < wakeUtc) wakeUtc = retryUtc;
        }
        var delay = wakeUtc - nowUtc;
        return delay < TimeSpan.Zero ? TimeSpan.Zero : delay;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Email:WorkerEnabled", true)) return;
        var sweep = SweepInterval(configuration);
        // Açılışta bir tur: önceki süreçte kalmış bekleyen veya sahiplenilmiş kayıtlar kurtarılır.
        var nextSweepUtc = DateTime.UtcNow;
        DateTime? nextAttemptUtc = null;
        var failures = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await signal.WaitAsync(NextDelay(DateTime.UtcNow, nextSweepUtc, nextAttemptUtc), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            if (DateTime.UtcNow >= nextSweepUtc) nextSweepUtc = DateTime.UtcNow + sweep;
            try
            {
                nextAttemptUtc = await DrainAsync(stoppingToken);
                failures = 0;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception)
            {
                failures++;
                var retry = ScheduledJob.RetryDelay(failures, sweep);
                nextAttemptUtc = DateTime.UtcNow + retry;
                logger.LogWarning("E-posta outbox işleyicisi başarısız oldu; {RetryMinutes} dakika sonra tekrar denenecek.",
                    (int)retry.TotalMinutes);
            }
        }
    }

    private async Task<DateTime?> DrainAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IEmailOutboxDispatcher>();
        for (var batch = 0; batch < MaxBatchesPerWake; batch++)
            if (await dispatcher.DispatchOnceAsync(cancellationToken) < EmailOutboxDispatcher.BatchSize) break;
        return await dispatcher.NextAttemptAtUtcAsync(cancellationToken);
    }
}
