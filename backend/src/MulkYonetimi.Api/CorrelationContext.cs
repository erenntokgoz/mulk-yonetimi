using System.Threading;

namespace MulkYonetimi.Api;

internal static class CorrelationContext
{
    private static readonly AsyncLocal<string?> CurrentValue = new();
    public static string? Current
    {
        get => CurrentValue.Value;
        set => CurrentValue.Value = value;
    }

    public static bool IsValid(string? value) => value is { Length: > 0 and <= 64 } &&
        value.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_');
}
