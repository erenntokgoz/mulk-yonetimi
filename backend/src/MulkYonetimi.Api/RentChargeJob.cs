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

internal sealed class RentChargeWorker(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<RentChargeWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("RentCharges:WorkerEnabled", true)) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<RentChargeJob>().GenerateAsync(RentRules.Today, stoppingToken);
            }
            catch (Exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("Kira alacağı üretimi başarısız oldu. Sonraki turda yeniden denenecek.");
            }
        }
    }
}
