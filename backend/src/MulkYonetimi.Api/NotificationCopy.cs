using System.Globalization;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

public sealed record NotificationText(string Title, string Message);

// Builds the title and message shared by the in-app notification and its e-mail.
// Dynamic values sit next to postpositions ("ile", "için") so no Turkish suffix has to follow a user-entered name.
public static class NotificationCopy
{
    private static readonly NumberFormatInfo TurkishNumber = new()
    {
        NumberDecimalSeparator = ",",
        NumberGroupSeparator = ".",
        NumberGroupSizes = [3]
    };

    public static NotificationText RentDue(string place, string? tenant, DateOnly dueDate, decimal unpaid) => new(
        "Kira ödeme günü yaklaşıyor",
        $"{place} kirasının son ödeme günü {Date(dueDate)}. {Balance(tenant, unpaid)}");

    public static NotificationText OverdueRent(string place, string? tenant, DateOnly dueDate, decimal unpaid) => new(
        "Kira ödemesi gecikti",
        $"{place} kirasının {Date(dueDate)} olan son ödeme günü geçti. {Balance(tenant, unpaid)}");

    public static NotificationText LeaseEnd(string place, string? tenant, DateOnly plannedEndDate) => new(
        "Sözleşme bitiş tarihi yaklaşıyor",
        $"{(tenant is null ? string.Empty : $"{tenant} ile yapılan ")}{place} sözleşmesinin planlanan bitiş tarihi {Date(plannedEndDate)}.");

    public static NotificationText RentAnniversary(string place, string? tenant, DateOnly startDate) => new(
        "Kira yıl dönümü bugün",
        $"{With(tenant)}{Date(startDate)} tarihinde başlayan {place} sözleşmesinin yıl dönümü bugün.");

    public static string Place(string propertyName, string unitLabel, bool isDefaultUnit) =>
        isDefaultUnit ? propertyName : $"{propertyName} ({unitLabel})";

    public static string? TenantName(TenantKind kind, string? firstName, string? lastName, string? companyName)
    {
        var name = kind == TenantKind.COMPANY
            ? companyName?.Trim()
            : string.Join(' ', new[] { firstName, lastName }.Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim()));
        return string.IsNullOrWhiteSpace(name) ? null : name;
    }

    public static string Money(decimal amount) => amount.ToString("#,##0.00", TurkishNumber) + " TL";

    private static string Date(DateOnly date) => date.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture);

    private static string Balance(string? tenant, decimal unpaid) => tenant is null
        ? $"Ödenmemiş tutar {Money(unpaid)}."
        : $"Kiracı {tenant}, ödenmemiş tutar {Money(unpaid)}.";

    private static string With(string? tenant) => tenant is null ? string.Empty : $"{tenant} ile ";
}
