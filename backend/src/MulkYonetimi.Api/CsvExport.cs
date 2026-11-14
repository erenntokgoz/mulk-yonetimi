using System.Text;

namespace MulkYonetimi.Api;

internal static class CsvExport
{
    public static string Cell(string? value)
    {
        var text = value ?? "";
        var visible = text.TrimStart();
        if (visible.Length > 0 && visible[0] is '=' or '+' or '-' or '@') text = "'" + text;
        return "\"" + text.Replace("\"", "\"\"") + "\"";
    }

    public static IResult Download(string csv, string fileName) =>
        Results.File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(),
            "text/csv; charset=utf-8", fileName);
}
