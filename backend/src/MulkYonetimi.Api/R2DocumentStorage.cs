using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using System.Text.RegularExpressions;

namespace MulkYonetimi.Api;

public sealed class DocumentStorageOptions
{
    public string? AccountId { get; }
    public string? BucketName { get; }
    public string? AccessKeyId { get; }
    public string? SecretAccessKey { get; }
    public long MaximumFileSizeBytes { get; }
    public int MaximumDocumentCountPerAccount { get; }
    public long MaximumStorageBytesPerAccount { get; }
    public int PutUrlSeconds { get; }
    public int GetUrlSeconds { get; }

    private DocumentStorageOptions(string? accountId, string? bucketName, string? accessKeyId,
        string? secretAccessKey, long maximumFileSizeBytes, int maximumDocumentCountPerAccount,
        long maximumStorageBytesPerAccount, int putUrlSeconds, int getUrlSeconds)
    {
        AccountId = accountId;
        BucketName = bucketName;
        AccessKeyId = accessKeyId;
        SecretAccessKey = secretAccessKey;
        MaximumFileSizeBytes = maximumFileSizeBytes;
        MaximumDocumentCountPerAccount = maximumDocumentCountPerAccount;
        MaximumStorageBytesPerAccount = maximumStorageBytesPerAccount;
        PutUrlSeconds = putUrlSeconds;
        GetUrlSeconds = getUrlSeconds;
    }

    public bool IsConfigured => Regex.IsMatch(AccountId ?? "", "^[a-fA-F0-9]{32}$") &&
        Regex.IsMatch(BucketName ?? "", "^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$") &&
        !string.IsNullOrWhiteSpace(AccessKeyId) &&
        !string.IsNullOrWhiteSpace(SecretAccessKey);

    public static DocumentStorageOptions FromConfiguration(IConfiguration configuration)
    {
        var maximum = configuration.GetValue<long?>("Storage:MaximumFileSizeBytes") ?? 10 * 1024 * 1024;
        var maximumCount = configuration.GetValue<int?>("Storage:MaximumDocumentCountPerAccount") ?? 1000;
        var maximumTotal = configuration.GetValue<long?>("Storage:MaximumStorageBytesPerAccount") ?? 1024L * 1024 * 1024;
        if (maximumCount < 1 || maximumTotal < 1)
            throw new InvalidOperationException("Document quota configuration values must be positive.");
        var putSeconds = configuration.GetValue<int?>("Storage:PutUrlSeconds") ?? 120;
        var getSeconds = configuration.GetValue<int?>("Storage:GetUrlSeconds") ?? 60;
        return new DocumentStorageOptions(configuration["Storage:R2AccountId"],
            configuration["Storage:R2BucketName"], configuration["Storage:R2AccessKeyId"],
            configuration["Storage:R2SecretAccessKey"], Math.Clamp(maximum, 1, 25 * 1024 * 1024),
            maximumCount, maximumTotal,
            Math.Clamp(putSeconds, 30, 300), Math.Clamp(getSeconds, 30, 300));
    }
}

public sealed record StoredObjectMetadata(long SizeBytes, string? ContentType);

public interface IR2DocumentStorage
{
    string CreateUploadUrl(string key, string contentType);
    string CreateDownloadUrl(string key, string fileName);
    Task<StoredObjectMetadata> GetMetadataAsync(string key, CancellationToken ct);
    Task<byte[]> ReadSignatureAsync(string key, CancellationToken ct);
    Task<byte[]> ReadObjectAsync(string key, CancellationToken ct);
    Task PromoteAsync(string sourceKey, string destinationKey, string contentType, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);
}

public sealed class R2DocumentStorage : IR2DocumentStorage, IDisposable
{
    private readonly IAmazonS3 client;
    private readonly DocumentStorageOptions options;

    public R2DocumentStorage(DocumentStorageOptions options)
    {
        this.options = options;
        var config = new AmazonS3Config
        {
            ServiceURL = $"https://{options.AccountId}.r2.cloudflarestorage.com",
            AuthenticationRegion = "auto",
            ForcePathStyle = false
        };
        client = new AmazonS3Client(new BasicAWSCredentials(options.AccessKeyId, options.SecretAccessKey), config);
    }

    public string CreateUploadUrl(string key, string contentType) => client.GetPreSignedURL(new GetPreSignedUrlRequest
    {
        BucketName = options.BucketName,
        Key = key,
        Verb = HttpVerb.PUT,
        Expires = DateTime.UtcNow.AddSeconds(options.PutUrlSeconds),
        ContentType = contentType
    });

    public string CreateDownloadUrl(string key, string fileName) => client.GetPreSignedURL(new GetPreSignedUrlRequest
    {
        BucketName = options.BucketName,
        Key = key,
        Verb = HttpVerb.GET,
        Expires = DateTime.UtcNow.AddSeconds(options.GetUrlSeconds),
        ResponseHeaderOverrides = new ResponseHeaderOverrides
        {
            ContentType = "application/octet-stream",
            ContentDisposition = $"attachment; filename*=UTF-8''{Uri.EscapeDataString(fileName)}"
        }
    });

    public async Task<StoredObjectMetadata> GetMetadataAsync(string key, CancellationToken ct)
    {
        var response = await client.GetObjectMetadataAsync(new GetObjectMetadataRequest
        {
            BucketName = options.BucketName,
            Key = key
        }, ct);
        return new StoredObjectMetadata(response.Headers.ContentLength, response.Headers.ContentType);
    }

    public async Task<byte[]> ReadSignatureAsync(string key, CancellationToken ct)
    {
        using var response = await client.GetObjectAsync(new GetObjectRequest
        {
            BucketName = options.BucketName,
            Key = key,
            ByteRange = new ByteRange(0, 7)
        }, ct);
        var bytes = new byte[8];
        var read = await response.ResponseStream.ReadAsync(bytes, ct);
        return bytes[..read];
    }

    public async Task<byte[]> ReadObjectAsync(string key, CancellationToken ct)
    {
        using var response = await client.GetObjectAsync(new GetObjectRequest
        {
            BucketName = options.BucketName,
            Key = key
        }, ct);
        await using var buffer = new MemoryStream();
        var chunk = new byte[8192];
        int read;
        while ((read = await response.ResponseStream.ReadAsync(chunk, ct)) != 0)
        {
            if (buffer.Length + read > options.MaximumFileSizeBytes)
                throw new InvalidOperationException("Stored document exceeds the configured size limit.");
            await buffer.WriteAsync(chunk.AsMemory(0, read), ct);
        }
        return buffer.ToArray();
    }

    public async Task PromoteAsync(string sourceKey, string destinationKey, string contentType,
        CancellationToken ct)
    {
        await client.CopyObjectAsync(new CopyObjectRequest
        {
            SourceBucket = options.BucketName,
            SourceKey = sourceKey,
            DestinationBucket = options.BucketName,
            DestinationKey = destinationKey,
            MetadataDirective = S3MetadataDirective.REPLACE,
            ContentType = contentType,
            ContentDisposition = "attachment",
            CacheControl = "private, no-store"
        }, ct);
    }

    public async Task DeleteAsync(string key, CancellationToken ct) =>
        _ = await client.DeleteObjectAsync(new DeleteObjectRequest { BucketName = options.BucketName, Key = key }, ct);

    public void Dispose() => client.Dispose();
}

public sealed class UnconfiguredR2DocumentStorage : IR2DocumentStorage
{
    private static InvalidOperationException MissingConfiguration() =>
        new("Private R2 storage is not configured.");

    public string CreateUploadUrl(string key, string contentType) => throw MissingConfiguration();
    public string CreateDownloadUrl(string key, string fileName) => throw MissingConfiguration();
    public Task<StoredObjectMetadata> GetMetadataAsync(string key, CancellationToken ct) => Task.FromException<StoredObjectMetadata>(MissingConfiguration());
    public Task<byte[]> ReadSignatureAsync(string key, CancellationToken ct) => Task.FromException<byte[]>(MissingConfiguration());
    public Task<byte[]> ReadObjectAsync(string key, CancellationToken ct) => Task.FromException<byte[]>(MissingConfiguration());
    public Task PromoteAsync(string sourceKey, string destinationKey, string contentType, CancellationToken ct) => Task.FromException(MissingConfiguration());
    public Task DeleteAsync(string key, CancellationToken ct) => Task.FromException(MissingConfiguration());
}
