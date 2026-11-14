using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MulkYonetimi.Api;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.IntegrationTests;

public sealed class DocumentIsolationTests
{
    private const string Origin = "https://app.example.test";
    private const string Password = "Document-Test-123!";

    [Fact]
    public async Task Documents_are_tenant_scoped_and_missing_R2_configuration_fails_closed()
    {
        var admin = Environment.GetEnvironmentVariable("MULK_SQL_TEST_ADMIN_CONNECTION")
            ?? throw new InvalidOperationException("MULK_SQL_TEST_ADMIN_CONNECTION is required for integration tests.");
        var connection = new SqlConnectionStringBuilder(admin)
        {
            InitialCatalog = $"MulkDocumentsTest_{Guid.NewGuid():N}"
        }.ConnectionString;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        await using var db = new ApplicationDbContext(options);

        try
        {
            await db.Database.MigrateAsync();
            var (accountA, userA, propertyA) = AddOwner(db, "document-a");
            var (accountB, userB, propertyB) = AddOwner(db, "document-b");
            var documentA = AddDocument(accountA.Id, propertyA.Id, "accounts/a/documents/a/active");
            var documentB = AddDocument(accountB.Id, propertyB.Id, "accounts/b/documents/b/active");
            db.Documents.AddRange(documentA, documentB);
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

            using (var contract = await clientA.GetAsync("/openapi/v1.json"))
            {
                using var json = JsonDocument.Parse(await contract.Content.ReadAsStringAsync());
                var paths = json.RootElement.GetProperty("paths");
                Assert.True(paths.TryGetProperty("/api/v1/documents", out _));
                Assert.True(paths.TryGetProperty("/api/v1/documents/upload-intents", out _));
                Assert.True(paths.TryGetProperty("/api/v1/documents/{id}/complete", out _));
                Assert.True(paths.TryGetProperty("/api/v1/documents/{id}/download-url", out _));
            }

            using var listA = await clientA.GetAsync("/api/v1/documents");
            using var listB = await clientB.GetAsync("/api/v1/documents");
            Assert.Equal(HttpStatusCode.OK, listA.StatusCode);
            Assert.Equal(HttpStatusCode.OK, listB.StatusCode);
            using var listJsonA = JsonDocument.Parse(await listA.Content.ReadAsStringAsync());
            using var listJsonB = JsonDocument.Parse(await listB.Content.ReadAsStringAsync());
            Assert.Equal(documentA.Id.ToString(), listJsonA.RootElement.GetProperty("items")[0].GetProperty("id").GetString());
            Assert.Equal(documentB.Id.ToString(), listJsonB.RootElement.GetProperty("items")[0].GetProperty("id").GetString());

            using var foreignDownload = await clientB.GetAsync($"/api/v1/documents/{documentA.Id}/download-url");
            using var ownDownload = await clientB.GetAsync($"/api/v1/documents/{documentB.Id}/download-url");
            Assert.Equal(HttpStatusCode.NotFound, foreignDownload.StatusCode);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, ownDownload.StatusCode);

            var before = await db.Documents.CountAsync();
            using var uploadIntent = await clientA.PostAsJsonAsync("/api/v1/documents/upload-intents", new
            {
                propertyId = propertyA.Id,
                originalName = "lease.pdf",
                contentType = "application/pdf",
                sizeBytes = 4
            });
            Assert.Equal(HttpStatusCode.ServiceUnavailable, uploadIntent.StatusCode);
            Assert.Equal(before, await db.Documents.CountAsync());

            using var foreignDelete = await clientA.DeleteAsync($"/api/v1/documents/{documentB.Id}");
            Assert.Equal(HttpStatusCode.NotFound, foreignDelete.StatusCode);
            using var ownDelete = await clientA.DeleteAsync($"/api/v1/documents/{documentA.Id}");
            Assert.Equal(HttpStatusCode.NoContent, ownDelete.StatusCode);
            Assert.Equal("DELETED", (await db.Documents.AsNoTracking()
                .SingleAsync(item => item.Id == documentA.Id)).Status);
            using var repeatedDelete = await clientA.DeleteAsync($"/api/v1/documents/{documentA.Id}");
            Assert.Equal(HttpStatusCode.NoContent, repeatedDelete.StatusCode);

            var pending = AddPendingDocument(accountA.Id, propertyA.Id);
            db.Documents.Add(pending);
            await db.SaveChangesAsync();
            var fakeStorage = new FakeDocumentStorage();
            using var scanFactory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
            {
                host.UseSetting("ConnectionStrings:DefaultConnection", connection);
                host.UseSetting("Auth:FrontendOrigin", Origin);
                host.UseSetting("Email:WorkerEnabled", "false");
                host.UseSetting("Notifications:WorkerEnabled", "false");
                host.UseSetting("Storage:R2AccountId", "0123456789abcdef0123456789abcdef");
                host.UseSetting("Storage:R2BucketName", "private-test-bucket");
                host.UseSetting("Storage:R2AccessKeyId", "test-access-key");
                host.UseSetting("Storage:R2SecretAccessKey", "test-secret-key");
                host.ConfigureTestServices(services =>
                {
                    services.RemoveAll<IR2DocumentStorage>();
                    services.AddSingleton<IR2DocumentStorage>(fakeStorage);
                });
            });
            using var scanClient = await SignInAsync(scanFactory, userA);
            using var completion = await scanClient.PostAsync($"/api/v1/documents/{pending.Id}/complete", null);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, completion.StatusCode);
            Assert.Equal(0, fakeStorage.PromoteCalls);
            Assert.Equal("PENDING", (await db.Documents.AsNoTracking()
                .SingleAsync(item => item.Id == pending.Id)).Status);
        }
        finally
        {
            await db.Database.EnsureDeletedAsync();
        }
    }

    private static (Account, ApplicationUser, Property) AddOwner(ApplicationDbContext db, string prefix)
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
        var property = new Property
        {
            Id = Guid.NewGuid(),
            AccountId = account.Id,
            Name = prefix,
            Address = "Ankara",
            Kind = PropertyKind.SINGLE_UNIT
        };
        db.AddRange(account, user, property, new AccountMember
        {
            AccountId = account.Id,
            UserId = user.Id,
            Role = "OWNER",
            Status = "ACTIVE"
        });
        return (account, user, property);
    }

    private static Document AddDocument(Guid accountId, Guid propertyId, string key) => new()
    {
        Id = Guid.NewGuid(),
        AccountId = accountId,
        PropertyId = propertyId,
        UploadObjectKey = $"{key}/upload",
        ObjectKey = key,
        OriginalName = "lease.pdf",
        ContentType = "application/pdf",
        SizeBytes = 128,
        Status = "ACTIVE",
        CreatedAtUtc = DateTime.UtcNow,
        UploadExpiresAtUtc = DateTime.UtcNow,
        CompletedAtUtc = DateTime.UtcNow
    };

    private static Document AddPendingDocument(Guid accountId, Guid propertyId) => new()
    {
        Id = Guid.NewGuid(),
        AccountId = accountId,
        PropertyId = propertyId,
        UploadObjectKey = "accounts/test/pending/upload",
        ObjectKey = "accounts/test/pending/active",
        OriginalName = "pending.pdf",
        ContentType = "application/pdf",
        SizeBytes = 5,
        Status = "PENDING",
        CreatedAtUtc = DateTime.UtcNow,
        UploadExpiresAtUtc = DateTime.UtcNow.AddMinutes(2)
    };

    private static async Task<HttpClient> SignInAsync(WebApplicationFactory<Program> factory, ApplicationUser user)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Origin", Origin);
        using var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { user.Email, Password });
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
        return client;
    }

    private sealed class FakeDocumentStorage : IR2DocumentStorage
    {
        public int PromoteCalls { get; private set; }
        public string CreateUploadUrl(string key, string contentType) => "https://storage.example.test/upload";
        public string CreateDownloadUrl(string key, string fileName) => "https://storage.example.test/download";
        public Task<StoredObjectMetadata> GetMetadataAsync(string key, CancellationToken ct) =>
            Task.FromResult(new StoredObjectMetadata(5, "application/pdf"));
        public Task<byte[]> ReadSignatureAsync(string key, CancellationToken ct) =>
            Task.FromResult(new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2d });
        public Task<byte[]> ReadObjectAsync(string key, CancellationToken ct) =>
            Task.FromResult(new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2d });
        public Task PromoteAsync(string sourceKey, string destinationKey, string contentType, CancellationToken ct)
        {
            PromoteCalls++;
            return Task.CompletedTask;
        }
        public Task DeleteAsync(string key, CancellationToken ct) => Task.CompletedTask;
    }
}
