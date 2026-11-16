using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

public sealed class RentChargeJob(ApplicationDbContext db)
{
    public async Task GenerateAsync(DateOnly through, CancellationToken ct)
    {
        var accountIds = await db.Leases.AsNoTracking()
            .Where(lease => lease.Status == LeaseStatus.ACTIVE && lease.StartDate <= through)
            .Select(lease => lease.AccountId).Distinct().ToArrayAsync(ct);
        foreach (var accountId in accountIds)
        {
            await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
            var leases = await db.Leases.AsNoTracking().Where(lease => lease.AccountId == accountId &&
                lease.Status == LeaseStatus.ACTIVE && lease.StartDate <= through).ToListAsync(ct);
            foreach (var lease in leases)
                await RentRules.AddMissingChargesAsync(db, lease, through, ct);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            db.ChangeTracker.Clear();
        }
    }
}

// Üretim kaçırılan dönemleri de ekler ve (AccountId, LeaseId, PeriodStart) tekil olduğu için tekrar çalışması
// çift alacak yazmaz; bu yüzden seyrek aralık ay sınırında dönem kaçırmaz.
internal sealed class RentChargeWorker(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<RentChargeWorker> logger) : BackgroundService
{
    internal static TimeSpan Interval(IConfiguration configuration) =>
        ScheduledJob.Hours(configuration, "Jobs:RentChargeHours", 12, 24);

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("RentCharges:WorkerEnabled", true)) return Task.CompletedTask;
        return ScheduledJob.RunAsync("Kira alacağı üretimi", Interval(configuration), async ct =>
        {
            await using var scope = scopes.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<RentChargeJob>().GenerateAsync(RentRules.Today, ct);
        }, logger, stoppingToken);
    }
}
