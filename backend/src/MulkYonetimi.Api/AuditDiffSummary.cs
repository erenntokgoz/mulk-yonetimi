using System.Globalization;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

internal static class AuditDiffSummary
{
    public static string PaymentVoided(Payment payment) =>
        $"amount={Money(payment.Amount)}; paidOn={payment.PaidOn:yyyy-MM-dd}; method={payment.Method}; status=RECORDED->VOIDED";

    public static string ExpenseVoided(Expense expense) =>
        $"amount={Money(expense.Amount)}; expenseOn={expense.ExpenseOn:yyyy-MM-dd}; category={expense.Category}; status=RECORDED->VOIDED";

    public static string RentChargeCorrected(decimal previousAmount, decimal newAmount) =>
        $"amount={Money(previousAmount)}->{Money(newAmount)}";

    private static string Money(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture);
}
