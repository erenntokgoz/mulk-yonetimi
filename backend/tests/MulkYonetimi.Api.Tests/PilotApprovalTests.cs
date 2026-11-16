using Microsoft.Extensions.Configuration;
using MulkYonetimi.Api;

namespace MulkYonetimi.Api.Tests;

public sealed class PilotApprovalTests
{
    private static IConfiguration Config(string? requireApproval) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(requireApproval is null
                ? []
                : new Dictionary<string, string?> { ["Pilot:RequireApproval"] = requireApproval })
            .Build();

    [Fact]
    public void NewAccountsWaitForApprovalByDefault() =>
        Assert.Equal("PENDING", PilotAccess.NewAccountStatus(Config(null)));

    [Fact]
    public void NewAccountsStartActiveWhenApprovalIsDisabled() =>
        Assert.Equal("ACTIVE", PilotAccess.NewAccountStatus(Config("false")));

    [Fact]
    public void ExplicitApprovalKeepsAccountsPending() =>
        Assert.Equal("PENDING", PilotAccess.NewAccountStatus(Config("true")));
}
