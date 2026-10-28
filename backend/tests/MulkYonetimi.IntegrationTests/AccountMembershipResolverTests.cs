using System.Security.Claims;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MulkYonetimi.Infrastructure;
using MulkYonetimi.Api;

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
            userA.SecurityStamp = Guid.NewGuid().ToString();
            userA.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(userA, "Valid-Password-123!");
            var userB = new ApplicationUser { Id = Guid.NewGuid(), UserName = "b@example.test", NormalizedUserName = "B@EXAMPLE.TEST", Email = "b@example.test", NormalizedEmail = "B@EXAMPLE.TEST", EmailConfirmed = true };
            db.AddRange(accountA, accountB, userA, userB);
            var memberA = new AccountMember { AccountId = accountA.Id, UserId = userA.Id, Role = "OWNER", Status = "ACTIVE" };
            db.AccountMembers.AddRange(memberA,
                new AccountMember { AccountId = accountB.Id, UserId = userB.Id, Role = "OWNER", Status = "ACTIVE" });
            await db.SaveChangesAsync();

            var resolver = new AccountMembershipResolver(db);
            var principalA = Principal(userA.Id, accountB.Id, userA.SecurityStamp);
            Assert.Equal(accountA.Id, await resolver.ResolveAsync(principalA));
            Assert.Equal(accountB.Id, await resolver.ResolveAsync(Principal(userB.Id)));
            Assert.Null(await resolver.ResolveAsync(new ClaimsPrincipal()));

            var mailer = new FakeMailer();
            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
            {
                host.UseSetting("ConnectionStrings:DefaultConnection", builder.ConnectionString);
                host.UseSetting("Auth:FrontendOrigin", "https://app.example.test");
                host.UseSetting("Email:SmtpHost", "fake");
                host.UseSetting("Email:From", "noreply@example.test");
                host.ConfigureTestServices(services => services.AddSingleton<IConfirmationMailer>(mailer));
            });
            using (var loginClient = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }))
            {
                using var badOrigin = await loginClient.PostAsJsonAsync("/api/v1/auth/login", new { email = userA.Email, password = "Valid-Password-123!" });
                Assert.Equal(HttpStatusCode.Forbidden, badOrigin.StatusCode);
                loginClient.DefaultRequestHeaders.Add("Origin", "https://app.example.test");
                using var registration = await loginClient.PostAsJsonAsync("/api/v1/auth/register", new { email = "new@example.test", password = "Valid-Password-123!", accountName = "New account" });
                Assert.Equal(HttpStatusCode.Accepted, registration.StatusCode);
                using var duplicate = await loginClient.PostAsJsonAsync("/api/v1/auth/register", new { email = "new@example.test", password = "Valid-Password-123!", accountName = "Other account" });
                Assert.Equal(HttpStatusCode.Accepted, duplicate.StatusCode);
                Assert.NotNull(mailer.Url);
                var newUser = await db.Users.SingleAsync(item => item.Email == "new@example.test");
                Assert.False(newUser.EmailConfirmed);
                Assert.Equal(1, await db.AccountMembers.CountAsync(item => item.UserId == newUser.Id));
                using var beforeConfirmation = await loginClient.PostAsJsonAsync("/api/v1/auth/login", new { email = newUser.Email, password = "Valid-Password-123!" });
                Assert.NotEqual(HttpStatusCode.NoContent, beforeConfirmation.StatusCode);
                using var badConfirmation = await loginClient.PostAsJsonAsync("/api/v1/auth/confirm-email", new { userId = newUser.Id, token = "invalid" });
                Assert.Equal(HttpStatusCode.BadRequest, badConfirmation.StatusCode);
                var token = Uri.UnescapeDataString(mailer.Url!.Split("token=")[1]);
                using var confirmation = await loginClient.PostAsJsonAsync("/api/v1/auth/confirm-email", new { userId = newUser.Id, token });
                Assert.Equal(HttpStatusCode.NoContent, confirmation.StatusCode);
                using var afterConfirmation = await loginClient.PostAsJsonAsync("/api/v1/auth/login", new { email = newUser.Email, password = "Valid-Password-123!" });
                Assert.Equal(HttpStatusCode.NoContent, afterConfirmation.StatusCode);
                using var resend = await loginClient.PostAsJsonAsync("/api/v1/auth/resend-confirmation", new { email = "unknown@example.test" });
                Assert.Equal(HttpStatusCode.Accepted, resend.StatusCode);
                using var priorLogin = await loginClient.PostAsJsonAsync("/api/v1/auth/login", new { email = userA.Email, password = "Valid-Password-123!" });
                var priorCookie = priorLogin.Headers.GetValues("Set-Cookie").Single().Split(';')[0];
                using var resetRequest = await loginClient.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = userA.Email });
                Assert.Equal(HttpStatusCode.Accepted, resetRequest.StatusCode);
                Assert.NotNull(mailer.Url);
                var resetToken = Uri.UnescapeDataString(mailer.Url!.Split("token=")[1]);
                using var reset = await loginClient.PostAsJsonAsync("/api/v1/auth/reset-password", new { userId = userA.Id, token = resetToken, password = "New-Password-123!" });
                Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
                using var staleClient = factory.CreateClient();
                staleClient.DefaultRequestHeaders.Add("Cookie", priorCookie);
                using var staleMe = await staleClient.GetAsync("/api/v1/me");
                Assert.Equal(HttpStatusCode.Unauthorized, staleMe.StatusCode);
                using var newPassword = await loginClient.PostAsJsonAsync("/api/v1/auth/login", new { email = userA.Email, password = "New-Password-123!" });
                Assert.Equal(HttpStatusCode.NoContent, newPassword.StatusCode);
                using var oldPassword = await loginClient.PostAsJsonAsync("/api/v1/auth/login", new { email = userA.Email, password = "Valid-Password-123!" });
                Assert.Equal(HttpStatusCode.Unauthorized, oldPassword.StatusCode);
                using var wrongPassword = await loginClient.PostAsJsonAsync("/api/v1/auth/login", new { email = userA.Email, password = "wrong" });
                Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
                using var login = await loginClient.PostAsJsonAsync("/api/v1/auth/login", new { email = userA.Email, password = "New-Password-123!" });
                Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
                var loginCookie = login.Headers.GetValues("Set-Cookie").Single().Split(';')[0];
                loginClient.DefaultRequestHeaders.Add("Cookie", loginCookie);
                using var meAfterLogin = await loginClient.GetAsync("/api/v1/me");
                Assert.Equal(HttpStatusCode.OK, meAfterLogin.StatusCode);
                using var logout = await loginClient.PostAsJsonAsync("/api/v1/auth/logout", new { });
                Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
                Assert.Contains("mulk.session=", logout.Headers.GetValues("Set-Cookie").Single());
            }
            await db.Entry(userA).ReloadAsync();
            principalA = Principal(userA.Id, accountB.Id, userA.SecurityStamp);
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

            await db.Entry(userA).ReloadAsync();
            principalA = Principal(userA.Id, accountB.Id, userA.SecurityStamp);
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
            using var rateClient = factory.CreateClient();
            rateClient.DefaultRequestHeaders.Add("Origin", "https://app.example.test");
            var statuses = new List<HttpStatusCode>();
            for (var attempt = 0; attempt < 40; attempt++)
            {
                using var response = await rateClient.PostAsJsonAsync("/api/v1/auth/resend-confirmation", new { email = "missing@example.test" });
                statuses.Add(response.StatusCode);
                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                    Assert.Equal("60", response.Headers.RetryAfter?.ToString());
            }
            Assert.Contains(HttpStatusCode.TooManyRequests, statuses);
        }
        finally
        {
            await using var drop = new SqlCommand($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }

    private static ClaimsPrincipal Principal(Guid userId, Guid? misleadingAccountId = null, string? securityStamp = null)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId.ToString()) };
        if (misleadingAccountId is { } accountId)
            claims.Add(new Claim("AccountId", accountId.ToString()));
        if (securityStamp is not null)
            claims.Add(new Claim("AspNet.Identity.SecurityStamp", securityStamp));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));
    }

    private sealed record MeDto(Guid AccountId);

    private sealed class FakeMailer : IConfirmationMailer
    {
        public string? Url { get; private set; }
        public Task SendAsync(string address, string confirmationUrl, CancellationToken cancellationToken)
        {
            Url = confirmationUrl;
            return Task.CompletedTask;
        }
        public Task SendPasswordResetAsync(string address, string resetUrl, CancellationToken cancellationToken)
        {
            Url = resetUrl;
            return Task.CompletedTask;
        }
    }
}
