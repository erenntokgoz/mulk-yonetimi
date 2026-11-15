using System.Text;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api.Tests;

// docs/email-previews holds the rendered output of every template with sample data.
// Run the tests with MULK_WRITE_EMAIL_PREVIEWS=1 to refresh the files after a template change.
public sealed class EmailPreviewTests
{
    private const string SampleUserId = "3f0c8a52-6d1e-4b7a-9c1e-2a5b8d4e7f10";
    private const string SampleToken =
        "CfDJ8OrnekOnizlemeBelirteci%2BYalnizcaTasarimIcin%2FGecersizDeger7QmVsaXJ0ZWMgw7ZybmXEn2lkaXIgdmUgaGnDp2JpciBoZXNhcCBpw6dpbiBnZcOnZXJsaSBkZcSfaWxkaXI%3D";

    public static TheoryData<string> PreviewNames => [.. Samples().Select(sample => sample.Name)];

    [Theory]
    [MemberData(nameof(PreviewNames))]
    public void Committed_preview_matches_the_rendered_template(string name)
    {
        var email = Samples().Single(sample => sample.Name == name).Email;
        var directory = PreviewDirectory();
        foreach (var (extension, content) in new[] { ("html", email.Html), ("txt", email.Text) })
        {
            var path = Path.Combine(directory, $"{name}.{extension}");
            if (Environment.GetEnvironmentVariable("MULK_WRITE_EMAIL_PREVIEWS") == "1")
            {
                Directory.CreateDirectory(directory);
                File.WriteAllText(path, content, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            }

            Assert.True(File.Exists(path), $"{path} is missing. Run the tests with MULK_WRITE_EMAIL_PREVIEWS=1.");
            Assert.Equal(content.ReplaceLineEndings("\n"), File.ReadAllText(path).ReplaceLineEndings("\n"));
        }
    }

    private static IEnumerable<(string Name, RenderedEmail Email)> Samples()
    {
        var place = NotificationCopy.Place("Güneş Apartmanı", "Daire 3", isDefaultUnit: false);
        var tenant = NotificationCopy.TenantName(TenantKind.PERSON, "Ayşe", "Yılmaz", null);
        yield return ("confirm-email", EmailTemplates.ConfirmEmail(
            $"https://mulkum.example.test/dogrula?userId={SampleUserId}&token={SampleToken}"));
        yield return ("reset-password", EmailTemplates.ResetPassword(
            $"https://mulkum.example.test/parola-sifirla?userId={SampleUserId}&token={SampleToken}"));
        yield return Notification("notification-rent-due",
            NotificationCopy.RentDue(place, tenant, new DateOnly(2026, 11, 20), 15000m));
        yield return Notification("notification-overdue-rent",
            NotificationCopy.OverdueRent(place, tenant, new DateOnly(2026, 11, 5), 15000m));
        yield return Notification("notification-lease-end",
            NotificationCopy.LeaseEnd(place, tenant, new DateOnly(2026, 12, 15)));
        yield return Notification("notification-rent-anniversary",
            NotificationCopy.RentAnniversary(place, tenant, new DateOnly(2024, 11, 16)));
    }

    private static (string Name, RenderedEmail Email) Notification(string name, NotificationText text) =>
        (name, EmailTemplates.Notification(text.Title, text.Message));

    private static string PreviewDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "MulkYonetimi.slnx")))
            directory = directory.Parent;
        var backend = directory ?? throw new InvalidOperationException("MulkYonetimi.slnx was not found.");
        return Path.Combine(backend.Parent!.FullName, "docs", "email-previews");
    }
}
