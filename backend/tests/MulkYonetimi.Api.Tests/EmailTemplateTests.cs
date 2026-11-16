using System.Text;
using MimeKit;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api.Tests;

public sealed class EmailTemplateTests
{
    private const string ConfirmUrl = "https://app.example.test/dogrula?userId=7d0c1f52-0000-4000-8000-000000000001&token=CfDJ8%2Babc%2Fdef%3D";
    private const string ResetUrl = "https://app.example.test/parola-sifirla?userId=7d0c1f52-0000-4000-8000-000000000001&token=CfDJ8%2Bxyz";

    public static TheoryData<string, string, string?> LinkTemplates => new()
    {
        { "confirm", "E-posta adresinizi doğrulayın", ConfirmUrl },
        { "reset", "Parolanızı sıfırlayın", ResetUrl }
    };

    public static TheoryData<string> AllTemplates => ["confirm", "reset", "notification"];

    [Theory]
    [MemberData(nameof(LinkTemplates))]
    public void Link_templates_have_a_short_specific_subject(string template, string subject, string? url)
    {
        var email = Render(template, url);

        Assert.Equal(subject, email.Subject);
        Assert.DoesNotContain("Mülküm:", email.Subject);
        Assert.Contains($"<title>{subject}</title>", email.Html);
    }

    [Fact]
    public void Notification_template_uses_the_notification_title_as_subject_and_heading()
    {
        var email = EmailTemplates.Notification("Kira ödemesi gecikti", "Ödenmemiş tutar 75,00 TL.");

        Assert.Equal("Kira ödemesi gecikti", email.Subject);
        Assert.Contains(">Kira ödemesi gecikti</h1>", email.Html);
        Assert.StartsWith("Kira ödemesi gecikti\n\nÖdenmemiş tutar 75,00 TL.\n\n", email.Text);
    }

    [Theory]
    [MemberData(nameof(AllTemplates))]
    public void Every_template_is_sent_as_multipart_alternative_with_text_and_html(string template)
    {
        var email = Render(template);

        var body = Assert.IsType<MultipartAlternative>(email.ToMimeBody());
        Assert.Equal(2, body.Count);
        var text = Assert.IsType<TextPart>(body[0]);
        var html = Assert.IsType<TextPart>(body[1]);
        Assert.True(text.IsPlain);
        Assert.True(html.IsHtml);
        Assert.Equal(email.Text, text.Text.ReplaceLineEndings("\n"));
        Assert.Equal(email.Html, html.Text.ReplaceLineEndings("\n"));
        Assert.Equal("utf-8", html.ContentType.Charset, ignoreCase: true);
        Assert.DoesNotContain("<", email.Text);
    }

    [Theory]
    [MemberData(nameof(LinkTemplates))]
    public void Link_appears_in_the_button_the_outlook_button_the_fallback_and_the_text_part(string template,
        string subject, string? url)
    {
        var email = Render(template, url);
        var href = url!.Replace("&", "&amp;", StringComparison.Ordinal);

        Assert.NotNull(subject);
        Assert.Contains($"<!--[if !mso]><!--><a href=\"{href}\" target=\"_blank\" style=\"display:inline-block;padding:14px 28px;", email.Html);
        Assert.Contains($"<v:roundrect xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:w=\"urn:schemas-microsoft-com:office:word\" href=\"{href}\"", email.Html);
        Assert.Contains("fillcolor=\"#2159dc\"", email.Html);
        Assert.Contains("Düğme çalışmazsa aşağıdaki adresi tarayıcınızda açın.", email.Html);
        Assert.Contains($"class=\"d-a\" style=\"color:#2159dc;text-decoration:underline;word-break:break-all;\">{href}</a>", email.Html);
        Assert.Contains($"\n{url}\n", email.Text);
        Assert.DoesNotContain(url, email.Html);
    }

    [Fact]
    public void Notification_template_has_no_button_because_the_event_has_no_link()
    {
        var email = EmailTemplates.Notification("Kira yıl dönümü bugün", "Sözleşmenin yıl dönümü bugün.");

        Assert.DoesNotContain("v:roundrect", email.Html);
        Assert.DoesNotContain("<a ", email.Html);
        Assert.DoesNotContain("Düğme", email.Html);
        Assert.DoesNotContain("http", email.Text);
    }

    [Fact]
    public void Dynamic_notification_values_are_html_encoded()
    {
        const string subject = "Kira <b>gecikti</b>";
        const string body = "Kiracı Ayşe <script>alert('x')</script> & \"Ortak\" Ltd., ödenmemiş tutar 1.000,00 TL.";

        var email = EmailTemplates.Notification(subject, body);

        Assert.DoesNotContain("<script>", email.Html);
        Assert.DoesNotContain("<b>", email.Html);
        Assert.Contains("<title>Kira &lt;b&gt;gecikti&lt;/b&gt;</title>", email.Html);
        Assert.Contains(">Kira &lt;b&gt;gecikti&lt;/b&gt;</h1>", email.Html);
        Assert.Contains("Kiracı Ayşe &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;Ortak&quot; Ltd.", email.Html);
        Assert.Contains(body, email.Text);
    }

    [Fact]
    public void Notification_copy_values_with_markup_stay_encoded_in_the_email()
    {
        var place = NotificationCopy.Place("<img src=x onerror=alert(1)>", "Daire \"3\"", isDefaultUnit: false);
        var tenant = NotificationCopy.TenantName(TenantKind.COMPANY, null, null, "A&B <Ltd>");
        var text = NotificationCopy.RentDue(place, tenant, new DateOnly(2026, 11, 20), 1250.5m);

        var email = EmailTemplates.Notification(text.Title, text.Message);

        Assert.DoesNotContain("<img", email.Html);
        Assert.DoesNotContain("<Ltd>", email.Html);
        Assert.Contains("&lt;img src=x onerror=alert(1)&gt; (Daire &quot;3&quot;)", email.Html);
        Assert.Contains("Kiracı A&amp;B &lt;Ltd&gt;, ödenmemiş tutar 1.250,50 TL.", email.Html);
    }

    [Fact]
    public void Urls_are_attribute_encoded()
    {
        const string url = "https://app.example.test/dogrula?userId=1&token=a\"b<c>'d";

        var email = EmailTemplates.ConfirmEmail(url);

        Assert.Contains("href=\"https://app.example.test/dogrula?userId=1&amp;token=a&quot;b&lt;c&gt;&#39;d\"", email.Html);
        Assert.DoesNotContain("a\"b<c>", email.Html);
        Assert.Contains($"\n{url}\n", email.Text);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("JavaScript:alert(document.cookie)")]
    [InlineData(" javascript:alert(1)")]
    [InlineData("java\tscript:alert(1)")]
    [InlineData("data:text/html;base64,PHNjcmlwdD4=")]
    [InlineData("vbscript:msgbox(1)")]
    [InlineData("mailto:someone@example.test")]
    [InlineData("//evil.example.test/dogrula")]
    [InlineData("/dogrula?token=x")]
    [InlineData("https://user:pass@evil.example.test/")]
    [InlineData("https://app.example.test/dogrula?token=a b")]
    [InlineData("")]
    public void Unsafe_urls_are_rejected_before_anything_is_rendered(string url)
    {
        Assert.Throws<ArgumentException>(() => EmailTemplates.ConfirmEmail(url));
        Assert.Throws<ArgumentException>(() => EmailTemplates.ResetPassword(url));
    }

    [Fact]
    public void Local_http_frontend_origin_is_allowed()
    {
        var email = EmailTemplates.ConfirmEmail("http://localhost:3000/dogrula?userId=1&token=x");

        Assert.Contains("href=\"http://localhost:3000/dogrula?userId=1&amp;token=x\"", email.Html);
    }

    [Theory]
    [MemberData(nameof(AllTemplates))]
    public void Html_has_no_external_images_fonts_or_tracking(string template)
    {
        var html = Render(template).Html;

        Assert.DoesNotContain("<img", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("src=", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("background=", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("url(", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<link", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("@import", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("@font-face", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [MemberData(nameof(AllTemplates))]
    public void Html_carries_preheader_brand_dark_mode_and_mobile_rules(string template)
    {
        var email = Render(template);

        Assert.Contains("<div style=\"display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;\">", email.Html);
        Assert.Contains(">Mülküm</td>", email.Html);
        Assert.Contains("@media (prefers-color-scheme:dark)", email.Html);
        Assert.Contains("@media (max-width:600px)", email.Html);
        Assert.Contains("max-width:560px;", email.Html);
        Assert.Contains("<meta name=\"color-scheme\" content=\"light dark\">", email.Html);
    }

    [Fact]
    public void Long_preheader_is_shortened_but_the_body_keeps_the_full_message()
    {
        var body = string.Join(' ', Enumerable.Repeat("Güneş Apartmanı (Daire 3) kirası", 10)) + ".";

        var email = EmailTemplates.Notification("Kira ödemesi gecikti", body);
        var preheader = EmailLayout.Shorten(body);

        Assert.True(preheader.Length <= 141);
        Assert.EndsWith("…", preheader);
        Assert.Contains($"mso-hide:all;\">{preheader}&#847;", email.Html);
        Assert.Contains($">{body}</p>", email.Html);
        Assert.Equal("Kısa önizleme.", EmailLayout.Shorten("Kısa önizleme."));
    }

    [Fact]
    public void Largest_possible_message_stays_under_15_kilobytes()
    {
        var longUrl = "https://app.example.test/parola-sifirla?userId=7d0c1f52-0000-4000-8000-000000000001&token=" +
            new string('A', 700);
        var reset = EmailTemplates.ResetPassword(longUrl);
        var notification = EmailTemplates.Notification(new string('<', 200), new string('&', 1000));

        Assert.True(Encoding.UTF8.GetByteCount(reset.Html) < 15 * 1024, $"{Encoding.UTF8.GetByteCount(reset.Html)} bytes");
        Assert.True(Encoding.UTF8.GetByteCount(notification.Html) < 15 * 1024,
            $"{Encoding.UTF8.GetByteCount(notification.Html)} bytes");
    }

    [Theory]
    [MemberData(nameof(AllTemplates))]
    public void Copy_follows_the_turkish_writing_rules(string template)
    {
        var text = Render(template).Text;

        Assert.DoesNotContain("—", text);
        Assert.DoesNotContain("–", text);
        Assert.DoesNotContain(";", text);
        Assert.DoesNotContain(":\n", text);
        foreach (var conjunction in new[] { ", ama", ", ancak", ", fakat", ", lakin" })
            Assert.DoesNotContain(conjunction, text);
    }

    [Fact]
    public void Notification_copy_names_the_place_tenant_date_and_unpaid_amount()
    {
        var place = NotificationCopy.Place("Güneş Apartmanı", "Daire 3", isDefaultUnit: false);
        var tenant = NotificationCopy.TenantName(TenantKind.PERSON, "Ayşe", "Yılmaz", null);

        var due = NotificationCopy.RentDue(place, tenant, new DateOnly(2026, 11, 20), 15000m);
        var overdue = NotificationCopy.OverdueRent(place, tenant, new DateOnly(2026, 11, 5), 7500.25m);
        var end = NotificationCopy.LeaseEnd(place, tenant, new DateOnly(2026, 12, 15));
        var anniversary = NotificationCopy.RentAnniversary(place, tenant, new DateOnly(2024, 11, 16));

        Assert.Equal(new NotificationText("Kira ödeme günü yaklaşıyor",
            "Güneş Apartmanı (Daire 3) kirasının son ödeme günü 20.11.2026. Kiracı Ayşe Yılmaz, ödenmemiş tutar 15.000,00 TL."), due);
        Assert.Equal(new NotificationText("Kira ödemesi gecikti",
            "Güneş Apartmanı (Daire 3) kirasının 05.11.2026 olan son ödeme günü geçti. Kiracı Ayşe Yılmaz, ödenmemiş tutar 7.500,25 TL."), overdue);
        Assert.Equal(new NotificationText("Sözleşme bitiş tarihi yaklaşıyor",
            "Ayşe Yılmaz ile yapılan Güneş Apartmanı (Daire 3) sözleşmesinin planlanan bitiş tarihi 15.12.2026."), end);
        Assert.Equal(new NotificationText("Kira yıl dönümü bugün",
            "Ayşe Yılmaz ile 16.11.2024 tarihinde başlayan Güneş Apartmanı (Daire 3) sözleşmesinin yıl dönümü bugün."), anniversary);
    }

    [Fact]
    public void Notification_copy_reads_correctly_without_a_tenant_name_or_unit_label()
    {
        var place = NotificationCopy.Place("Test mülkü", "Varsayılan", isDefaultUnit: true);
        var tenant = NotificationCopy.TenantName(TenantKind.PERSON, null, "  ", null);

        Assert.Null(tenant);
        Assert.Equal("Test mülkü kirasının son ödeme günü 01.12.2026. Ödenmemiş tutar 100,00 TL.",
            NotificationCopy.RentDue(place, tenant, new DateOnly(2026, 12, 1), 100m).Message);
        Assert.Equal("Test mülkü sözleşmesinin planlanan bitiş tarihi 01.12.2026.",
            NotificationCopy.LeaseEnd(place, tenant, new DateOnly(2026, 12, 1)).Message);
        Assert.Equal("01.12.2024 tarihinde başlayan Test mülkü sözleşmesinin yıl dönümü bugün.",
            NotificationCopy.RentAnniversary(place, tenant, new DateOnly(2024, 12, 1)).Message);
    }

    [Theory]
    [InlineData(TenantKind.PERSON, "Ayşe", "Yılmaz", null, "Ayşe Yılmaz")]
    [InlineData(TenantKind.PERSON, "Ayşe", null, null, "Ayşe")]
    [InlineData(TenantKind.COMPANY, null, null, "Kuzey Gıda Ltd. Şti.", "Kuzey Gıda Ltd. Şti.")]
    [InlineData(TenantKind.COMPANY, "Ayşe", "Yılmaz", null, null)]
    public void Tenant_name_follows_the_tenant_kind(TenantKind kind, string? first, string? last, string? company,
        string? expected) =>
        Assert.Equal(expected, NotificationCopy.TenantName(kind, first, last, company));

    [Theory]
    [InlineData("0", "0,00 TL")]
    [InlineData("999.5", "999,50 TL")]
    [InlineData("1234567.89", "1.234.567,89 TL")]
    public void Money_uses_turkish_separators_regardless_of_culture(string amount, string expected) =>
        Assert.Equal(expected, NotificationCopy.Money(decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture)));

    [Fact]
    public void Notification_titles_fit_the_subject_column_and_messages_fit_the_message_column()
    {
        var place = NotificationCopy.Place(new string('P', 200), new string('U', 100), isDefaultUnit: false);
        var tenant = NotificationCopy.TenantName(TenantKind.PERSON, new string('A', 100), new string('B', 100), null);
        var date = new DateOnly(2026, 11, 20);

        foreach (var text in new[]
                 {
                     NotificationCopy.RentDue(place, tenant, date, 99_999_999_999_999_999.99m),
                     NotificationCopy.OverdueRent(place, tenant, date, 99_999_999_999_999_999.99m),
                     NotificationCopy.LeaseEnd(place, tenant, date),
                     NotificationCopy.RentAnniversary(place, tenant, date)
                 })
        {
            Assert.InRange(text.Title.Length, 1, 200);
            Assert.InRange(text.Message.Length, 1, 1000);
        }
    }

    private static RenderedEmail Render(string template, string? url = null) => template switch
    {
        "confirm" => EmailTemplates.ConfirmEmail(url ?? ConfirmUrl),
        "reset" => EmailTemplates.ResetPassword(url ?? ResetUrl),
        "notification" => EmailTemplates.Notification("Kira ödeme günü yaklaşıyor",
            "Güneş Apartmanı (Daire 3) kirasının son ödeme günü 20.11.2026. Kiracı Ayşe Yılmaz, ödenmemiş tutar 15.000,00 TL."),
        _ => throw new ArgumentOutOfRangeException(nameof(template))
    };
}
