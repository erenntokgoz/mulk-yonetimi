using System.Net;
using System.Net.Http.Headers;
using Microsoft.Extensions.Configuration;
using MulkYonetimi.Api;

namespace MulkYonetimi.IntegrationTests;

public sealed class R2AcceptanceTests
{
    [R2Fact]
    [Trait("Category", "ExternalR2")]
    public async Task Private_bucket_signed_upload_and_download_work_against_real_R2()
    {
        var configuration = new ConfigurationBuilder().AddEnvironmentVariables().Build();
        var options = DocumentStorageOptions.FromConfiguration(configuration);
        Assert.True(options.IsConfigured);
        using var storage = new R2DocumentStorage(options);
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        var key = $"acceptance/{Guid.NewGuid():N}.pdf";
        var payload = "%PDF-1.4\nR2 acceptance\n"u8.ToArray();
        try
        {
            var upload = storage.CreateUploadUrl(key, "application/pdf");
            using (var body = new ByteArrayContent(payload))
            {
                body.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
                using var result = await http.PutAsync(upload, body);
                Assert.True(result.IsSuccessStatusCode, $"Signed PUT returned {(int)result.StatusCode}");
            }

            var metadata = await storage.GetMetadataAsync(key, CancellationToken.None);
            Assert.Equal(payload.Length, metadata.SizeBytes);
            Assert.Equal("application/pdf", metadata.ContentType);
            Assert.Equal(payload[..8], await storage.ReadSignatureAsync(key, CancellationToken.None));

            using (var result = await http.GetAsync(storage.CreateDownloadUrl(key, "acceptance.pdf")))
            {
                Assert.Equal(HttpStatusCode.OK, result.StatusCode);
                Assert.Equal(payload, await result.Content.ReadAsByteArrayAsync());
                Assert.Contains("attachment", result.Content.Headers.ContentDisposition?.ToString());
            }

            var unsigned = new Uri(upload).GetLeftPart(UriPartial.Path);
            using var denied = await http.GetAsync(unsigned);
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

            using var wrongBody = new ByteArrayContent(payload);
            wrongBody.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
            using var wrongType = await http.PutAsync(upload, wrongBody);
            Assert.Equal(HttpStatusCode.Forbidden, wrongType.StatusCode);

            var allowedOrigin = Environment.GetEnvironmentVariable("MULK_R2_ALLOWED_ORIGIN");
            var deniedOrigin = Environment.GetEnvironmentVariable("MULK_R2_DENIED_ORIGIN");
            if (!string.IsNullOrWhiteSpace(allowedOrigin) && !string.IsNullOrWhiteSpace(deniedOrigin))
            {
                await AssertCorsAsync(http, upload, allowedOrigin, true);
                await AssertCorsAsync(http, upload, deniedOrigin, false);
            }
        }
        finally
        {
            await storage.DeleteAsync(key, CancellationToken.None);
        }
    }

    private static async Task AssertCorsAsync(HttpClient http, string url, string origin, bool allowed)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, url);
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "PUT");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        using var response = await http.SendAsync(request);
        var actual = response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values)
            ? values.SingleOrDefault() : null;
        Assert.Equal(allowed ? origin : null, actual);
    }
}

public sealed class R2FactAttribute : FactAttribute
{
    public R2FactAttribute()
    {
        if (new[] { "R2AccountId", "R2BucketName", "R2AccessKeyId", "R2SecretAccessKey" }
            .Any(name => string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable($"Storage__{name}"))))
            Skip = "Real R2 acceptance requires all four Storage__R2* environment variables.";
    }
}
