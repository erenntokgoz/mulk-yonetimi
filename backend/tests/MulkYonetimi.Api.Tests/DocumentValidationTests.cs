using MulkYonetimi.Api;

namespace MulkYonetimi.Api.Tests;

public sealed class DocumentValidationTests
{
    [Theory]
    [InlineData("application/pdf", new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2d })]
    [InlineData("image/jpeg", new byte[] { 0xff, 0xd8, 0xff, 0x00 })]
    [InlineData("image/png", new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a })]
    public void Accepts_only_the_signature_for_the_declared_document_type(string contentType, byte[] signature)
    {
        Assert.True(DocumentEndpoints.MatchesSignature(signature, contentType));
        Assert.False(DocumentEndpoints.MatchesSignature(signature, "application/octet-stream"));
    }

    [Fact]
    public void Rejects_a_truncated_or_mismatched_signature()
    {
        Assert.False(DocumentEndpoints.MatchesSignature([0x25, 0x50, 0x44], "application/pdf"));
        Assert.False(DocumentEndpoints.MatchesSignature([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], "image/png"));
    }
}
