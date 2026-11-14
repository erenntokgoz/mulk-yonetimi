using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

internal static class RentRules
{
    private static readonly TimeZoneInfo BusinessZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    public static DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BusinessZone));
    public static DateOnly Month(DateOnly date) => new(date.Year, date.Month, 1);
    public static bool IsMoney(decimal amount) =>
        amount is >= 0 and <= 99_999_999_999_999_999.99m && decimal.Round(amount, 2) == amount;

    public static DateOnly DueDate(DateOnly month, int dueDay) =>
        new(month.Year, month.Month, Math.Min(dueDay, DateTime.DaysInMonth(month.Year, month.Month)));

    public static string ChargeStatus(decimal total, decimal paid) =>
        paid == total ? "PAID" : paid == 0 ? "UNPAID" : "PARTIAL";

    public static async Task<IDbContextTransaction> LockAccountAsync(ApplicationDbContext db, Guid accountId,
        CancellationToken ct)
    {
        var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        try
        {
            await db.Database.SqlQuery<Guid>(
                $"SELECT Id AS Value FROM Accounts WITH (UPDLOCK, ROWLOCK) WHERE Id = {accountId}")
                .SingleAsync(ct);
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    public static async Task AddMissingChargesAsync(ApplicationDbContext db, Lease lease, DateOnly through,
        CancellationToken ct)
    {
        var rates = await db.RentRatePeriods.AsNoTracking()
            .Where(rate => rate.AccountId == lease.AccountId && rate.LeaseId == lease.Id)
            .OrderByDescending(rate => rate.EffectiveFrom).ToListAsync(ct);
        var existing = await db.RentCharges.AsNoTracking()
            .Where(charge => charge.AccountId == lease.AccountId && charge.LeaseId == lease.Id)
            .Select(charge => charge.PeriodStart).ToListAsync(ct);
        var periods = existing.ToHashSet();
        for (var month = Month(lease.StartDate); month <= Month(through); month = month.AddMonths(1))
        {
            if (!periods.Add(month)) continue;
            var rateDate = month < lease.StartDate ? lease.StartDate : month;
            var due = DueDate(month, lease.DueDay);
            db.RentCharges.Add(new RentCharge
            {
                Id = Guid.NewGuid(),
                AccountId = lease.AccountId,
                LeaseId = lease.Id,
                PeriodStart = month,
                DueDate = due < lease.StartDate ? lease.StartDate : due,
                Amount = rates.First(rate => rate.EffectiveFrom <= rateDate).MonthlyAmount
            });
        }
    }
}
