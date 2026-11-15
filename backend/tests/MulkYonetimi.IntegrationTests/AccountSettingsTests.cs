using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MulkYonetimi.Api;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.IntegrationTests;

public sealed class AccountSettingsTests
{
    private const string ProfilePath = "/api/v1/me/profile";
    private const string PreferencesPath = "/api/v1/me/notification-preferences";
    private const string Origin = "https://app.example.test";
    private const string Password = "Settings-Test-123!";

    [Fact]
    public async Task Profile_and_notification_preferences_are_private_to_the_signed_in_account()
    {
        var admin = Environment.GetEnvironmentVariable("MULK_SQL_TEST_ADMIN_CONNECTION")
            ?? throw new InvalidOperationException("MULK_SQL_TEST_ADMIN_CONNECTION is required for integration tests.");
        var connection = new SqlConnectionStringBuilder(admin)
        {
            InitialCatalog = $"MulkSettingsTest_{Guid.NewGuid():N}"
        }.ConnectionString;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        await using var db = new ApplicationDbContext(options);

        try
        {
            await db.Database.MigrateAsync();
            var (accountA, userA) = AddOwner(db, "settings-a");
            var (accountB, userB) = AddOwner(db, "settings-b");
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var propertyA = new Property
            {
                Id = Guid.NewGuid(),
                AccountId = accountA.Id,
                Name = "Test mülkü",
                Address = "Ankara",
                Kind = PropertyKind.SINGLE_UNIT
            };
            var unitA = new Unit
            {
                Id = Guid.NewGuid(),
                AccountId = accountA.Id,
                PropertyId = propertyA.Id,
                Label = "1",
                UsageType = UnitUsageType.RESIDENTIAL,
                IsDefault = true
            };
            var tenantA = new Tenant { Id = Guid.NewGuid(), AccountId = accountA.Id, Kind = TenantKind.PERSON };
            var leaseA = new Lease
            {
                Id = Guid.NewGuid(),
                AccountId = accountA.Id,
                UnitId = unitA.Id,
                TenantId = tenantA.Id,
                Status = LeaseStatus.ACTIVE,
                StartDate = today.AddDays(-20),
                DueDay = 5,
                DepositAmount = 100m,
                CreatedAtUtc = DateTime.UtcNow
            };
            var dueCharge = new RentCharge
            {
                Id = Guid.NewGuid(),
                AccountId = accountA.Id,
                LeaseId = leaseA.Id,
                PeriodStart = new DateOnly(today.Year, today.Month, 1),
                DueDate = today.AddDays(1),
                Amount = 100m
            };
            var overdueCharge = new RentCharge
            {
                Id = Guid.NewGuid(),
                AccountId = accountA.Id,
                LeaseId = leaseA.Id,
                PeriodStart = new DateOnly(today.Year, today.Month, 1).AddMonths(-1),
                DueDate = today.AddDays(-1),
                Amount = 75m
            };
            var unitB = new Unit
            {
                Id = Guid.NewGuid(),
                AccountId = accountA.Id,
                PropertyId = propertyA.Id,
                Label = "2",
                UsageType = UnitUsageType.RESIDENTIAL
            };
            var leaseB = new Lease
            {
                Id = Guid.NewGuid(),
                AccountId = accountA.Id,
                UnitId = unitB.Id,
                TenantId = tenantA.Id,
                Status = LeaseStatus.ACTIVE,
                StartDate = today.AddYears(-2),
                PlannedEndDate = today.AddDays(20),
                DueDay = 5,
                DepositAmount = 100m,
                CreatedAtUtc = DateTime.UtcNow
            };
            db.AddRange(propertyA, unitA, unitB, tenantA, leaseA, leaseB, dueCharge, overdueCharge);
            var notificationA = new Notification
            {
                Id = Guid.NewGuid(),
                AccountId = accountA.Id,
                UserId = userA.Id,
                EventKey = "test:event:a",
                Type = "RENT_DUE",
                Title = "Kira vadesi",
                Message = "Test bildirimi",
                CreatedAtUtc = DateTime.UtcNow
            };
            var notificationB = new Notification
            {
                Id = Guid.NewGuid(),
                AccountId = accountB.Id,
                UserId = userB.Id,
                EventKey = "test:event:b",
                Type = "RENT_DUE",
                Title = "Kira vadesi",
                Message = "Başka hesap bildirimi",
                CreatedAtUtc = DateTime.UtcNow
            };
            db.Notifications.AddRange(notificationA, notificationB);
            await db.SaveChangesAsync();

            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
            {
                host.UseSetting("ConnectionStrings:DefaultConnection", connection);
                host.UseSetting("Auth:FrontendOrigin", Origin);
                host.UseSetting("Email:WorkerEnabled", "false");
                host.UseSetting("Notifications:WorkerEnabled", "false");
            });
            using var clientA = await SignInAsync(factory, userA);
            using var clientB = await SignInAsync(factory, userB);
            using (var anonymous = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }))
            {
                Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(ProfilePath)).StatusCode);
                Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(PreferencesPath)).StatusCode);
                Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/v1/notifications")).StatusCode);
            }
            using (var contract = await clientA.GetAsync("/openapi/v1.json"))
            {
                Assert.Equal(HttpStatusCode.OK, contract.StatusCode);
                using var api = JsonDocument.Parse(await contract.Content.ReadAsStringAsync());
                var paths = api.RootElement.GetProperty("paths");
                Assert.True(paths.TryGetProperty(ProfilePath, out _));
                Assert.True(paths.TryGetProperty(PreferencesPath, out _));
                Assert.True(paths.TryGetProperty("/api/v1/notifications", out _));
            }

            using var updateProfile = await clientA.PutAsJsonAsync(ProfilePath, new { displayName = "Merve Yılmaz" });
            Assert.Equal(HttpStatusCode.OK, updateProfile.StatusCode);
            using var updatePreferences = await clientA.PutAsJsonAsync(PreferencesPath, new
            {
                emailEnabled = true,
                rentDueEnabled = true,
                overdueRentEnabled = true,
                leaseEndEnabled = true,
                rentAnniversaryEnabled = true
            });
            Assert.Equal(HttpStatusCode.OK, updatePreferences.StatusCode);

            using var profileA = await clientA.GetAsync(ProfilePath);
            using var profileB = await clientB.GetAsync(ProfilePath);
            using var preferencesA = await clientA.GetAsync(PreferencesPath);
            using var preferencesB = await clientB.GetAsync(PreferencesPath);
            Assert.Equal(HttpStatusCode.OK, profileA.StatusCode);
            Assert.Equal(HttpStatusCode.OK, profileB.StatusCode);
            Assert.Equal(HttpStatusCode.OK, preferencesA.StatusCode);
            Assert.Equal(HttpStatusCode.OK, preferencesB.StatusCode);

            using var profileJsonA = JsonDocument.Parse(await profileA.Content.ReadAsStringAsync());
            using var profileJsonB = JsonDocument.Parse(await profileB.Content.ReadAsStringAsync());
            Assert.Equal("Merve Yılmaz", profileJsonA.RootElement.GetProperty("displayName").GetString());
            Assert.NotEqual("Merve Yılmaz", profileJsonB.RootElement.GetProperty("displayName").GetString());

            using var preferencesJsonA = JsonDocument.Parse(await preferencesA.Content.ReadAsStringAsync());
            using var preferencesJsonB = JsonDocument.Parse(await preferencesB.Content.ReadAsStringAsync());
            Assert.True(preferencesJsonA.RootElement.GetProperty("emailEnabled").GetBoolean());
            Assert.False(preferencesJsonB.RootElement.GetProperty("emailEnabled").GetBoolean());
            Assert.NotEqual(accountA.Id, accountB.Id);

            using (var scope = factory.Services.CreateScope())
            {
                var job = scope.ServiceProvider.GetRequiredService<NotificationJob>();
                await job.GenerateAsync(today, CancellationToken.None);
                await job.GenerateAsync(today, CancellationToken.None);
            }
            Assert.Equal(1, await db.Notifications.CountAsync(item => item.AccountId == accountA.Id &&
                item.EventKey.StartsWith("rent-due:")));
            Assert.Equal(1, await db.Notifications.CountAsync(item => item.AccountId == accountA.Id &&
                item.EventKey.StartsWith("overdue-rent:")));
            Assert.Equal(1, await db.Notifications.CountAsync(item => item.AccountId == accountA.Id &&
                item.EventKey.StartsWith("lease-end:")));
            Assert.Equal(1, await db.Notifications.CountAsync(item => item.AccountId == accountA.Id &&
                item.EventKey.StartsWith("rent-anniversary:")));
            Assert.Equal(4, await db.OutboxMessages.CountAsync(item => item.AccountId == accountA.Id && item.Kind == "NOTIFICATION"));
            var generated = (await db.Notifications.AsNoTracking()
                    .Where(item => item.AccountId == accountA.Id && !item.EventKey.StartsWith("test:")).ToListAsync())
                .ToDictionary(item => item.EventKey.Split(':')[0], item => (item.Title, item.Message));
            Assert.Equal(("Kira ödeme günü yaklaşıyor",
                $"Test mülkü kirasının son ödeme günü {Day(today.AddDays(1))}. Ödenmemiş tutar 100,00 TL."),
                generated["rent-due"]);
            Assert.Equal(("Kira ödemesi gecikti",
                $"Test mülkü kirasının {Day(today.AddDays(-1))} olan son ödeme günü geçti. Ödenmemiş tutar 75,00 TL."),
                generated["overdue-rent"]);
            Assert.Equal(("Sözleşme bitiş tarihi yaklaşıyor",
                $"Test mülkü (2) sözleşmesinin planlanan bitiş tarihi {Day(today.AddDays(20))}."), generated["lease-end"]);
            Assert.Equal("Kira yıl dönümü bugün", generated["rent-anniversary"].Title);
            Assert.Contains("Kira ödemesi gecikti", await db.OutboxMessages.AsNoTracking()
                .Where(item => item.AccountId == accountA.Id && item.Kind == "NOTIFICATION")
                .Select(item => item.Subject).ToListAsync());

            using var notificationsA = await clientA.GetAsync("/api/v1/notifications");
            using var notificationsB = await clientB.GetAsync("/api/v1/notifications");
            Assert.Equal(HttpStatusCode.OK, notificationsA.StatusCode);
            Assert.Equal(HttpStatusCode.OK, notificationsB.StatusCode);
            using var notificationJsonA = JsonDocument.Parse(await notificationsA.Content.ReadAsStringAsync());
            using var notificationJsonB = JsonDocument.Parse(await notificationsB.Content.ReadAsStringAsync());
            Assert.Contains(notificationJsonA.RootElement.GetProperty("items").EnumerateArray(),
                item => item.GetProperty("id").GetString() == notificationA.Id.ToString());
            Assert.Contains(notificationJsonB.RootElement.GetProperty("items").EnumerateArray(),
                item => item.GetProperty("id").GetString() == notificationB.Id.ToString());

            using var foreignRead = await clientA.PatchAsJsonAsync($"/api/v1/notifications/{notificationB.Id}/read", new { });
            Assert.Equal(HttpStatusCode.NotFound, foreignRead.StatusCode);
            using var ownRead = await clientA.PatchAsJsonAsync($"/api/v1/notifications/{notificationA.Id}/read", new { });
            Assert.Equal(HttpStatusCode.NoContent, ownRead.StatusCode);
            using var unsubscribe = await clientA.PutAsJsonAsync(PreferencesPath, new
            {
                emailEnabled = false,
                rentDueEnabled = true,
                overdueRentEnabled = true,
                leaseEndEnabled = true,
                rentAnniversaryEnabled = true
            });
            Assert.Equal(HttpStatusCode.OK, unsubscribe.StatusCode);
            using (var scope = factory.Services.CreateScope())
                await scope.ServiceProvider.GetRequiredService<EmailOutboxDispatcher>()
                    .DispatchOnceAsync(CancellationToken.None);
            Assert.Equal(4, await db.OutboxMessages.CountAsync(item => item.AccountId == accountA.Id &&
                item.Kind == "NOTIFICATION" && item.Status == "CANCELLED"));
        }
        finally
        {
            await db.Database.EnsureDeletedAsync();
        }
    }

    private static (Account, ApplicationUser) AddOwner(ApplicationDbContext db, string prefix)
    {
        var email = $"{prefix}@example.test";
        var account = new Account { Id = Guid.NewGuid(), Name = prefix };
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = email,
            UserName = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };
        user.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(user, Password);
        db.AddRange(account, user, new AccountMember
        {
            AccountId = account.Id,
            UserId = user.Id,
            Role = "OWNER",
            Status = "ACTIVE"
        });
        return (account, user);
    }

    private static async Task<HttpClient> SignInAsync(WebApplicationFactory<Program> factory, ApplicationUser user)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Origin", Origin);
        using var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { user.Email, Password });
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
        return client;
    }

    private static string Day(DateOnly date) => date.ToString("dd.MM.yyyy", System.Globalization.CultureInfo.InvariantCulture);
}
