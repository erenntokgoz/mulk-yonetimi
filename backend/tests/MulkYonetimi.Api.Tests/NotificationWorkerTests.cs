using Microsoft.Extensions.Configuration;
using MulkYonetimi.Api;

namespace MulkYonetimi.Api.Tests;

public sealed class NotificationWorkerTests
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    [Fact]
    public void Job_intervals_default_to_twelve_hours()
    {
        var configuration = Configuration();
        Assert.Equal(TimeSpan.FromHours(12), NotificationWorker.Interval(configuration));
        Assert.Equal(TimeSpan.FromHours(12), RentChargeWorker.Interval(configuration));
        Assert.Equal(TimeSpan.FromHours(12), DocumentCleanupWorker.Interval(configuration));
    }

    [Fact]
    public void Rent_and_notification_intervals_cannot_exceed_one_day()
    {
        var configuration = Configuration(("Jobs:NotificationHours", "72"), ("Jobs:RentChargeHours", "48"),
            ("Jobs:DocumentCleanupHours", "48"));
        Assert.Equal(TimeSpan.FromHours(24), NotificationWorker.Interval(configuration));
        Assert.Equal(TimeSpan.FromHours(24), RentChargeWorker.Interval(configuration));
        Assert.Equal(TimeSpan.FromHours(48), DocumentCleanupWorker.Interval(configuration));
        Assert.Equal(TimeSpan.FromHours(1), NotificationWorker.Interval(Configuration(("Jobs:NotificationHours", "0"))));
    }

    [Fact]
    public void Fixed_cadence_does_not_drift_with_job_duration()
    {
        var started = new DateTime(2026, 11, 16, 0, 0, 0, DateTimeKind.Utc);
        Assert.Equal(TimeSpan.FromHours(12) - TimeSpan.FromMinutes(3),
            ScheduledJob.NextDelay(started, started.AddMinutes(3), TimeSpan.FromHours(12), 0));
        Assert.Equal(TimeSpan.Zero, ScheduledJob.NextDelay(started, started.AddHours(13), TimeSpan.FromHours(12), 0));
    }

    [Fact]
    public void Failed_runs_back_off_from_five_minutes_up_to_the_interval()
    {
        var interval = TimeSpan.FromHours(12);
        Assert.Equal(TimeSpan.FromMinutes(5), ScheduledJob.RetryDelay(1, interval));
        Assert.Equal(TimeSpan.FromMinutes(10), ScheduledJob.RetryDelay(2, interval));
        Assert.Equal(TimeSpan.FromMinutes(80), ScheduledJob.RetryDelay(5, interval));
        Assert.Equal(interval, ScheduledJob.RetryDelay(9, interval));
        Assert.Equal(interval, ScheduledJob.RetryDelay(1_000, interval));
        Assert.Equal(TimeSpan.FromMinutes(5), ScheduledJob.NextDelay(DateTime.UtcNow, DateTime.UtcNow, interval, 1));
    }

    [Theory]
    [InlineData(12, 0)]
    [InlineData(12, 7.25)]
    [InlineData(24, 0)]
    [InlineData(24, 23.99)]
    public void Every_business_day_gets_a_run_at_the_longest_cadence(double hours, double startOffsetHours)
    {
        var runs = Runs(hours, startOffsetHours, days: 800).Select(BusinessDate).ToHashSet();
        var first = BusinessDate(Runs(hours, startOffsetHours, 1).First());
        for (var day = first.AddDays(1); day < first.AddDays(795); day = day.AddDays(1))
            Assert.Contains(day, runs);
    }

    [Theory]
    [InlineData(12, 0)]
    [InlineData(12, 5.5)]
    [InlineData(24, 13)]
    public void Long_intervals_neither_skip_nor_duplicate_notification_events(double hours, double startOffsetHours)
    {
        var chargeIds = new Dictionary<DateOnly, Guid>();
        var leaseId = Guid.NewGuid();
        var leaseStart = new DateOnly(2024, 3, 31);
        var leaseEnd = new DateOnly(2028, 1, 31);
        var keys = new HashSet<string>();
        var dueSeen = new Dictionary<Guid, int>();
        foreach (var run in Runs(hours, startOffsetHours, days: 800))
        {
            var today = BusinessDate(run);
            // Alacaklar her ayın 1'inde, DueDay=31 ile ay sonuna sıkıştırılmış vadeyle oluşur (Şubat ve 30 günlü aylar).
            for (var month = new DateOnly(2026, 1, 1); month <= new DateOnly(today.Year, today.Month, 1); month = month.AddMonths(1))
            {
                if (!chargeIds.TryGetValue(month, out var chargeId)) chargeIds[month] = chargeId = Guid.NewGuid();
                var due = new DateOnly(month.Year, month.Month, DateTime.DaysInMonth(month.Year, month.Month));
                if (NotificationJob.ChargeEvent(chargeId, due, today) is { } item && keys.Add(item.EventKey) &&
                    item.Type == "RENT_DUE")
                    dueSeen[chargeId] = dueSeen.GetValueOrDefault(chargeId) + 1;
            }
            if (NotificationJob.LeaseEndEventKey(leaseId, leaseEnd, today) is { } endKey) keys.Add(endKey);
            if (NotificationJob.AnniversaryEventKey(leaseId, leaseStart, today) is { } anniversary) keys.Add(anniversary);
        }

        var lastDay = BusinessDate(Runs(hours, startOffsetHours, 800).Last());
        foreach (var (month, chargeId) in chargeIds)
        {
            var due = new DateOnly(month.Year, month.Month, DateTime.DaysInMonth(month.Year, month.Month));
            if (due > lastDay) continue;
            Assert.Equal(1, dueSeen.GetValueOrDefault(chargeId));
            Assert.Equal(1, keys.Count(key => key.StartsWith($"rent-due:{chargeId}:", StringComparison.Ordinal)));
            Assert.Equal(due < lastDay, keys.Contains($"overdue-rent:{chargeId}"));
        }
        Assert.Single(keys, key => key.StartsWith("lease-end:", StringComparison.Ordinal));
        var years = keys.Where(key => key.StartsWith("rent-anniversary:", StringComparison.Ordinal)).ToArray();
        Assert.Equal(new[] { 2026, 2027, 2028 }.Where(year => new DateOnly(year, 3, 31) <= lastDay)
            .Select(year => $"rent-anniversary:{leaseId}:{year}"), years.Order(StringComparer.Ordinal));
    }

    [Fact]
    public void Charge_events_follow_the_due_date_window()
    {
        var id = Guid.NewGuid();
        var today = new DateOnly(2026, 2, 26);
        Assert.Null(NotificationJob.ChargeEvent(id, today.AddDays(NotificationJob.DueSoonDays + 1), today));
        Assert.Equal(("RENT_DUE", $"rent-due:{id}:20260301"),
            NotificationJob.ChargeEvent(id, new DateOnly(2026, 3, 1), today));
        Assert.Equal(("RENT_DUE", $"rent-due:{id}:20260226"), NotificationJob.ChargeEvent(id, today, today));
        Assert.Equal(("OVERDUE_RENT", $"overdue-rent:{id}"), NotificationJob.ChargeEvent(id, today.AddDays(-1), today));
        Assert.Equal(NotificationJob.ChargeEvent(id, today.AddDays(-1), today),
            NotificationJob.ChargeEvent(id, today.AddDays(-1), today.AddDays(40)));
    }

    // Sabit tempolu çalışma; her tur 0-20 dakika sürer, sonraki tur başlangıçtan sayılır.
    private static IEnumerable<DateTime> Runs(double hours, double startOffsetHours, int days)
    {
        var started = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddHours(startOffsetHours);
        var end = started.AddDays(days);
        var random = new Random(42);
        var interval = TimeSpan.FromHours(hours);
        while (started < end)
        {
            yield return started;
            var finished = started.AddMinutes(random.Next(0, 20));
            started = finished + ScheduledJob.NextDelay(started, finished, interval, 0);
        }
    }

    private static DateOnly BusinessDate(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utc, Istanbul));

    private static IConfiguration Configuration(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(item =>
            new KeyValuePair<string, string?>(item.Key, item.Value))).Build();
}
