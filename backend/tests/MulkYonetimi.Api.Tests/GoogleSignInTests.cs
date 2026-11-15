using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace MulkYonetimi.Api.Tests;

public sealed class GoogleSignInTests
{
    private const string ClientId = "client-123.apps.googleusercontent.com";
    private const string Nonce = "nonce-value-0123456789";
    private static readonly DateTime Now = new(2026, 11, 16, 12, 0, 0, DateTimeKind.Utc);

    private static GoogleIdTokenClaims Claims(string issuer = "https://accounts.google.com", string audience = ClientId,
        bool emailVerified = true, string? nonce = Nonce, string email = "owner@gmail.com", string? hostedDomain = null,
        DateTime? expires = null) =>
        new(issuer, [audience], expires ?? Now.AddMinutes(30), "google-sub-1", email, emailVerified, "Ayşe Yılmaz",
            nonce, hostedDomain);

    [Fact]
    public void Rules_accept_a_verified_token_for_this_client_and_nonce()
    {
        var identity = GoogleIdTokenRules.Accept(Claims(), ClientId, Nonce, Now);

        Assert.NotNull(identity);
        Assert.Equal("google-sub-1", identity.Subject);
        Assert.Equal("owner@gmail.com", identity.Email);
        Assert.Equal("Ayşe Yılmaz", identity.Name);
        Assert.True(identity.EmailIsAuthoritative);
        Assert.NotNull(GoogleIdTokenRules.Accept(Claims(issuer: "accounts.google.com"), ClientId, Nonce, Now));
    }

    [Fact]
    public void Rules_reject_a_token_issued_for_another_client()
    {
        Assert.Null(GoogleIdTokenRules.Accept(Claims(audience: "other-client.apps.googleusercontent.com"), ClientId, Nonce, Now));
        var multiple = Claims() with { Audiences = [ClientId, "other-client.apps.googleusercontent.com"] };
        Assert.Null(GoogleIdTokenRules.Accept(multiple, ClientId, Nonce, Now));
    }

    [Fact]
    public void Rules_reject_an_unverified_email() =>
        Assert.Null(GoogleIdTokenRules.Accept(Claims(emailVerified: false), ClientId, Nonce, Now));

    [Theory]
    [InlineData("nonce-value-0123456780")]
    [InlineData("nonce-value-012345678")]
    [InlineData(null)]
    public void Rules_reject_a_nonce_mismatch(string? tokenNonce) =>
        Assert.Null(GoogleIdTokenRules.Accept(Claims(nonce: tokenNonce), ClientId, Nonce, Now));

    [Fact]
    public void Rules_reject_foreign_issuers_and_expired_tokens()
    {
        Assert.Null(GoogleIdTokenRules.Accept(Claims(issuer: "https://evil.example"), ClientId, Nonce, Now));
        Assert.Null(GoogleIdTokenRules.Accept(Claims(expires: Now.AddMinutes(-3)), ClientId, Nonce, Now));
    }

    [Theory]
    [InlineData("owner@gmail.com", null, true)]
    [InlineData("owner@googlemail.com", null, true)]
    [InlineData("owner@company.example", "company.example", true)]
    [InlineData("owner@company.example", null, false)]
    [InlineData("owner@gmail.com.evil.example", null, false)]
    public void Only_gmail_and_workspace_addresses_are_authoritative(string email, string? hostedDomain, bool expected) =>
        Assert.Equal(expected, GoogleIdTokenRules.IsAuthoritative(email, hostedDomain));

    [Fact]
    public async Task Jwks_validator_accepts_only_tokens_signed_by_google_keys_for_this_audience()
    {
        using var googleKey = RSA.Create(2048);
        using var otherKey = RSA.Create(2048);
        var signingKey = new RsaSecurityKey(googleKey) { KeyId = "google-1" };
        var configuration = new OpenIdConnectConfiguration();
        configuration.SigningKeys.Add(signingKey);
        var validator = new GoogleJwksIdTokenValidator(
            new StaticConfigurationManager<OpenIdConnectConfiguration>(configuration));

        var valid = await validator.ValidateAsync(CreateToken(signingKey), ClientId, CancellationToken.None);
        Assert.NotNull(valid);
        Assert.Equal("https://accounts.google.com", valid.Issuer);
        Assert.Equal([ClientId], valid.Audiences);
        Assert.Equal("google-sub-1", valid.Subject);
        Assert.Equal("owner@gmail.com", valid.Email);
        Assert.True(valid.EmailVerified);
        Assert.Equal(Nonce, valid.Nonce);
        Assert.Equal("Ayşe Yılmaz", valid.Name);

        Assert.Null(await validator.ValidateAsync(CreateToken(signingKey, audience: "other-client"), ClientId, CancellationToken.None));
        Assert.Null(await validator.ValidateAsync(CreateToken(signingKey, issuer: "https://evil.example"), ClientId, CancellationToken.None));
        Assert.Null(await validator.ValidateAsync(CreateToken(signingKey, expired: true), ClientId, CancellationToken.None));
        Assert.Null(await validator.ValidateAsync(
            CreateToken(new RsaSecurityKey(otherKey) { KeyId = "google-1" }), ClientId, CancellationToken.None));
        var unsigned = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = "https://accounts.google.com",
            Audience = ClientId,
            Expires = DateTime.UtcNow.AddMinutes(30),
            Claims = new Dictionary<string, object> { ["sub"] = "google-sub-1", ["email_verified"] = true, ["nonce"] = Nonce }
        });
        Assert.Null(await validator.ValidateAsync(unsigned, ClientId, CancellationToken.None));
    }

    [Fact]
    public async Task Jwks_validator_reports_unavailable_google_keys()
    {
        var validator = new GoogleJwksIdTokenValidator(new FailingConfigurationManager());
        await Assert.ThrowsAsync<GoogleKeysUnavailableException>(() =>
            validator.ValidateAsync("token", ClientId, CancellationToken.None));
    }

    [Fact]
    public async Task Endpoint_rejects_bad_audience_unverified_email_and_nonce_mismatch_before_touching_accounts()
    {
        var validator = new FakeValidator();
        using var factory = CreateFactory(validator, ClientId);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Origin", "https://app.example.test");
        var current = DateTime.UtcNow.AddMinutes(30);

        validator.Claims = Claims(audience: "other-client.apps.googleusercontent.com", expires: current);
        using (var response = await client.PostAsJsonAsync("/api/v1/auth/google", new { idToken = "t", nonce = Nonce }))
            AssertRejected(response);
        validator.Claims = Claims(emailVerified: false, expires: current);
        using (var response = await client.PostAsJsonAsync("/api/v1/auth/google", new { idToken = "t", nonce = Nonce }))
            AssertRejected(response);
        validator.Claims = Claims(expires: current);
        using (var response = await client.PostAsJsonAsync("/api/v1/auth/google", new { idToken = "t", nonce = "another-nonce" }))
            AssertRejected(response);
        validator.Claims = null;
        using (var response = await client.PostAsJsonAsync("/api/v1/auth/google", new { idToken = "t", nonce = Nonce }))
            AssertRejected(response);
        Assert.Equal(ClientId, validator.LastClientId);
    }

    [Fact]
    public async Task Endpoint_requires_the_frontend_origin_a_client_id_and_a_token()
    {
        var validator = new FakeValidator { Claims = Claims(expires: DateTime.UtcNow.AddMinutes(30)) };
        using (var factory = CreateFactory(validator, ClientId))
        using (var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }))
        {
            using var foreign = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/google")
            {
                Content = JsonContent.Create(new { idToken = "t", nonce = Nonce })
            };
            foreign.Headers.Add("Origin", "https://attacker.example");
            using var foreignResponse = await client.SendAsync(foreign);
            Assert.Equal(HttpStatusCode.Forbidden, foreignResponse.StatusCode);

            client.DefaultRequestHeaders.Add("Origin", "https://app.example.test");
            using var empty = await client.PostAsJsonAsync("/api/v1/auth/google", new { idToken = "", nonce = Nonce });
            Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
            using var oversized = await client.PostAsJsonAsync("/api/v1/auth/google",
                new { idToken = new string('a', 8193), nonce = Nonce });
            Assert.Equal(HttpStatusCode.BadRequest, oversized.StatusCode);
            Assert.Equal(0, validator.Calls);
        }

        using var unconfigured = CreateFactory(validator, clientId: null);
        using var unconfiguredClient = unconfigured.CreateClient();
        unconfiguredClient.DefaultRequestHeaders.Add("Origin", "https://app.example.test");
        using var unavailable = await unconfiguredClient.PostAsJsonAsync("/api/v1/auth/google", new { idToken = "t", nonce = Nonce });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, unavailable.StatusCode);
        Assert.Equal(0, validator.Calls);
    }

    private static void AssertRejected(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    private static WebApplicationFactory<Program> CreateFactory(IGoogleIdTokenValidator validator, string? clientId) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("Auth:FrontendOrigin", "https://app.example.test");
            builder.UseSetting("Auth:Google:ClientId", clientId ?? "");
            builder.UseSetting("Email:WorkerEnabled", "false");
            builder.UseSetting("Notifications:WorkerEnabled", "false");
            builder.UseSetting("RentCharges:WorkerEnabled", "false");
            builder.ConfigureTestServices(services => services.AddSingleton(validator));
        });

    private static string CreateToken(SecurityKey key, string audience = ClientId,
        string issuer = "https://accounts.google.com", bool expired = false)
    {
        var now = DateTime.UtcNow;
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            IssuedAt = expired ? now.AddHours(-2) : now,
            NotBefore = expired ? now.AddHours(-2) : now,
            Expires = expired ? now.AddHours(-1) : now.AddMinutes(30),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.RsaSha256),
            Claims = new Dictionary<string, object>
            {
                ["sub"] = "google-sub-1",
                ["email"] = "owner@gmail.com",
                ["email_verified"] = true,
                ["name"] = "Ayşe Yılmaz",
                ["nonce"] = Nonce
            }
        });
    }

    private sealed class FakeValidator : IGoogleIdTokenValidator
    {
        public GoogleIdTokenClaims? Claims { get; set; }
        public string? LastClientId { get; private set; }
        public int Calls { get; private set; }

        public Task<GoogleIdTokenClaims?> ValidateAsync(string idToken, string clientId, CancellationToken cancellationToken)
        {
            Calls++;
            LastClientId = clientId;
            return Task.FromResult(Claims);
        }
    }

    private sealed class FailingConfigurationManager : IConfigurationManager<OpenIdConnectConfiguration>
    {
        public Task<OpenIdConnectConfiguration> GetConfigurationAsync(CancellationToken cancel) =>
            throw new InvalidOperationException("network");

        public void RequestRefresh() { }
    }
}
