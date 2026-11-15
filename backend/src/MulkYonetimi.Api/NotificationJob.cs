using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

public sealed class NotificationJob(ApplicationDbContext db, EmailOutboxQueue outbox)
{
    private const int DueSoonDays = 3;
    private const int LeaseEndWarningDays = 30;

    public async Task GenerateAsync(DateOnly today, CancellationToken ct)
    {
        var accountIds = await db.AccountMembers.AsNoTracking()
            .Where(member => member.Status == "ACTIVE")
            .Select(member => member.AccountId).Distinct().ToArrayAsync(ct);
        foreach (var accountId in accountIds)
        {
            await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
            var members = await (from member in db.AccountMembers.AsNoTracking()
                                 join user in db.Users.AsNoTracking() on member.UserId equals user.Id
                                 where member.AccountId == accountId && member.Status == "ACTIVE"
                                 select new NotificationRecipient(member.AccountId, member.UserId, user.Email, user.EmailConfirmed))
                .ToListAsync(ct);
            if (members.Count == 0)
            {
                await transaction.CommitAsync(ct);
                continue;
            }

            var preferences = await db.NotificationPreferences.AsNoTracking()
                .Where(item => item.AccountId == accountId).ToDictionaryAsync(item => item.UserId, ct);
            var dueThrough = today.AddDays(DueSoonDays);
            var charges = await db.RentCharges.AsNoTracking()
                .Where(charge => charge.AccountId == accountId && charge.DueDate <= dueThrough)
                .Select(charge => new
                {
                    charge.Id,
                    charge.DueDate,
                    charge.Amount,
                    Paid = db.PaymentAllocations.Where(allocation => allocation.AccountId == accountId &&
                        allocation.RentChargeId == charge.Id && db.Payments.Any(payment =>
                            payment.AccountId == accountId && payment.Id == allocation.PaymentId &&
                            payment.VoidedAtUtc == null)).Sum(allocation => (decimal?)allocation.Amount) ?? 0m
                }).ToListAsync(ct);
            foreach (var charge in charges.Where(item => item.Amount > item.Paid))
            {
                if (charge.DueDate >= today)
                    await AddEventAsync(accountId, members, preferences, "RENT_DUE",
                        $"rent-due:{charge.Id}:{charge.DueDate:yyyyMMdd}", "Yaklaşan kira vadesi",
                        $"Kira ödeme tarihi {charge.DueDate:dd.MM.yyyy}.", ct);
                else
                    await AddEventAsync(accountId, members, preferences, "OVERDUE_RENT",
                        $"overdue-rent:{charge.Id}", "Vadesi geçen kira",
                        $"Kira ödemesinin vadesi {charge.DueDate:dd.MM.yyyy} tarihinde geçti.", ct);
            }

            var leases = await db.Leases.AsNoTracking().Where(lease => lease.AccountId == accountId &&
                lease.Status == LeaseStatus.ACTIVE).Select(lease => new
                {
                    lease.Id,
                    lease.PlannedEndDate,
                    lease.StartDate
                }).ToListAsync(ct);
            foreach (var lease in leases)
            {
                if (lease.PlannedEndDate is { } end && end >= today && end <= today.AddDays(LeaseEndWarningDays))
                    await AddEventAsync(accountId, members, preferences, "LEASE_END",
                        $"lease-end:{lease.Id}:{end:yyyyMMdd}", "Sözleşme bitiş tarihi yaklaşıyor",
                        $"Planlanan sözleşme bitiş tarihi {end:dd.MM.yyyy}.", ct);

                if (lease.StartDate <= today && lease.StartDate.Month == today.Month &&
                    lease.StartDate.Day == today.Day)
                    await AddEventAsync(accountId, members, preferences, "RENT_ANNIVERSARY",
                        $"rent-anniversary:{lease.Id}:{today.Year}", "Kira güncelleme yıl dönümü",
                        "Sözleşme başlangıç tarihinin yıl dönümü bugün.", ct);
            }

            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            db.ChangeTracker.Clear();
        }
    }

    private async Task AddEventAsync(Guid accountId, IReadOnlyList<NotificationRecipient> members,
        IReadOnlyDictionary<Guid, NotificationPreference> preferences, string type, string eventKey,
        string title, string message, CancellationToken ct)
    {
        foreach (var member in members)
        {
            var preference = preferences.GetValueOrDefault(member.UserId) ?? new NotificationPreference
            {
                AccountId = accountId,
                UserId = member.UserId
            };
            var enabled = type switch
            {
                "RENT_DUE" => preference.RentDueEnabled,
                "OVERDUE_RENT" => preference.OverdueRentEnabled,
                "LEASE_END" => preference.LeaseEndEnabled,
                "RENT_ANNIVERSARY" => preference.RentAnniversaryEnabled,
                _ => false
            };
            if (!enabled) continue;

            if (!await db.Notifications.AnyAsync(item => item.AccountId == accountId &&
                item.UserId == member.UserId && item.EventKey == eventKey, ct))
            {
                db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    AccountId = accountId,
                    UserId = member.UserId,
                    EventKey = eventKey,
                    Type = type,
                    Title = title,
                    Message = message,
                    CreatedAtUtc = DateTime.UtcNow
                });
            }

            if (!preference.EmailEnabled || !member.EmailConfirmed || string.IsNullOrWhiteSpace(member.Email)) continue;
            var outboxKey = $"notification:{member.UserId}:{eventKey}";
            if (await db.OutboxMessages.AnyAsync(item => item.AccountId == accountId &&
                item.EventKey == outboxKey, ct)) continue;
            outbox.AddNotification(accountId, member.UserId, eventKey, type, member.Email, title, message);
        }
    }

    private sealed record NotificationRecipient(Guid AccountId, Guid UserId, string? Email, bool EmailConfirmed);
}

internal sealed class NotificationWorker(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<NotificationWorker> logger) : BackgroundService
{
    internal static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Notifications:WorkerEnabled", true)) return;
        using var timer = new PeriodicTimer(Interval);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<NotificationJob>()
                    .GenerateAsync(RentRules.Today, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("Bildirim üretimi başarısız oldu. Sonraki turda yeniden denenecek.");
            }
            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }
}
