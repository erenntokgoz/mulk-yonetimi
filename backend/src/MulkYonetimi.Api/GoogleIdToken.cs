using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace MulkYonetimi.Api;

public sealed record GoogleSignInRequest(string IdToken, string Nonce);

// İmzası doğrulanmış kimlik belirtecinden okunan iddialar; kabul kararı GoogleIdTokenRules'tadır.
public sealed record GoogleIdTokenClaims(string Issuer, IReadOnlyList<string> Audiences, DateTime ExpiresAtUtc,
    string Subject, string? Email, bool EmailVerified, string? Name, string? Nonce, string? HostedDomain);

public sealed record GoogleIdentity(string Subject, string Email, string? Name, bool EmailIsAuthoritative);

public sealed class GoogleKeysUnavailableException(Exception inner)
    : Exception("Google signing keys could not be loaded.", inner);

public interface IGoogleIdTokenValidator
{
    /// <summary>İmza, yayıncı, hedef kitle ve süre geçersizse null döner.</summary>
    Task<GoogleIdTokenClaims?> ValidateAsync(string idToken, string clientId, CancellationToken cancellationToken);
}

public static class GoogleIdTokenRules
{
    public static readonly TimeSpan ClockSkew = TimeSpan.FromMinutes(2);
    internal static readonly string[] Issuers = ["https://accounts.google.com", "accounts.google.com"];

    // Doğrulayıcı sahte de olsa (testler) yayıncı, kitle, süre, nonce ve doğrulanmış e-posta burada yeniden zorunlu tutulur.
    public static GoogleIdentity? Accept(GoogleIdTokenClaims claims, string clientId, string nonce, DateTime nowUtc)
    {
        if (!Issuers.Contains(claims.Issuer, StringComparer.Ordinal)) return null;
        if (claims.Audiences.Count != 1 || !string.Equals(claims.Audiences[0], clientId, StringComparison.Ordinal))
            return null;
        if (claims.ExpiresAtUtc.Add(ClockSkew) <= nowUtc) return null;
        if (claims.Nonce is null || !FixedTimeEquals(claims.Nonce, nonce)) return null;
        if (!claims.EmailVerified) return null;
        var email = claims.Email?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > 256 || !new EmailAddressAttribute().IsValid(email))
            return null;
        if (string.IsNullOrWhiteSpace(claims.Subject) || claims.Subject.Length > 255) return null;
        var name = claims.Name?.Trim();
        return new GoogleIdentity(claims.Subject, email, string.IsNullOrEmpty(name) ? null : name,
            IsAuthoritative(email, claims.HostedDomain));
    }

    // Google yalnız Gmail adreslerinde ve Workspace (hd) hesaplarında e-postanın gerçek sahibidir. Diğer adreslerde
    // email_verified geçmişteki bir doğrulamayı gösterir; o adres artık başkasında olabilir, bu yüzden mevcut hesaba
    // otomatik bağlanmaz.
    internal static bool IsAuthoritative(string email, string? hostedDomain)
    {
        if (!string.IsNullOrWhiteSpace(hostedDomain)) return true;
        var domain = email[(email.LastIndexOf('@') + 1)..];
        return domain.Equals("gmail.com", StringComparison.OrdinalIgnoreCase) ||
               domain.Equals("googlemail.com", StringComparison.OrdinalIgnoreCase);
    }

    private static bool FixedTimeEquals(string left, string right)
    {
        var a = Encoding.UTF8.GetBytes(left);
        var b = Encoding.UTF8.GetBytes(right);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }
}

// Google'ın yayımladığı JWKS anahtarlarıyla RS256 imzasını doğrular; anahtarlar ConfigurationManager ile önbelleklenir.
public sealed class GoogleJwksIdTokenValidator(IConfigurationManager<OpenIdConnectConfiguration> metadata)
    : IGoogleIdTokenValidator
{
    public const string DiscoveryUrl = "https://accounts.google.com/.well-known/openid-configuration";
    private readonly JsonWebTokenHandler handler = new() { MapInboundClaims = false };

    public static GoogleJwksIdTokenValidator ForGoogle() => new(new ConfigurationManager<OpenIdConnectConfiguration>(
        DiscoveryUrl, new OpenIdConnectConfigurationRetriever(),
        new HttpDocumentRetriever(new HttpClient { Timeout = TimeSpan.FromSeconds(10) }) { RequireHttps = true }));

    public async Task<GoogleIdTokenClaims?> ValidateAsync(string idToken, string clientId,
        CancellationToken cancellationToken)
    {
        OpenIdConnectConfiguration configuration;
        try
        {
            configuration = await metadata.GetConfigurationAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new GoogleKeysUnavailableException(exception);
        }

        var result = await handler.ValidateTokenAsync(idToken, new TokenValidationParameters
        {
            ValidIssuers = GoogleIdTokenRules.Issuers,
            ValidAudience = clientId,
            IssuerSigningKeys = configuration.SigningKeys,
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
            RequireSignedTokens = true,
            RequireExpirationTime = true,
            ValidateLifetime = true,
            ClockSkew = GoogleIdTokenRules.ClockSkew
        });
        if (!result.IsValid)
        {
            // Google anahtarları döndürdüyse bir sonraki istekte yeni JWKS okunur.
            if (result.Exception is SecurityTokenSignatureKeyNotFoundException) metadata.RequestRefresh();
            return null;
        }

        var token = (JsonWebToken)result.SecurityToken;
        return new GoogleIdTokenClaims(token.Issuer, token.Audiences.ToArray(), token.ValidTo, token.Subject,
            Read(token, "email"), ReadBoolean(token, "email_verified"), Read(token, "name"), Read(token, "nonce"),
            Read(token, "hd"));
    }

    private static string? Read(JsonWebToken token, string claim) =>
        token.TryGetPayloadValue<string>(claim, out var value) ? value : null;

    private static bool ReadBoolean(JsonWebToken token, string claim) =>
        token.TryGetPayloadValue<bool>(claim, out var value)
            ? value
            : token.TryGetPayloadValue<string>(claim, out var text) && text == "true";
}
