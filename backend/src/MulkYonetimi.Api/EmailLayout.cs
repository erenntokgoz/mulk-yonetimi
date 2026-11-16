using System.Text;
using MimeKit;

namespace MulkYonetimi.Api;

public sealed record EmailAction(string Label, string Url, string TextPrompt);

public sealed record EmailContent(string Subject, string Preheader, string Heading,
    IReadOnlyList<string> Paragraphs, EmailAction? Action, string? Note, string Reason);

public sealed record RenderedEmail(string Subject, string Html, string Text)
{
    public MimeEntity ToMimeBody() => new BodyBuilder { TextBody = Text, HtmlBody = Html }.ToMessageBody();
}

// One table-based layout shared by every transactional e-mail. Styles stay inline because many
// clients drop <style>; the small <style> block only adds dark mode and narrow-screen overrides.
public static class EmailLayout
{
    private const string Font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    private const string Primary = "#2159dc";
    private const string Heading = "#0f172a";
    private const string Body = "#334155";
    private const string Muted = "#586274";
    private const string Rule = "#e2e7ef";
    private const string Page = "#f3f5f9";

    // Keeps the start of the body text out of the inbox preview after the preheader.
    private static readonly string PreheaderFiller = string.Concat(Enumerable.Repeat("&#847;&zwnj;&nbsp;", 40));

    public static RenderedEmail Render(EmailContent content)
    {
        var action = content.Action is { } given ? given with { Url = RequireSafeUrl(given.Url) } : null;
        return new RenderedEmail(content.Subject, RenderHtml(content, action), RenderText(content, action));
    }

    internal static string Encode(string value)
    {
        var builder = new StringBuilder(value.Length + 16);
        foreach (var character in value)
        {
            switch (character)
            {
                case '&': builder.Append("&amp;"); break;
                case '<': builder.Append("&lt;"); break;
                case '>': builder.Append("&gt;"); break;
                case '"': builder.Append("&quot;"); break;
                case '\'': builder.Append("&#39;"); break;
                default: builder.Append(character); break;
            }
        }
        return builder.ToString();
    }

    // Links are built by the API itself, so anything other than a plain absolute http(s) URL is a bug
    // or an injection attempt. Failing here keeps the message in the outbox retry path instead of sending it.
    internal static string RequireSafeUrl(string url)
    {
        if (string.IsNullOrEmpty(url) || url.Any(character => char.IsWhiteSpace(character) || char.IsControl(character)) ||
            !Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp) ||
            !string.IsNullOrEmpty(uri.UserInfo))
            throw new ArgumentException("E-posta bağlantısı mutlak bir http veya https adresi olmalıdır.", nameof(url));
        return url;
    }

    private static string RenderHtml(EmailContent content, EmailAction? action)
    {
        var html = new StringBuilder(8_192);
        html.Append($$"""
            <!DOCTYPE html>
            <html lang="tr" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <meta name="x-apple-disable-message-reformatting">
            <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
            <meta name="color-scheme" content="light dark">
            <meta name="supported-color-schemes" content="light dark">
            <title>{{Encode(content.Subject)}}</title>
            <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
            <style>
            body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
            table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
            a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
            @media (max-width:600px){
            .m-outer{padding:24px 12px!important}.m-card{padding:28px 20px 24px!important}.m-h1{font-size:20px!important;line-height:28px!important}
            }
            @media (prefers-color-scheme:dark){
            .d-bg{background-color:#0b1120!important}.d-card{background-color:#141c2c!important;border-color:#26324a!important}.d-h{color:#f1f5f9!important}.d-t{color:#cbd5e1!important}.d-m{color:#9aa6b8!important}.d-a{color:#9dbcff!important}.d-rule{border-color:#26324a!important}
            }
            [data-ogsc] .d-h{color:#f1f5f9!important}[data-ogsc] .d-t{color:#cbd5e1!important}[data-ogsc] .d-m{color:#9aa6b8!important}[data-ogsc] .d-a{color:#9dbcff!important}
            </style>
            </head>
            <body class="d-bg" style="margin:0;padding:0;background-color:{{Page}};">
            <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{{Encode(Shorten(content.Preheader))}}{{PreheaderFiller}}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="d-bg" style="background-color:{{Page}};">
            <tr>
            <td align="center" class="m-outer" style="padding:40px 16px;">
            <!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
            <td style="padding:0 4px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
            <td width="28" height="28" align="center" valign="middle" bgcolor="{{Primary}}" style="width:28px;height:28px;background-color:{{Primary}};border-radius:8px;color:#ffffff;font-family:{{Font}};font-size:15px;line-height:28px;font-weight:700;mso-line-height-rule:exactly;">M</td>
            <td class="d-h" style="padding-left:10px;font-family:{{Font}};font-size:18px;line-height:28px;font-weight:700;letter-spacing:-0.2px;color:{{Heading}};mso-line-height-rule:exactly;">Mülküm</td>
            </tr>
            </table>
            </td>
            </tr>
            <tr>
            <td class="d-card m-card" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid {{Rule}};border-radius:12px;padding:36px 36px 32px;">
            <h1 class="d-h m-h1" style="margin:0 0 16px;font-family:{{Font}};font-size:22px;line-height:30px;font-weight:700;color:{{Heading}};">{{Encode(content.Heading)}}</h1>

            """);

        var lastMargin = action is not null ? "0 0 8px" : content.Note is not null ? "0 0 24px" : "0";
        for (var index = 0; index < content.Paragraphs.Count; index++)
        {
            var margin = index < content.Paragraphs.Count - 1 ? "0 0 16px" : lastMargin;
            var paragraph = Encode(content.Paragraphs[index]).Replace("\n", "<br>", StringComparison.Ordinal);
            html.Append($"""<p class="d-t" style="margin:{margin};font-family:{Font};font-size:16px;line-height:24px;color:{Body};">{paragraph}</p>""")
                .Append('\n');
        }

        if (action is not null) AppendAction(html, action, content.Note is not null);
        if (content.Note is { } note)
        {
            html.Append($$"""
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                <td class="d-rule d-t" style="border-top:1px solid {{Rule}};padding-top:20px;font-family:{{Font}};font-size:14px;line-height:22px;color:#475569;">{{Encode(note)}}</td>
                </tr>
                </table>

                """);
        }

        html.Append($$"""
            </td>
            </tr>
            <tr>
            <td class="d-m" style="padding:20px 4px 0;font-family:{{Font}};font-size:13px;line-height:20px;color:{{Muted}};">{{Encode(content.Reason)}}</td>
            </tr>
            </table>
            <!--[if mso]></td></tr></table><![endif]-->
            </td>
            </tr>
            </table>
            </body>
            </html>

            """);
        return html.ToString();
    }

    // Inbox previews show about 140 characters; a longer preheader only adds weight.
    internal static string Shorten(string preheader)
    {
        const int limit = 140;
        if (preheader.Length <= limit) return preheader;
        var cut = preheader.LastIndexOf(' ', limit);
        return string.Concat(preheader.AsSpan(0, cut > 0 ? cut : limit), "…");
    }

    private static void AppendAction(StringBuilder html, EmailAction action, bool noteFollows)
    {
        var href = Encode(action.Url);
        var label = Encode(action.Label);
        // Outlook for Windows ignores padding on links, so it gets a VML button of a fixed width instead.
        var vmlWidth = Math.Max(200, action.Label.Length * 10 + 56);
        var fallbackMargin = noteFollows ? "0 0 24px" : "0";
        html.Append($$"""
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
            <td style="padding:16px 0 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
            <td align="center" bgcolor="{{Primary}}" style="background-color:{{Primary}};border-radius:8px;">
            <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{href}}" style="height:48px;v-text-anchor:middle;width:{{vmlWidth}}px;" arcsize="17%" stroke="f" fillcolor="{{Primary}}"><w:anchorlock/><center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:bold;">{{label}}</center></v:roundrect><![endif]-->
            <!--[if !mso]><!--><a href="{{href}}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:{{Font}};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;background-color:{{Primary}};border-radius:8px;">{{label}}</a><!--<![endif]-->
            </td>
            </tr>
            </table>
            </td>
            </tr>
            </table>
            <p class="d-m" style="margin:0 0 6px;font-family:{{Font}};font-size:13px;line-height:20px;color:{{Muted}};">Düğme çalışmazsa aşağıdaki adresi tarayıcınızda açın.</p>
            <p style="margin:{{fallbackMargin}};font-family:{{Font}};font-size:13px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="{{href}}" target="_blank" class="d-a" style="color:{{Primary}};text-decoration:underline;word-break:break-all;">{{href}}</a></p>

            """);
    }

    private static string RenderText(EmailContent content, EmailAction? action)
    {
        var text = new StringBuilder(1_024);
        text.Append(content.Heading).Append("\n\n");
        foreach (var paragraph in content.Paragraphs) text.Append(paragraph).Append("\n\n");
        if (action is not null) text.Append(action.TextPrompt).Append('\n').Append(action.Url).Append("\n\n");
        if (content.Note is { } note) text.Append(note).Append("\n\n");
        text.Append(content.Reason).Append('\n');
        return text.ToString();
    }
}
