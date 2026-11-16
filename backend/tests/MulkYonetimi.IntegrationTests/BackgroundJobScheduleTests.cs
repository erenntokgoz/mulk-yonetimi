using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MulkYonetimi.Api;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.IntegrationTests;

// Seyrek iş aralıklarının (ADR 013) dönem kaçırmadığını ve outbox sinyalinin commit sonrasına bağlandığını doğrular.
public sealed class BackgroundJobScheduleTests
{
    [Fact]
    public async Task Rent_charges_catch_up_across_month_boundaries_after_a_long_gap_without_duplicates()
    {
        await using var database = await TestDatabase.CreateAsync("MulkJobsRent");
        var accountId = Guid.NewGuid();
        var leaseId = Guid.NewGuid();
        await using (var db = database.Context())
        {
            AddLease(db, accountId, leaseId, new DateOnly(2026, 1, 15), dueDay: 31);
            await db.SaveChangesAsync();
        }

        await using (var db = database.Context())
            await new RentChargeJob(db).GenerateAsync(new DateOnly(2026, 1, 31), CancellationToken.None);
        // 12 saatlik tur yerine iki ay boyunca hiç çalışmamış gibi: Şubat, Mart ve Nisan tek seferde tamamlanır.
        for (var run = 0; run < 3; run++)
            await using (var db = database.Context())
                await new RentChargeJob(db).GenerateAsync(new DateOnly(2026, 4, 1), CancellationToken.None);

        await using var verify = database.Context();
        var charges = await verify.RentCharges.AsNoTracking().Where(item => item.LeaseId == leaseId)
            .OrderBy(item => item.PeriodStart).Select(item => new { item.PeriodStart, item.DueDate }).ToListAsync();
        Assert.Equal(new[]
        {
            new { PeriodStart = new DateOnly(2026, 1, 1), DueDate = new DateOnly(2026, 1, 31) },
            new { PeriodStart = new DateOnly(2026, 2, 1), DueDate = new DateOnly(2026, 2, 28) },
            new { PeriodStart = new DateOnly(2026, 3, 1), DueDate = new DateOnly(2026, 3, 31) },
            new { PeriodStart = new DateOnly(2026, 4, 1), DueDate = new DateOnly(2026, 4, 30) }
        }, charges);
    }

    [Fact]
    public async Task Outbox_enqueue_signals_the_worker_only_after_commit()
    {
        await using var database = await TestDatabase.CreateAsync("MulkJobsSignal");
        var accountId = Guid.NewGuid();
        await using (var db = database.Context())
        {
            db.Add(new Account { Id = accountId, Name = "signal" });
            await db.SaveChangesAsync();
        }

        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseSetting("ConnectionStrings:DefaultConnection", database.ConnectionString);
            host.UseSetting("Auth:FrontendOrigin", "https://app.example.test");
            host.UseSetting("Email:WorkerEnabled", "false");
            host.UseSetting("Notifications:WorkerEnabled", "false");
            host.UseSetting("RentCharges:WorkerEnabled", "false");
        });
        var signal = factory.Services.GetRequiredService<EmailOutboxSignal>();

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await using var transaction = await db.Database.BeginTransactionAsync();
            scope.ServiceProvider.GetRequiredService<EmailOutboxQueue>()
                .Add(accountId, "CONFIRM_EMAIL", "signal@example.test", "https://app.example.test/confirm");
            await db.SaveChangesAsync();
            Assert.False(await signal.WaitAsync(TimeSpan.Zero, CancellationToken.None));
            await transaction.CommitAsync();
        }
        Assert.True(await signal.WaitAsync(TimeSpan.Zero, CancellationToken.None));

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            scope.ServiceProvider.GetRequiredService<EmailOutboxQueue>()
                .Add(accountId, "CONFIRM_EMAIL", "signal@example.test", "https://app.example.test/confirm");
            await db.SaveChangesAsync();
        }
        Assert.True(await signal.WaitAsync(TimeSpan.Zero, CancellationToken.None));

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await using var transaction = await db.Database.BeginTransactionAsync();
            scope.ServiceProvider.GetRequiredService<EmailOutboxQueue>()
                .Add(accountId, "CONFIRM_EMAIL", "signal@example.test", "https://app.example.test/confirm");
            await db.SaveChangesAsync();
            await transaction.RollbackAsync();
        }
        Assert.False(await signal.WaitAsync(TimeSpan.Zero, CancellationToken.None));

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Add(new Account { Id = Guid.NewGuid(), Name = "no-mail" });
            await db.SaveChangesAsync();
        }
        Assert.False(await signal.WaitAsync(TimeSpan.Zero, CancellationToken.None));

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var dispatcher = scope.ServiceProvider.GetRequiredService<IEmailOutboxDispatcher>();
            var next = await dispatcher.NextAttemptAtUtcAsync(CancellationToken.None);
            Assert.NotNull(next);
            Assert.True(next <= DateTime.UtcNow);
        }
    }

    private static void AddLease(ApplicationDbContext db, Guid accountId, Guid leaseId, DateOnly start, int dueDay)
    {
        var propertyId = Guid.NewGuid();
        var unitId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        db.AddRange(
            new Account { Id = accountId, Name = "jobs" },
            new Property
            {
                Id = propertyId,
                AccountId = accountId,
                Name = "Test mülkü",
                Address = "Ankara",
                Kind = PropertyKind.SINGLE_UNIT
            },
            new Unit
            {
                Id = unitId,
                AccountId = accountId,
                PropertyId = propertyId,
                Label = "1",
                UsageType = UnitUsageType.RESIDENTIAL,
                IsDefault = true
            },
            new Tenant { Id = tenantId, AccountId = accountId, Kind = TenantKind.PERSON },
            new Lease
            {
                Id = leaseId,
                AccountId = accountId,
                UnitId = unitId,
                TenantId = tenantId,
                Status = LeaseStatus.ACTIVE,
                StartDate = start,
                DueDay = dueDay,
                DepositAmount = 0m,
                CreatedAtUtc = DateTime.UtcNow
            },
            new RentRatePeriod { AccountId = accountId, LeaseId = leaseId, EffectiveFrom = start, MonthlyAmount = 1000m });
    }

    private sealed class TestDatabase : IAsyncDisposable
    {
        private TestDatabase(string connectionString) => ConnectionString = connectionString;

        public string ConnectionString { get; }

        public ApplicationDbContext Context() =>
            new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(ConnectionString).Options);

        public static async Task<TestDatabase> CreateAsync(string prefix)
        {
            var admin = Environment.GetEnvironmentVariable("MULK_SQL_TEST_ADMIN_CONNECTION")
                ?? throw new InvalidOperationException("MULK_SQL_TEST_ADMIN_CONNECTION is required for integration tests.");
            var database = new TestDatabase(new SqlConnectionStringBuilder(admin)
            {
                InitialCatalog = $"{prefix}_{Guid.NewGuid():N}"
            }.ConnectionString);
            await using var db = database.Context();
            await db.Database.MigrateAsync();
            return database;
        }

        public async ValueTask DisposeAsync()
        {
            await using var db = Context();
            await db.Database.EnsureDeletedAsync();
        }
    }
}
