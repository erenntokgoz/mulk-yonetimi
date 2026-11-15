using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.IntegrationTests;

public sealed class SqlBrowserE2ESeedTests
{
    [SqlBrowserE2EFact]
    public async Task Creates_verified_owner_for_browser_test()
    {
        var adminConnection = Environment.GetEnvironmentVariable("MULK_SQL_TEST_ADMIN_CONNECTION")
            ?? throw new InvalidOperationException("SQL integration connection is required.");
        var database = Environment.GetEnvironmentVariable("MULK_SQL_E2E_DATABASE")
            ?? throw new InvalidOperationException("Browser E2E database is required.");
        var email = Environment.GetEnvironmentVariable("MULK_SQL_E2E_EMAIL")
            ?? throw new InvalidOperationException("Browser E2E email is required.");
        var password = Environment.GetEnvironmentVariable("MULK_SQL_E2E_PASSWORD")
            ?? throw new InvalidOperationException("Browser E2E password is required.");
        if (!Regex.IsMatch(database, "^MulkBrowserE2E_[0-9]+$"))
            throw new InvalidOperationException("Browser E2E database name is invalid.");

        var admin = new SqlConnectionStringBuilder(adminConnection) { InitialCatalog = "master" };
        await using var connection = new SqlConnection(admin.ConnectionString);
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await connection.OpenAsync();
                break;
            }
            catch (SqlException) when (attempt < 29)
            {
                await Task.Delay(TimeSpan.FromSeconds(2));
            }
        }

        await using (var create = new SqlCommand($"CREATE DATABASE [{database}]", connection))
            await create.ExecuteNonQueryAsync();

        var databaseConnection = new SqlConnectionStringBuilder(admin.ConnectionString)
        {
            InitialCatalog = database
        }.ConnectionString;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(databaseConnection).Options;
        await using var db = new ApplicationDbContext(options);
        await db.Database.MigrateAsync();

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
            LockoutEnabled = true,
            SecurityStamp = Guid.NewGuid().ToString(),
            ConcurrencyStamp = Guid.NewGuid().ToString(),
            CreatedAtUtc = DateTime.UtcNow,
            DisplayName = "SQL E2E Sahibi"
        };
        user.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(user, password);

        var accountId = Guid.NewGuid();
        db.Users.Add(user);
        db.Accounts.Add(new Account
        {
            Id = accountId,
            Name = "SQL browser E2E",
            Status = "ACTIVE",
            CreatedAtUtc = DateTime.UtcNow
        });
        db.AccountMembers.Add(new AccountMember
        {
            AccountId = accountId,
            UserId = user.Id,
            Role = "OWNER",
            Status = "ACTIVE"
        });
        db.AccountPlans.Add(new AccountPlan { AccountId = accountId, Code = "PILOT" });
        db.AccountEntitlements.Add(new AccountEntitlement
        {
            AccountId = accountId,
            Code = "UNIT_LIMIT",
            LimitValue = 50
        });
        await db.SaveChangesAsync();
    }
}

public sealed class SqlBrowserE2EFactAttribute : FactAttribute
{
    public SqlBrowserE2EFactAttribute()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("MULK_SQL_E2E_ENABLED"), "true",
            StringComparison.OrdinalIgnoreCase))
            Skip = "Opt-in SQL browser E2E seeding is disabled.";
    }
}
