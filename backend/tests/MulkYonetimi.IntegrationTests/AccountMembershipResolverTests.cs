using System.Security.Claims;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.IntegrationTests;

public sealed class AccountMembershipResolverTests
{
    [Fact]
    public async Task Resolves_only_the_verified_users_single_active_membership()
    {
        var admin = Environment.GetEnvironmentVariable("MULK_SQL_TEST_ADMIN_CONNECTION")
            ?? throw new InvalidOperationException("MULK_SQL_TEST_ADMIN_CONNECTION is required for integration tests.");
        var builder = new SqlConnectionStringBuilder(admin) { InitialCatalog = "master" };
        var databaseName = $"MulkAccountTest_{Guid.NewGuid():N}";
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

            var accountA = new Account { Id = Guid.NewGuid(), Name = "A" };
            var accountB = new Account { Id = Guid.NewGuid(), Name = "B" };
            var userA = new ApplicationUser { Id = Guid.NewGuid(), UserName = "a@example.test", NormalizedUserName = "A@EXAMPLE.TEST", Email = "a@example.test", NormalizedEmail = "A@EXAMPLE.TEST", EmailConfirmed = true };
            var userB = new ApplicationUser { Id = Guid.NewGuid(), UserName = "b@example.test", NormalizedUserName = "B@EXAMPLE.TEST", Email = "b@example.test", NormalizedEmail = "B@EXAMPLE.TEST", EmailConfirmed = true };
            db.AddRange(accountA, accountB, userA, userB);
            var memberA = new AccountMember { AccountId = accountA.Id, UserId = userA.Id, Role = "OWNER", Status = "ACTIVE" };
            db.AccountMembers.AddRange(memberA,
                new AccountMember { AccountId = accountB.Id, UserId = userB.Id, Role = "OWNER", Status = "ACTIVE" });
            await db.SaveChangesAsync();

            var resolver = new AccountMembershipResolver(db);
            var principalA = Principal(userA.Id, accountB.Id);
            Assert.Equal(accountA.Id, await resolver.ResolveAsync(principalA));
            Assert.Equal(accountB.Id, await resolver.ResolveAsync(Principal(userB.Id)));
            Assert.Null(await resolver.ResolveAsync(new ClaimsPrincipal()));

            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
                host.UseSetting("ConnectionStrings:DefaultConnection", builder.ConnectionString));
            using var scope = factory.Services.CreateScope();
            var signInContext = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
            signInContext.Request.Scheme = "https";
            signInContext.Request.Host = new HostString("localhost");
            await signInContext.SignInAsync(IdentityConstants.ApplicationScheme, principalA);
            var cookie = signInContext.Response.Headers.SetCookie.ToString().Split(';')[0];
            using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
            client.DefaultRequestHeaders.Add("Cookie", cookie);
            using (var response = await client.GetAsync("/api/v1/me"))
            {
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                var me = await response.Content.ReadFromJsonAsync<MeDto>();
                Assert.Equal(accountA.Id, me?.AccountId);
            }

            userA.EmailConfirmed = false;
            await db.SaveChangesAsync();
            Assert.Null(await resolver.ResolveAsync(principalA));

            userA.EmailConfirmed = true;
            memberA.Status = "SUSPENDED";
            await db.SaveChangesAsync();
            Assert.Null(await resolver.ResolveAsync(principalA));
            using (var response = await client.GetAsync("/api/v1/me"))
                Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

            memberA.Status = "ACTIVE";
            db.AccountMembers.Add(new AccountMember { AccountId = accountB.Id, UserId = userA.Id, Role = "OWNER", Status = "ACTIVE" });
            await db.SaveChangesAsync();
            Assert.Null(await resolver.ResolveAsync(principalA));
        }
        finally
        {
            await using var drop = new SqlCommand($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }

    private static ClaimsPrincipal Principal(Guid userId, Guid? misleadingAccountId = null)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId.ToString()) };
        if (misleadingAccountId is { } accountId)
            claims.Add(new Claim("AccountId", accountId.ToString()));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));
    }

    private sealed record MeDto(Guid AccountId);
}
