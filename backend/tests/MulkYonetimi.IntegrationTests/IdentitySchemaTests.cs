using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.IntegrationTests;

public sealed class IdentitySchemaTests
{
    [Fact]
    public async Task Migration_enforces_account_membership_relationships_in_sql_server()
    {
        var admin = Environment.GetEnvironmentVariable("MULK_SQL_TEST_ADMIN_CONNECTION")
            ?? throw new InvalidOperationException("MULK_SQL_TEST_ADMIN_CONNECTION is required for integration tests.");
        var builder = new SqlConnectionStringBuilder(admin) { InitialCatalog = "master" };
        var databaseName = $"MulkIdentityTest_{Guid.NewGuid():N}";
        await using var connection = new SqlConnection(builder.ConnectionString);
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
        await using (var create = new SqlCommand($"CREATE DATABASE [{databaseName}]", connection))
            await create.ExecuteNonQueryAsync();

        try
        {
            builder.InitialCatalog = databaseName;
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseSqlServer(builder.ConnectionString).Options;
            await using var db = new ApplicationDbContext(options);
            await db.Database.MigrateAsync();
            Assert.Empty(await db.Database.GetPendingMigrationsAsync());

            var account = new Account { Id = Guid.NewGuid(), Name = "Owner", CreatedAtUtc = DateTime.UtcNow };
            var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "owner@example.test", NormalizedUserName = "OWNER@EXAMPLE.TEST", Email = "owner@example.test", NormalizedEmail = "OWNER@EXAMPLE.TEST", EmailConfirmed = true };
            db.Accounts.Add(account);
            db.Users.Add(user);
            db.AccountMembers.Add(new AccountMember { AccountId = account.Id, UserId = user.Id, Role = "OWNER", Status = "ACTIVE" });
            await db.SaveChangesAsync();

            db.OutboxMessages.Add(new OutboxMessage
            {
                Id = Guid.NewGuid(),
                AccountId = Guid.NewGuid(),
                Kind = "CONFIRM_EMAIL",
                RecipientEmail = user.Email!,
                ProtectedUrl = "encrypted-payload",
                NextAttemptAtUtc = DateTime.UtcNow
            });
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            db.ChangeTracker.Clear();

            db.AccountMembers.Add(new AccountMember { AccountId = Guid.NewGuid(), UserId = user.Id, Role = "OWNER", Status = "ACTIVE" });
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        }
        finally
        {
            await using var drop = new SqlCommand($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
