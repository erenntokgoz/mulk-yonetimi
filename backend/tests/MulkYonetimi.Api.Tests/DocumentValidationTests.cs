using MulkYonetimi.Api;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace MulkYonetimi.Api.Tests;

public sealed class DocumentValidationTests
{
    [Theory]
    [InlineData("stream: OK\0", DocumentScanVerdict.Clean)]
    [InlineData("stream: Eicar-Test-Signature FOUND\0", DocumentScanVerdict.ThreatDetected)]
    [InlineData("stream: ERROR\0", DocumentScanVerdict.Unavailable)]
    public async Task Clamav_protocol_fails_closed_and_interprets_verdict(string answer, DocumentScanVerdict expected)
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var server = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            var stream = client.GetStream();
            var command = new byte[10];
            await stream.ReadExactlyAsync(command);
            Assert.Equal("zINSTREAM\0", Encoding.ASCII.GetString(command));
            var blockLength = new byte[4];
            await stream.ReadExactlyAsync(blockLength);
            Assert.Equal(5u, System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(blockLength));
            var payload = new byte[5];
            await stream.ReadExactlyAsync(payload);
            Assert.Equal("EICAR", Encoding.ASCII.GetString(payload));
            await stream.ReadExactlyAsync(blockLength);
            Assert.Equal(0u, System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(blockLength));
            await stream.WriteAsync(Encoding.ASCII.GetBytes(answer));
        });
        var verdict = await ClamAvScanner.ScanPayloadAsync("127.0.0.1", port, "EICAR"u8.ToArray(),
            CancellationToken.None);
        await server;
        Assert.Equal(expected, verdict);
    }

    [Fact]
    public async Task Clamav_connection_failure_is_unavailable()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        Assert.Equal(DocumentScanVerdict.Unavailable,
            await ClamAvScanner.ScanPayloadAsync("127.0.0.1", port, [1], CancellationToken.None));
    }

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
