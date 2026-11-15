using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace MulkYonetimi.Api;

internal static class RateLimitClientIdentity
{
    public static string Resolve(HttpContext context, string? signingKey)
    {
        var address = context.Request.Headers["X-Mulk-Client-IP"].ToString();
        var suppliedSignature = context.Request.Headers["X-Mulk-Client-IP-Signature"].ToString();
        if (signingKey is { Length: >= 32 } &&
            IPAddress.TryParse(address, out var parsedAddress) &&
            suppliedSignature.Length == 64 && TryDecodeSignature(suppliedSignature, out var signature))
        {
            var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), Encoding.UTF8.GetBytes(address));
            if (CryptographicOperations.FixedTimeEquals(signature, expected))
                return parsedAddress.ToString();
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static bool TryDecodeSignature(string value, out byte[] signature)
    {
        try
        {
            signature = Convert.FromHexString(value);
            return signature.Length == 32;
        }
        catch (FormatException)
        {
            signature = [];
            return false;
        }
    }
}
