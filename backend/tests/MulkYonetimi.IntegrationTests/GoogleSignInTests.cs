using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MulkYonetimi.Api;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.IntegrationTests;

public sealed class GoogleSignInTests
{
    private const string ClientId = "client-123.apps.googleusercontent.com";
    private const string Origin = "https://app.example.test";
    private const string Password = "Valid-Password-123!";

    [Fact]
    public async Task Google_sign_in_creates_pending_accounts_links_verified_emails_and_signs_in_known_subjects()
    {
        var admin = Environment.GetEnvironmentVariable("MULK_SQL_TEST_ADMIN_CONNECTION")
            ?? throw new InvalidOperationException("MULK_SQL_TEST_ADMIN_CONNECTION is required for integration tests.");
        var builder = new SqlConnectionStringBuilder(admin) { InitialCatalog = "master" };
        var databaseName = $"MulkGoogleTest_{Guid.NewGuid():N}";
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

            var linkedOwner = await SeedOwnerAsync(db, "owner@gmail.com", confirmed: true, accountStatus: "ACTIVE");
            var outsideOwner = await SeedOwnerAsync(db, "owner@company.example", confirmed: true, accountStatus: "ACTIVE");
            var preRegistered = await SeedOwnerAsync(db, "victim@gmail.com", confirmed: false, accountStatus: "PENDING");
            var outsideProperty = new Property
            {
                Id = Guid.NewGuid(),
                AccountId = outsideOwner.AccountId,
                Name = "Other property",
                Address = "Other address"
            };
            db.Properties.Add(outsideProperty);
            await db.SaveChangesAsync();

            var validator = new FakeValidator();
            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
            {
                host.UseSetting("ConnectionStrings:DefaultConnection", builder.ConnectionString);
                host.UseSetting("Auth:FrontendOrigin", Origin);
                host.UseSetting("Auth:Google:ClientId", ClientId);
                host.UseSetting("Email:WorkerEnabled", "false");
                host.UseSetting("Notifications:WorkerEnabled", "false");
                host.UseSetting("RentCharges:WorkerEnabled", "false");
                host.UseSetting("Pilot:DefaultUnitLimit", "3");
                host.ConfigureTestServices(services => services.AddSingleton<IGoogleIdTokenValidator>(validator));
            });
            using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
            client.DefaultRequestHeaders.Add("Origin", Origin);

            // Reddedilen belirteçler hesap oluşturmaz.
            validator.Claims = Claims("sub-rejected", "rejected@gmail.com", audience: "other-client");
            await AssertStatusAsync(client, HttpStatusCode.Unauthorized);
            validator.Claims = Claims("sub-rejected", "rejected@gmail.com", emailVerified: false);
            await AssertStatusAsync(client, HttpStatusCode.Unauthorized);
            validator.Claims = Claims("sub-rejected", "rejected@gmail.com");
            await AssertStatusAsync(client, HttpStatusCode.Unauthorized, nonce: "different-nonce");
            Assert.False(await db.Users.AnyAsync(user => user.Email == "rejected@gmail.com"));

            validator.Claims = Claims("sub-untrusted-email", "new.owner@company.example");
            await AssertStatusAsync(client, HttpStatusCode.Conflict);
            Assert.False(await db.Users.AnyAsync(user => user.Email == "new.owner@company.example"));

            // Yeni kullanıcı: doğrulanmış e-posta, parolasız, pilot onayı bekleyen hesap.
            validator.Claims = Claims("sub-new", "new.owner@gmail.com", name: "Yeni Sahip");
            using (var created = await SignInAsync(client))
            {
                Assert.Equal((HttpStatusCode)423, created.StatusCode);
                Assert.False(created.Headers.Contains("Set-Cookie"));
            }
            var newUser = await db.Users.AsNoTracking().SingleAsync(user => user.Email == "new.owner@gmail.com");
            Assert.True(newUser.EmailConfirmed);
            Assert.Null(newUser.PasswordHash);
            Assert.Equal("Yeni Sahip", newUser.DisplayName);
            Assert.True(await db.UserLogins.AnyAsync(login =>
                login.LoginProvider == "Google" && login.ProviderKey == "sub-new" && login.UserId == newUser.Id));
            var newMember = await db.AccountMembers.AsNoTracking().SingleAsync(member => member.UserId == newUser.Id);
            Assert.Equal(("OWNER", "ACTIVE"), (newMember.Role, newMember.Status));
            var newAccount = await db.Accounts.AsNoTracking().SingleAsync(account => account.Id == newMember.AccountId);
            Assert.Equal(("Yeni Sahip", "PENDING"), (newAccount.Name, newAccount.Status));
            Assert.Equal("PILOT", (await db.AccountPlans.AsNoTracking().SingleAsync(plan => plan.AccountId == newAccount.Id)).Code);
            Assert.Equal(3, (await db.AccountEntitlements.AsNoTracking().SingleAsync(item =>
                item.AccountId == newAccount.Id && item.Code == "UNIT_LIMIT")).LimitValue);
            using (var again = await SignInAsync(client)) Assert.Equal((HttpStatusCode)423, again.StatusCode);
            Assert.Equal(1, await db.Users.CountAsync(user => user.Email == "new.owner@gmail.com"));

            // Profil adı yoksa hesap adı e-postanın yerel kısmıdır.
            validator.Claims = Claims("sub-unnamed", "unnamed.owner@gmail.com", name: null);
            using (var unnamed = await SignInAsync(client)) Assert.Equal((HttpStatusCode)423, unnamed.StatusCode);
            Assert.True(await (from member in db.AccountMembers
                               join user in db.Users on member.UserId equals user.Id
                               join account in db.Accounts on member.AccountId equals account.Id
                               where user.Email == "unnamed.owner@gmail.com"
                               select account.Name).AnyAsync(name => name == "unnamed.owner"));

            // Onaydan sonra bilinen Google kimliği (sub) e-posta değişse de aynı kullanıcıyla oturum açar.
            await db.Accounts.Where(account => account.Id == newAccount.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(account => account.Status, "ACTIVE"));
            validator.Claims = Claims("sub-new", "owner@company.example");
            using (var known = await SignInAsync(client))
            {
                Assert.Equal(HttpStatusCode.NoContent, known.StatusCode);
                Assert.Equal(newAccount.Id, await MeAsync(factory, known));
                using var authenticated = SessionClient(factory, known);
                using var otherProperty = await authenticated.GetAsync($"/api/v1/properties/{outsideProperty.Id}");
                Assert.Equal(HttpStatusCode.NotFound, otherProperty.StatusCode);
            }

            // Kayıtlı ve Google'ın sahibi olduğu e-posta bağlanır; parola girişi çalışmaya devam eder.
            validator.Claims = Claims("sub-owner", "owner@gmail.com");
            using (var linked = await SignInAsync(client))
            {
                Assert.Equal(HttpStatusCode.NoContent, linked.StatusCode);
                Assert.Equal(linkedOwner.AccountId, await MeAsync(factory, linked));
            }
            Assert.True(await db.UserLogins.AnyAsync(login =>
                login.LoginProvider == "Google" && login.ProviderKey == "sub-owner" && login.UserId == linkedOwner.UserId));
            Assert.Single(await db.AuditEvents.AsNoTracking().Where(audit => audit.AccountId == linkedOwner.AccountId &&
                audit.Action == "EXTERNAL_LOGIN_LINKED" && audit.ActorUserId == linkedOwner.UserId).ToArrayAsync());
            validator.Claims = Claims("SUB-OWNER", "owner@gmail.com");
            await AssertStatusAsync(client, HttpStatusCode.Conflict);
            validator.Claims = Claims("different-sub", "owner@gmail.com");
            await AssertStatusAsync(client, HttpStatusCode.Conflict);
            Assert.False(await db.UserLogins.AnyAsync(login => login.ProviderKey == "different-sub"));
            using (var password = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "owner@gmail.com", password = Password }))
                Assert.Equal(HttpStatusCode.NoContent, password.StatusCode);

            // Google'ın sahibi olmadığı adres mevcut hesaba bağlanmaz; Workspace (hd) adresi bağlanır.
            validator.Claims = Claims("sub-outside", "owner@company.example");
            using (var refused = await SignInAsync(client))
            {
                Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
                Assert.False(refused.Headers.Contains("Set-Cookie"));
            }
            Assert.False(await db.UserLogins.AnyAsync(login => login.UserId == outsideOwner.UserId));
            validator.Claims = Claims("sub-outside", "owner@company.example", hostedDomain: "company.example");
            using (var workspace = await SignInAsync(client)) Assert.Equal(HttpStatusCode.NoContent, workspace.StatusCode);
            Assert.True(await db.UserLogins.AnyAsync(login => login.UserId == outsideOwner.UserId && login.ProviderKey == "sub-outside"));

            // Doğrulanmamış ön kayıt: adresin sahibi Google ile gelince e-posta doğrulanır, önceki parola geçersizleşir.
            validator.Claims = Claims("sub-victim", "victim@gmail.com");
            using (var reclaimed = await SignInAsync(client)) Assert.Equal((HttpStatusCode)423, reclaimed.StatusCode);
            var victim = await db.Users.AsNoTracking().SingleAsync(user => user.Id == preRegistered.UserId);
            Assert.True(victim.EmailConfirmed);
            Assert.Null(victim.PasswordHash);
            Assert.NotEqual(preRegistered.SecurityStamp, victim.SecurityStamp);
            Assert.True(await db.UserLogins.AnyAsync(login => login.UserId == victim.Id && login.ProviderKey == "sub-victim"));
            using (var oldPassword = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "victim@gmail.com", password = Password }))
                Assert.Equal(HttpStatusCode.Unauthorized, oldPassword.StatusCode);
        }
        finally
        {
            await using var drop = new SqlCommand($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }

    private static GoogleIdTokenClaims Claims(string subject, string email, string audience = ClientId,
        bool emailVerified = true, string? name = "Google Kullanıcısı", string? hostedDomain = null) =>
        new("https://accounts.google.com", [audience], DateTime.UtcNow.AddMinutes(30), subject, email, emailVerified,
            name, "expected-nonce", hostedDomain);

    private static Task<HttpResponseMessage> SignInAsync(HttpClient client, string nonce = "expected-nonce") =>
        client.PostAsJsonAsync("/api/v1/auth/google", new { idToken = "signed-by-google", nonce });

    private static async Task AssertStatusAsync(HttpClient client, HttpStatusCode expected, string nonce = "expected-nonce")
    {
        using var response = await SignInAsync(client, nonce);
        Assert.Equal(expected, response.StatusCode);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    private static async Task<Guid?> MeAsync(WebApplicationFactory<Program> factory, HttpResponseMessage signIn)
    {
        using var client = SessionClient(factory, signIn);
        using var response = await client.GetAsync("/api/v1/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<MeDto>())?.AccountId;
    }

    private static HttpClient SessionClient(WebApplicationFactory<Program> factory, HttpResponseMessage signIn)
    {
        var cookie = signIn.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("mulk.session=", StringComparison.Ordinal));
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Cookie", cookie.Split(';')[0]);
        return client;
    }

    private static async Task<SeededOwner> SeedOwnerAsync(ApplicationDbContext db, string email, bool confirmed,
        string accountStatus)
    {
        var account = new Account { Id = Guid.NewGuid(), Name = email, Status = accountStatus };
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = confirmed,
            LockoutEnabled = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };
        user.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(user, Password);
        db.AddRange(account, user);
        db.AccountMembers.Add(new AccountMember { AccountId = account.Id, UserId = user.Id, Role = "OWNER", Status = "ACTIVE" });
        await db.SaveChangesAsync();
        return new SeededOwner(user.Id, account.Id, user.SecurityStamp);
    }

    private sealed record SeededOwner(Guid UserId, Guid AccountId, string SecurityStamp);

    private sealed record MeDto(Guid AccountId);

    private sealed class FakeValidator : IGoogleIdTokenValidator
    {
        public GoogleIdTokenClaims? Claims { get; set; }

        public Task<GoogleIdTokenClaims?> ValidateAsync(string idToken, string clientId, CancellationToken cancellationToken) =>
            Task.FromResult(Claims);
    }
}
