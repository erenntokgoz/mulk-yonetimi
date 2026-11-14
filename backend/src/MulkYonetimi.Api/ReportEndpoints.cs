using System.Security.Claims;
using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class ReportEndpoints
{
    public static void MapReportEndpoints(this WebApplication app)
    {
        app.MapPortfolioGroup("/api/v1/dashboard").MapGet("/summary", SummaryAsync).WithName("GetDashboardSummary")
            .Produces<DashboardSummary>().ProducesValidationProblem().ProducesProblem(404);
        app.MapPortfolioGroup("/api/v1/reports").MapGet("/cashflow", CashFlowAsync).WithName("GetCashFlow")
            .Produces<CashFlowResponse>().ProducesValidationProblem().ProducesProblem(404);
        var exports = app.MapPortfolioGroup("/api/v1/reports");
        exports.MapGet("/cashflow.csv", CashFlowCsvAsync).WithName("ExportCashFlow")
            .Produces(200, contentType: "text/csv").ProducesValidationProblem().ProducesProblem(404);
        exports.MapGet("/payments.csv", PaymentsCsvAsync).WithName("ExportPayments")
            .Produces(200, contentType: "text/csv").ProducesValidationProblem().ProducesProblem(404);
    }

    private static async Task<IResult> SummaryAsync(DateOnly? periodStart, Guid? propertyId,
        ClaimsPrincipal principal, AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var today = RentRules.Today;
        var month = periodStart ?? RentRules.Month(today);
        if (month.Day != 1) return Invalid("periodStart", "Ayın ilk gününü girin.");
        var monthEnd = RentRules.DueDate(month, 31);
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        if (!await ScopeExistsAsync(db, accountId, propertyId, null, ct)) return Results.NotFound();

        var properties = db.Properties.Where(item => item.AccountId == accountId && item.ArchivedAtUtc == null &&
            (propertyId == null || item.Id == propertyId));
        var activeUnits = db.Units.Where(unit => unit.AccountId == accountId && unit.ArchivedAtUtc == null &&
            properties.Any(property => property.Id == unit.PropertyId));
        var units = await activeUnits.CountAsync(ct);
        var occupied = await activeUnits.CountAsync(unit => db.Leases.Any(lease => lease.AccountId == accountId &&
            lease.UnitId == unit.Id && lease.Status == LeaseStatus.ACTIVE && lease.StartDate <= today), ct);
        var activeProperties = await properties.CountAsync(ct);
        var paidByCharge = RentChargeEndpoints.ValidAllocations(db, accountId).GroupBy(item => item.RentChargeId)
            .Select(group => new { Id = group.Key, Paid = (decimal?)group.Sum(item => item.Amount) });
        var charges = from charge in ChargeScope(db, accountId, propertyId, null)
                      join allocation in paidByCharge on charge.Id equals allocation.Id into paid
                      from allocation in paid.DefaultIfEmpty()
                      select new { charge.PeriodStart, charge.DueDate, charge.Amount, Paid = allocation.Paid ?? 0 };
        var period = charges.Where(item => item.PeriodStart == month);
        var total = await period.SumAsync(item => (decimal?)item.Amount, ct) ?? 0;
        var unpaid = await period.SumAsync(item => (decimal?)(item.Amount - item.Paid), ct) ?? 0;
        var overdue = await charges.Where(item => item.DueDate < today && item.Paid < item.Amount)
            .SumAsync(item => (decimal?)(item.Amount - item.Paid), ct) ?? 0;
        var expense = await db.Expenses.Where(item => item.AccountId == accountId && item.VoidedAtUtc == null &&
                item.ExpenseOn >= month && item.ExpenseOn <= monthEnd && (propertyId == null || item.PropertyId == propertyId))
            .SumAsync(item => (decimal?)item.Amount, ct) ?? 0;
        var cash = await CalculateCashAsync(db, accountId, month, monthEnd, propertyId, null, ct);
        await transaction.CommitAsync(ct);
        return Results.Ok(new DashboardSummary(month, today, activeProperties, units, occupied, units - occupied,
            total, unpaid, overdue, expense, cash));
    }

    private static async Task<IResult> CashFlowAsync(DateOnly fromDate, DateOnly toDate, Guid? propertyId, Guid? unitId,
        ClaimsPrincipal principal, AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (fromDate > toDate) return Invalid("toDate", "Bitiş başlangıçtan önce olamaz.");
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        if (!await ScopeExistsAsync(db, accountId, propertyId, unitId, ct)) return Results.NotFound();
        var result = await CalculateCashAsync(db, accountId, fromDate, toDate, propertyId, unitId, ct);
        await transaction.CommitAsync(ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> CashFlowCsvAsync(DateOnly fromDate, DateOnly toDate, Guid? propertyId, Guid? unitId,
        ClaimsPrincipal principal, AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (fromDate > toDate) return Invalid("toDate", "Bitiş başlangıçtan önce olamaz.");
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        if (!await ScopeExistsAsync(db, accountId, propertyId, unitId, ct)) return Results.NotFound();
        var flow = await CalculateCashAsync(db, accountId, fromDate, toDate, propertyId, unitId, ct);
        await transaction.CommitAsync(ct);
        var csv = new StringBuilder("fromDate,toDate,propertyId,unitId,cashIn,allocated,unallocated,cashOut,netOperatingCashFlow\r\n");
        csv.AppendJoin(',', new[] { flow.FromDate.ToString("yyyy-MM-dd"), flow.ToDate.ToString("yyyy-MM-dd"),
            flow.PropertyId?.ToString() ?? "", flow.UnitId?.ToString() ?? "" }.Select(CsvExport.Cell));
        csv.Append(',').AppendJoin(',', new[] { Money(flow.CashIn), Money(flow.Allocated),
            flow.Unallocated is { } unallocated ? Money(unallocated) : "", Money(flow.CashOut),
            Money(flow.NetOperatingCashFlow) });
        csv.Append("\r\n");
        return CsvExport.Download(csv.ToString(), "cashflow.csv");
    }

    private static async Task<IResult> PaymentsCsvAsync(DateOnly fromDate, DateOnly toDate, Guid? propertyId,
        Guid? unitId, Guid? tenantId, ClaimsPrincipal principal, AccountMembershipResolver memberships,
        ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (fromDate > toDate) return Invalid("toDate", "Bitiş başlangıçtan önce olamaz.");
        if (!await ScopeExistsAsync(db, accountId, propertyId, unitId, ct)) return Results.NotFound();
        var payments = db.Payments.AsNoTracking().Where(item => item.AccountId == accountId &&
            item.PaidOn >= fromDate && item.PaidOn <= toDate && (tenantId == null || item.TenantId == tenantId));
        if (propertyId.HasValue || unitId.HasValue)
        {
            var charges = ChargeScope(db, accountId, propertyId, unitId);
            payments = payments.Where(item => db.PaymentAllocations.Any(allocation =>
                allocation.AccountId == accountId && allocation.PaymentId == item.Id &&
                charges.Any(charge => charge.Id == allocation.RentChargeId)));
        }
        var rows = await payments.OrderByDescending(item => item.PaidOn).ThenBy(item => item.Id).ToArrayAsync(ct);
        var csv = new StringBuilder("id,tenantId,paidOn,amount,method,reference,status\r\n");
        foreach (var item in rows)
        {
            csv.AppendJoin(',', new[] { item.Id.ToString(), item.TenantId.ToString(),
                item.PaidOn.ToString("yyyy-MM-dd") }.Select(CsvExport.Cell));
            csv.Append(',').Append(Money(item.Amount)).Append(',');
            csv.AppendJoin(',', new[] { item.Method.ToString(), item.Reference ?? "",
                item.VoidedAtUtc is null ? "RECORDED" : "VOIDED" }.Select(CsvExport.Cell));
            csv.Append("\r\n");
        }
        return CsvExport.Download(csv.ToString(), "payments.csv");
    }

    private static string Money(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture);

    private static async Task<CashFlowResponse> CalculateCashAsync(ApplicationDbContext db, Guid accountId,
        DateOnly fromDate, DateOnly toDate, Guid? propertyId, Guid? unitId, CancellationToken ct)
    {
        var scoped = propertyId.HasValue || unitId.HasValue;
        var payments = db.Payments.Where(item => item.AccountId == accountId && item.VoidedAtUtc == null &&
            item.PaidOn >= fromDate && item.PaidOn <= toDate);
        var allocations = db.PaymentAllocations.Where(item => item.AccountId == accountId &&
            payments.Any(payment => payment.Id == item.PaymentId));
        if (scoped)
        {
            var charges = ChargeScope(db, accountId, propertyId, unitId);
            allocations = allocations.Where(item => charges.Any(charge => charge.Id == item.RentChargeId));
        }
        var distributed = await allocations.SumAsync(item => (decimal?)item.Amount, ct) ?? 0;
        var inflow = scoped ? distributed : await payments.SumAsync(item => (decimal?)item.Amount, ct) ?? 0;
        var outflow = await db.Expenses.Where(item => item.AccountId == accountId && item.VoidedAtUtc == null &&
                item.PaidOn >= fromDate && item.PaidOn <= toDate &&
                (propertyId == null || item.PropertyId == propertyId) && (unitId == null || item.UnitId == unitId))
            .SumAsync(item => (decimal?)item.Amount, ct) ?? 0;
        return new CashFlowResponse(fromDate, toDate, propertyId, unitId, inflow, distributed,
            scoped ? null : inflow - distributed, outflow, inflow - outflow);
    }

    private static IQueryable<RentCharge> ChargeScope(ApplicationDbContext db, Guid accountId, Guid? propertyId, Guid? unitId)
    {
        var charges = db.RentCharges.Where(item => item.AccountId == accountId);
        if (!propertyId.HasValue && !unitId.HasValue) return charges;
        return from charge in charges
               join lease in db.Leases on new { charge.AccountId, Id = charge.LeaseId }
                   equals new { lease.AccountId, lease.Id }
               join unit in db.Units on new { lease.AccountId, Id = lease.UnitId }
                   equals new { unit.AccountId, unit.Id }
               where (propertyId == null || unit.PropertyId == propertyId) && (unitId == null || unit.Id == unitId)
               select charge;
    }

    private static async Task<bool> ScopeExistsAsync(ApplicationDbContext db, Guid accountId, Guid? propertyId,
        Guid? unitId, CancellationToken ct)
    {
        if (unitId.HasValue)
            return await db.Units.AnyAsync(item => item.AccountId == accountId && item.Id == unitId &&
                (propertyId == null || item.PropertyId == propertyId), ct);
        return !propertyId.HasValue || await db.Properties.AnyAsync(item =>
            item.AccountId == accountId && item.Id == propertyId, ct);
    }
}

public sealed record DashboardSummary(DateOnly PeriodStart, DateOnly AsOf, int ActiveProperties, int TotalUnits,
    int OccupiedUnits, int VacantUnits, decimal PeriodCharges, decimal PeriodUnpaid, decimal OverdueBalance,
    decimal RecordedExpenses, CashFlowResponse CashFlow);
public sealed record CashFlowResponse(DateOnly FromDate, DateOnly ToDate, Guid? PropertyId, Guid? UnitId,
    decimal CashIn, decimal Allocated, decimal? Unallocated, decimal CashOut, decimal NetOperatingCashFlow);
