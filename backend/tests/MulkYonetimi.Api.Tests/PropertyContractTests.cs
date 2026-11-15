using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using MulkYonetimi.Api;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api.Tests;

public sealed class PropertyContractTests
{
    [Theory]
    [InlineData("2026-01-01", "2026-01-05", "2026-01-10", "2026-01-20", false)]
    [InlineData("2026-01-01", "2026-01-10", "2026-01-10", "2026-01-20", true)]
    [InlineData("2026-01-21", null, "2026-01-10", "2026-01-20", false)]
    [InlineData("2026-01-21", null, "2026-01-10", null, true)]
    public void Lease_date_ranges_overlap_only_when_the_closed_periods_intersect(
        string firstStart, string? firstEnd, string secondStart, string? secondEnd, bool expected)
    {
        Assert.Equal(expected, LeaseEndpoints.DateRangesOverlap(
            DateOnly.Parse(firstStart), firstEnd is null ? null : DateOnly.Parse(firstEnd),
            DateOnly.Parse(secondStart), secondEnd is null ? null : DateOnly.Parse(secondEnd)));
    }

    [Fact]
    public void Payment_void_diff_summary_keeps_original_financial_values_without_reference_or_personal_data()
    {
        var payment = new MulkYonetimi.Infrastructure.Payment
        {
            Id = Guid.NewGuid(),
            AccountId = Guid.NewGuid(),
            TenantId = Guid.NewGuid(),
            PaidOn = new DateOnly(2026, 10, 5),
            Amount = 1234.50m,
            Method = MulkYonetimi.Infrastructure.PaymentMethod.TRANSFER,
            Reference = "PRIVATE-REFERENCE",
            IdempotencyKey = "payment-key"
        };

        var summary = AuditDiffSummary.PaymentVoided(payment);

        Assert.Contains("amount=1234.50", summary);
        Assert.Contains("paidOn=2026-10-05", summary);
        Assert.Contains("method=TRANSFER", summary);
        Assert.Contains("status=RECORDED->VOIDED", summary);
        Assert.DoesNotContain("PRIVATE-REFERENCE", summary);
        Assert.DoesNotContain(payment.TenantId.ToString(), summary);
    }

    [Fact]
    public void Expense_void_diff_summary_omits_free_text_and_rent_correction_captures_old_and_new_amount()
    {
        var expense = new MulkYonetimi.Infrastructure.Expense
        {
            Id = Guid.NewGuid(),
            AccountId = Guid.NewGuid(),
            PropertyId = Guid.NewGuid(),
            Category = MulkYonetimi.Infrastructure.ExpenseCategory.MAINTENANCE,
            Amount = 85m,
            ExpenseOn = new DateOnly(2026, 9, 1),
            IdempotencyKey = "expense-key",
            Note = "PRIVATE-NOTE"
        };

        var voidSummary = AuditDiffSummary.ExpenseVoided(expense);
        var correctionSummary = AuditDiffSummary.RentChargeCorrected(1200m, 1100.5m);

        Assert.Contains("amount=85.00", voidSummary);
        Assert.Contains("expenseOn=2026-09-01", voidSummary);
        Assert.Contains("category=MAINTENANCE", voidSummary);
        Assert.DoesNotContain("PRIVATE-NOTE", voidSummary);
        Assert.Equal("amount=1200.00->1100.50", correctionSummary);
    }

    [Theory]
    [InlineData("=1+1", "\"'=1+1\"")]
    [InlineData(" \t@SUM(A1)", "\"' \t@SUM(A1)\"")]
    [InlineData("a,\"b", "\"a,\"\"b\"")]
    public void Csv_cells_escape_formulas_and_quotes(string input, string expected) =>
        Assert.Equal(expected, CsvExport.Cell(input));

    [Fact]
    public void Deposit_movements_use_signed_balances_and_reject_invalid_amounts()
    {
        Assert.Equal(-25000m, DepositEndpoints.SignedAmount(DepositMovementType.RETURNED, 25000m));
        Assert.Equal(40000m, DepositEndpoints.SignedAmount(DepositMovementType.HELD, 40000m));
        Assert.Equal(-50m, DepositEndpoints.SignedAmount(DepositMovementType.ADJUSTED, -50m));
        Assert.Null(DepositEndpoints.SignedAmount(DepositMovementType.HELD, -50m));
        Assert.Null(DepositEndpoints.SignedAmount(DepositMovementType.RETURNED, 0));
        Assert.Null(DepositEndpoints.SignedAmount(DepositMovementType.ADJUSTED, 1.001m));
        Assert.Null(DepositEndpoints.SignedAmount(DepositMovementType.ADJUSTED, decimal.MinValue));
    }
    [Fact]
    public void Rent_rules_use_inclusive_dates_and_clamp_short_months()
    {
        Assert.Equal(new DateOnly(2028, 2, 29), RentRules.DueDate(new(2028, 2, 1), 31));
        Assert.False(RentRules.IsMoney(12.001m));
        Assert.True(RentRules.IsMoney(12000.01m));
        Assert.Equal("PARTIAL", RentRules.ChargeStatus(20000m, 12000m));
        Assert.Equal("PAID", RentRules.ChargeStatus(20000m, 20000m));
        Assert.Equal("UNPAID", RentRules.ChargeStatus(20000m, 0m));
    }

    [Fact]
    public void Unit_fields_reject_missing_label_usage_and_out_of_range_optional_values()
    {
        var invalid = UnitEndpoints.ValidateCreation(new(" ", null, new string('a', 33), 12.345m));
        Assert.Equal(new[] { "label", "usageType", "doorNumber", "areaM2" }, invalid.Keys);
        Assert.Empty(UnitEndpoints.ValidateCreation(new("Dükkan", UnitUsageType.COMMERCIAL, null, 45.25m)));
    }

    [Fact]
    public void Tenant_fields_require_the_correct_names_and_validate_optional_contact()
    {
        Assert.Empty(TenantEndpoints.ValidateDetails(new(TenantKind.PERSON, "Ada", "Çelik", null, null, null)));
        Assert.Empty(TenantEndpoints.ValidateDetails(new(TenantKind.COMPANY, null, null, "Örnek Ltd.", null, null)));
        var invalid = TenantEndpoints.ValidateDetails(new(TenantKind.PERSON, " ", null, "Örnek Ltd.", "abc", "invalid"));
        Assert.Equal(new[] { "firstName", "lastName", "companyName", "email" }, invalid.Keys);
        Assert.Contains("companyName", TenantEndpoints.ValidateDetails(new(TenantKind.COMPANY, null, null, null, null, null)));
        Assert.Contains("firstName", TenantEndpoints.ValidateDetails(new(TenantKind.COMPANY, "Ada", null, "Örnek Ltd.", null, null)));
    }

    [Theory]
    [InlineData(null, null, "propertyKind")]
    [InlineData(PropertyKind.SINGLE_UNIT, null, "defaultUnitUsageType")]
    [InlineData(PropertyKind.MULTI_UNIT, UnitUsageType.COMMERCIAL, "defaultUnitUsageType")]
    [InlineData(PropertyKind.SINGLE_UNIT, UnitUsageType.RESIDENTIAL, null)]
    [InlineData(PropertyKind.SINGLE_UNIT, UnitUsageType.COMMERCIAL, null)]
    [InlineData(PropertyKind.MULTI_UNIT, null, null)]
    public void Only_single_unit_properties_require_a_default_unit_usage(
        PropertyKind? kind, UnitUsageType? usage, string? invalidField)
    {
        var errors = PropertyEndpoints.ValidateCreation(new("Ad", "Adres", kind, usage));
        if (invalidField is null)
            Assert.Empty(errors);
        else
            Assert.Equal(invalidField, Assert.Single(errors).Key);
    }

    [Fact]
    public void Property_details_require_text_and_check_trimmed_sql_limits()
    {
        Assert.Equal(new[] { "name", "address" },
            PropertyEndpoints.ValidateDetails(" ", null).Keys);
        Assert.Empty(PropertyEndpoints.ValidateDetails(" " + new string('a', 200), new string('b', 500) + " "));
        Assert.Equal(new[] { "name", "address" },
            PropertyEndpoints.ValidateDetails(new string('a', 201), new string('b', 501)).Keys);
    }

    [Fact]
    public async Task Openapi_describes_portfolio_routes_and_response_codes()
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var document = JsonDocument.Parse(await client.GetStringAsync("/openapi/v1.json"));
        var paths = document.RootElement.GetProperty("paths");
        HasResponse("/api/v1/properties", "get", "200");
        HasResponse("/api/v1/properties", "post", "201");
        HasResponse("/api/v1/properties", "post", "400");
        HasResponse("/api/v1/properties/{id}", "get", "404");
        HasResponse("/api/v1/properties/{id}", "patch", "409");
        HasResponse("/api/v1/properties/{id}/archive", "post", "204");
        HasResponse("/api/v1/properties/{id}/archive", "post", "409");
        HasResponse("/api/v1/properties/{id}/units", "get", "200");
        HasResponse("/api/v1/properties/{id}/units", "post", "201");
        HasResponse("/api/v1/properties/{id}/units", "post", "409");
        HasResponse("/api/v1/properties/{id}/units/{unitId}/archive", "post", "204");
        HasResponse("/api/v1/properties/{id}/units/{unitId}/archive", "post", "409");
        HasResponse("/api/v1/tenants", "get", "200");
        HasResponse("/api/v1/tenants", "post", "201");
        HasResponse("/api/v1/tenants/{id}", "get", "404");
        HasResponse("/api/v1/tenants/{id}", "patch", "409");
        HasResponse("/api/v1/tenants/{id}/archive", "post", "204");
        HasResponse("/api/v1/leases", "post", "201");
        HasResponse("/api/v1/admin/accounts/pending", "get", "200");
        HasResponse("/api/v1/admin/accounts/pending", "get", "403");
        HasResponse("/api/v1/leases/{id}/activate", "post", "409");
        HasResponse("/api/v1/leases/{id}/terminate", "post", "200");
        HasResponse("/api/v1/leases/{id}/rates", "get", "200");
        HasResponse("/api/v1/leases/{id}/rates", "post", "201");
        HasResponse("/api/v1/leases/{id}/renewals", "get", "200");
        HasResponse("/api/v1/leases/{id}/renewals", "post", "201");
        HasResponse("/api/v1/leases/{id}/renewals", "post", "409");
        HasResponse("/api/v1/rent-charges", "get", "200");
        HasResponse("/api/v1/rent-charges/{id}/corrections", "post", "201");
        HasResponse("/api/v1/payments", "post", "201");
        HasResponse("/api/v1/payments/{id}/allocations", "post", "409");
        HasResponse("/api/v1/payments/{id}/void", "post", "200");
        HasResponse("/api/v1/deposits", "get", "200");
        HasResponse("/api/v1/deposits", "post", "201");
        HasResponse("/api/v1/deposits/{id}/movements", "post", "201");
        HasResponse("/api/v1/expenses", "get", "200");
        HasResponse("/api/v1/expenses", "post", "201");
        HasResponse("/api/v1/expenses/{id}/void", "post", "200");
        HasResponse("/api/v1/dashboard/summary", "get", "200");
        HasResponse("/api/v1/reports/cashflow", "get", "200");
        HasResponse("/api/v1/reports/cashflow.csv", "get", "200");
        HasResponse("/api/v1/reports/payments.csv", "get", "200");
        HasResponse("/api/v1/admin/accounts/{id}/activate", "post", "204");
        HasResponse("/api/v1/admin/accounts/{id}/activate", "post", "403");

        var schemas = document.RootElement.GetProperty("components").GetProperty("schemas");
        Assert.Contains(schemas.GetProperty("CreatePropertyRequest").GetProperty("required").EnumerateArray(),
            field => field.GetString() == "propertyKind");

        void HasResponse(string path, string method, string status) =>
            Assert.True(paths.GetProperty(path).GetProperty(method).GetProperty("responses")
                .TryGetProperty(status, out _), $"{method} {path} should declare {status}");
    }

    [Theory]
    [InlineData("/api/v1/properties")]
    [InlineData("/api/v1/properties/11111111-1111-1111-1111-111111111111/units")]
    [InlineData("/api/v1/tenants")]
    public async Task Portfolio_list_requires_authentication(string path)
    {
        using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static WebApplicationFactory<Program> CreateFactory() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseEnvironment("Development");
            host.UseSetting("Email:WorkerEnabled", "false");
        });
}
