using MulkYonetimi.Api;
using Microsoft.Extensions.Configuration;

namespace MulkYonetimi.Api.Tests;

public sealed class DocumentDownloadContentTypeTests
{
    [Fact]
    public void Download_url_serves_the_stored_content_type_instead_of_octet_stream()
    {
        var options = DocumentStorageOptions.FromConfiguration(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:R2AccountId"] = "0123456789abcdef0123456789abcdef",
                ["Storage:R2BucketName"] = "mulk-test-bucket",
                ["Storage:R2AccessKeyId"] = "test-access-key-id",
                ["Storage:R2SecretAccessKey"] = "test-secret-access-key"
            }).Build());
        using var storage = new R2DocumentStorage(options);

        var url = new Uri(storage.CreateDownloadUrl("doc_obj_1", "kira sözleşmesi.pdf", "application/pdf"));
        var query = System.Web.HttpUtility.ParseQueryString(url.Query);

        Assert.Equal("application/pdf", query["response-content-type"]);
        Assert.StartsWith("attachment; filename*=UTF-8''", query["response-content-disposition"]);
    }
}
