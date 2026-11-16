using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

public sealed class NotificationJob(ApplicationDbContext db, EmailOutboxQueue outbox)
{
    internal const int DueSoonDays = 3;
    internal const int LeaseEndWarningDays = 30;

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
            var charges = await (from charge in db.RentCharges.AsNoTracking()
                                 join lease in db.Leases.AsNoTracking()
                                     on new { charge.AccountId, Id = charge.LeaseId } equals new { lease.AccountId, lease.Id }
                                 join unit in db.Units.AsNoTracking()
                                     on new { lease.AccountId, Id = lease.UnitId } equals new { unit.AccountId, unit.Id }
                                 join property in db.Properties.AsNoTracking()
                                     on new { unit.AccountId, Id = unit.PropertyId } equals new { property.AccountId, property.Id }
                                 join tenant in db.Tenants.AsNoTracking()
                                     on new { lease.AccountId, Id = lease.TenantId } equals new { tenant.AccountId, tenant.Id }
                                 where charge.AccountId == accountId && charge.DueDate <= dueThrough
                                 select new
                                 {
                                     charge.Id,
                                     charge.DueDate,
                                     charge.Amount,
                                     PropertyName = property.Name,
                                     UnitLabel = unit.Label,
                                     unit.IsDefault,
                                     TenantKind = tenant.Kind,
                                     tenant.FirstName,
                                     tenant.LastName,
                                     tenant.CompanyName,
                                     Paid = db.PaymentAllocations.Where(allocation => allocation.AccountId == accountId &&
                                         allocation.RentChargeId == charge.Id && db.Payments.Any(payment =>
                                             payment.AccountId == accountId && payment.Id == allocation.PaymentId &&
                                             payment.VoidedAtUtc == null)).Sum(allocation => (decimal?)allocation.Amount) ?? 0m
                                 }).ToListAsync(ct);
            foreach (var charge in charges.Where(item => item.Amount > item.Paid))
            {
                var place = NotificationCopy.Place(charge.PropertyName, charge.UnitLabel, charge.IsDefault);
                var tenant = NotificationCopy.TenantName(charge.TenantKind, charge.FirstName, charge.LastName,
                    charge.CompanyName);
                var unpaid = charge.Amount - charge.Paid;
                if (ChargeEvent(charge.Id, charge.DueDate, today) is not { } chargeEvent) continue;
                await AddEventAsync(accountId, members, preferences, chargeEvent.Type, chargeEvent.EventKey,
                    chargeEvent.Type == "RENT_DUE"
                        ? NotificationCopy.RentDue(place, tenant, charge.DueDate, unpaid)
                        : NotificationCopy.OverdueRent(place, tenant, charge.DueDate, unpaid), ct);
            }

            var leases = await (from lease in db.Leases.AsNoTracking()
                                join unit in db.Units.AsNoTracking()
                                    on new { lease.AccountId, Id = lease.UnitId } equals new { unit.AccountId, unit.Id }
                                join property in db.Properties.AsNoTracking()
                                    on new { unit.AccountId, Id = unit.PropertyId } equals new { property.AccountId, property.Id }
                                join tenant in db.Tenants.AsNoTracking()
                                    on new { lease.AccountId, Id = lease.TenantId } equals new { tenant.AccountId, tenant.Id }
                                where lease.AccountId == accountId && lease.Status == LeaseStatus.ACTIVE
                                select new
                                {
                                    lease.Id,
                                    lease.PlannedEndDate,
                                    lease.StartDate,
                                    PropertyName = property.Name,
                                    UnitLabel = unit.Label,
                                    unit.IsDefault,
                                    TenantKind = tenant.Kind,
                                    tenant.FirstName,
                                    tenant.LastName,
                                    tenant.CompanyName
                                }).ToListAsync(ct);
            foreach (var lease in leases)
            {
                var place = NotificationCopy.Place(lease.PropertyName, lease.UnitLabel, lease.IsDefault);
                var tenant = NotificationCopy.TenantName(lease.TenantKind, lease.FirstName, lease.LastName,
                    lease.CompanyName);
                if (LeaseEndEventKey(lease.Id, lease.PlannedEndDate, today) is { } leaseEndKey)
                    await AddEventAsync(accountId, members, preferences, "LEASE_END", leaseEndKey,
                        NotificationCopy.LeaseEnd(place, tenant, lease.PlannedEndDate!.Value), ct);

                if (AnniversaryEventKey(lease.Id, lease.StartDate, today) is { } anniversaryKey)
                    await AddEventAsync(accountId, members, preferences, "RENT_ANNIVERSARY", anniversaryKey,
                        NotificationCopy.RentAnniversary(place, tenant, lease.StartDate), ct);
            }

            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            db.ChangeTracker.Clear();
        }
    }

    // Olay kararları saf fonksiyondur: anahtar olayın kendisinden (alacak, vade, bitiş, yıl) türetilir, çalışma
    // saatinden türetilmez. Aynı olay hangi turda görülürse görülsün aynı anahtarı alır ve tekilleştirilir.
    internal static (string Type, string EventKey)? ChargeEvent(Guid chargeId, DateOnly dueDate, DateOnly today)
    {
        if (dueDate > today.AddDays(DueSoonDays)) return null;
        return dueDate >= today
            ? ("RENT_DUE", $"rent-due:{chargeId}:{dueDate:yyyyMMdd}")
            : ("OVERDUE_RENT", $"overdue-rent:{chargeId}");
    }

    internal static string? LeaseEndEventKey(Guid leaseId, DateOnly? plannedEndDate, DateOnly today) =>
        plannedEndDate is { } end && end >= today && end <= today.AddDays(LeaseEndWarningDays)
            ? $"lease-end:{leaseId}:{end:yyyyMMdd}"
            : null;

    internal static string? AnniversaryEventKey(Guid leaseId, DateOnly startDate, DateOnly today) =>
        startDate <= today && startDate.Month == today.Month && startDate.Day == today.Day
            ? $"rent-anniversary:{leaseId}:{today.Year}"
            : null;

    private async Task AddEventAsync(Guid accountId, IReadOnlyList<NotificationRecipient> members,
        IReadOnlyDictionary<Guid, NotificationPreference> preferences, string type, string eventKey,
        NotificationText text, CancellationToken ct)
    {
        var (title, message) = text;
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

// Bildirim anahtarları olay başına tekildir (vade, gecikme, bitiş, yıl); seyrek tur çift bildirim üretmez.
// Her tur önce eksik kira alacaklarını tamamlar: bildirim, ayrı çalışan alacak işinin sırasına bağlı kalmaz.
internal sealed class NotificationWorker(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<NotificationWorker> logger) : BackgroundService
{
    internal static TimeSpan Interval(IConfiguration configuration) =>
        ScheduledJob.Hours(configuration, "Jobs:NotificationHours", 12, 24);

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Notifications:WorkerEnabled", true)) return Task.CompletedTask;
        var generateCharges = configuration.GetValue("RentCharges:WorkerEnabled", true);
        return ScheduledJob.RunAsync("Bildirim üretimi", Interval(configuration), async ct =>
        {
            await using var scope = scopes.CreateAsyncScope();
            var today = RentRules.Today;
            if (generateCharges)
                await scope.ServiceProvider.GetRequiredService<RentChargeJob>().GenerateAsync(today, ct);
            await scope.ServiceProvider.GetRequiredService<NotificationJob>().GenerateAsync(today, ct);
        }, logger, stoppingToken);
    }
}
