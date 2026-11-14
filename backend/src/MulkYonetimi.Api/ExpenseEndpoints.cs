using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

internal static class ExpenseEndpoints
{
    public static void MapExpenseEndpoints(this WebApplication app)
    {
        var group = app.MapPortfolioGroup("/api/v1/expenses");
        group.MapGet("", ListAsync).WithName("ListExpenses").Produces<ExpensePage>().ProducesValidationProblem();
        group.MapPost("", CreateAsync).WithName("CreateExpense").Produces<ExpenseResponse>(201)
            .Produces<ExpenseResponse>().ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        group.MapPost("/{id:guid}/void", VoidAsync).WithName("VoidExpense").Produces<ExpenseResponse>()
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
    }

    private static async Task<IResult> ListAsync(Guid? propertyId, Guid? unitId, ExpenseCategory? category,
        DateOnly? fromDate, DateOnly? toDate, bool? includeVoided, int? page, int? pageSize,
        ClaimsPrincipal principal, AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var current = page ?? 1;
        var size = pageSize ?? 25;
        if (ValidatePage(current, size) is { } invalid) return invalid;
        if (fromDate > toDate) return Invalid("toDate", "Bitiş başlangıçtan önce olamaz.");
        var rows = await db.Expenses.AsNoTracking().Where(item => item.AccountId == accountId &&
                (propertyId == null || item.PropertyId == propertyId) && (unitId == null || item.UnitId == unitId) &&
                (category == null || item.Category == category) && (fromDate == null || item.ExpenseOn >= fromDate) &&
                (toDate == null || item.ExpenseOn <= toDate) && (includeVoided == true || item.VoidedAtUtc == null))
            .OrderByDescending(item => item.ExpenseOn).ThenBy(item => item.Id)
            .Skip((current - 1) * size).Take(size + 1).ToArrayAsync(ct);
        return Results.Ok(new ExpensePage(rows.Take(size).Select(ToResponse).ToArray(), current, size, rows.Length > size));
    }

    private static async Task<IResult> CreateAsync(CreateExpenseRequest input,
        [FromHeader(Name = "Idempotency-Key")] string? key, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (!PaymentEndpoints.ValidKey(key)) return Invalid("idempotencyKey", "Geçerli bir işlem anahtarı girin.");
        if (input.Category is not { } category) return Invalid("category", "Gider kategorisini seçin.");
        if (input.Amount <= 0 || !RentRules.IsMoney(input.Amount))
            return Invalid("amount", "Geçerli bir pozitif gider tutarı girin.");
        var today = RentRules.Today;
        if (input.ExpenseOn.Year < 1900 || input.ExpenseOn > today)
            return Invalid("expenseOn", "Geçerli bir geçmiş veya bugün tarihi girin.");
        if (input.PaidOn is { } paidOn && (paidOn.Year < 1900 || paidOn > today))
            return Invalid("paidOn", "Geçerli bir geçmiş veya bugün tarihi girin.");
        var note = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
        if (note?.Length > 500) return Invalid("note", "Not en çok 500 karakter olmalıdır.");
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var existing = await db.Expenses.SingleOrDefaultAsync(item => item.AccountId == accountId && item.IdempotencyKey == key, ct);
        if (existing is not null)
            return existing.PropertyId == input.PropertyId && existing.UnitId == input.UnitId && existing.Category == category &&
                existing.Amount == input.Amount && existing.ExpenseOn == input.ExpenseOn && existing.PaidOn == input.PaidOn &&
                existing.Note == note
                ? Results.Ok(ToResponse(existing)) : Conflict("İşlem anahtarı başka bir gider için kullanılmış.");
        if (!await db.Properties.AnyAsync(item => item.AccountId == accountId && item.Id == input.PropertyId, ct) ||
            (input.UnitId is { } unitId && !await db.Units.AnyAsync(item => item.AccountId == accountId &&
                item.PropertyId == input.PropertyId && item.Id == unitId, ct)))
            return Results.NotFound();
        var expense = new Expense
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            PropertyId = input.PropertyId,
            UnitId = input.UnitId,
            Category = category,
            Amount = input.Amount,
            ExpenseOn = input.ExpenseOn,
            PaidOn = input.PaidOn,
            Note = note,
            IdempotencyKey = key!
        };
        db.Expenses.Add(expense);
        AddAudit(db, principal, accountId, expense.Id, "EXPENSE", "CREATED");
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Created("/api/v1/expenses?propertyId=" + expense.PropertyId, ToResponse(expense));
    }

    private static async Task<IResult> VoidAsync(Guid id, VoidExpenseRequest input, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var expense = await db.Expenses.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        if (expense is null) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Trim().Length > 500)
            return Invalid("reason", "İptal gerekçesi 1 ile 500 karakter arasında olmalıdır.");
        var reason = input.Reason.Trim();
        if (expense.VoidedAtUtc is not null)
            return expense.VoidReason == reason ? Results.Ok(ToResponse(expense)) : Conflict("Bu gider daha önce iptal edildi.");
        expense.VoidedAtUtc = DateTime.UtcNow;
        expense.VoidReason = reason;
        AddAudit(db, principal, accountId, id, "EXPENSE", "VOIDED", reason);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Ok(ToResponse(expense));
    }

    private static IResult Conflict(string title) => Results.Problem(statusCode: 409, title: title);

    private static ExpenseResponse ToResponse(Expense expense) =>
        new(expense.Id, expense.PropertyId, expense.UnitId, expense.Category, expense.Amount, expense.ExpenseOn,
            expense.PaidOn, expense.Note, expense.VoidedAtUtc == null ? "RECORDED" : "VOIDED",
            AsUtc(expense.VoidedAtUtc), expense.VoidReason);
}

public sealed record CreateExpenseRequest([property: Required] Guid PropertyId, Guid? UnitId,
    [property: Required] ExpenseCategory? Category, [property: Required] decimal Amount,
    [property: Required] DateOnly ExpenseOn, DateOnly? PaidOn, string? Note);
public sealed record VoidExpenseRequest([property: Required] string Reason);
public sealed record ExpenseResponse(Guid Id, Guid PropertyId, Guid? UnitId, ExpenseCategory Category, decimal Amount,
    DateOnly ExpenseOn, DateOnly? PaidOn, string? Note, string Status, DateTime? VoidedAtUtc, string? VoidReason);
public sealed record ExpensePage(ExpenseResponse[] Items, int Page, int PageSize, bool HasMore);
