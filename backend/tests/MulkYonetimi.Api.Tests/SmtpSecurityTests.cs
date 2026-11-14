using MailKit.Security;
using MulkYonetimi.Api;

namespace MulkYonetimi.Api.Tests;

public sealed class SmtpSecurityTests
{
    [Theory]
    [InlineData(465, SecureSocketOptions.SslOnConnect)]
    [InlineData(587, SecureSocketOptions.StartTls)]
    [InlineData(25, SecureSocketOptions.StartTls)]
    public void For_SelectsOptionByPort(int port, SecureSocketOptions expected) =>
        Assert.Equal(expected, SmtpSecurity.For(port));
}
