using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace MulkYonetimi.Api;

public sealed record RegisterRequest(string Email, string Password, string AccountName);
public sealed record ConfirmEmailRequest(Guid UserId, string Token);
public sealed record EmailRequest(string Email);
public sealed record ResetPasswordRequest(Guid UserId, string Token, string Password);

public interface IConfirmationMailer
{
    Task SendAsync(string address, string confirmationUrl, CancellationToken cancellationToken);
    Task SendPasswordResetAsync(string address, string resetUrl, CancellationToken cancellationToken);
    Task SendNotificationAsync(string address, string subject, string body, CancellationToken cancellationToken);
}

public sealed class SmtpConfirmationMailer(IConfiguration configuration) : IConfirmationMailer
{
    public async Task SendAsync(string address, string confirmationUrl, CancellationToken cancellationToken)
        => await SendMessageAsync(address, EmailTemplates.ConfirmEmail(confirmationUrl), cancellationToken);

    public async Task SendPasswordResetAsync(string address, string resetUrl, CancellationToken cancellationToken)
        => await SendMessageAsync(address, EmailTemplates.ResetPassword(resetUrl), cancellationToken);

    public async Task SendNotificationAsync(string address, string subject, string body,
        CancellationToken cancellationToken) =>
        await SendMessageAsync(address, EmailTemplates.Notification(subject, body), cancellationToken);

    private async Task SendMessageAsync(string address, RenderedEmail email, CancellationToken cancellationToken)
    {
        var host = configuration["Email:SmtpHost"];
        var sender = configuration["Email:From"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(sender))
            throw new InvalidOperationException("SMTP is not configured.");
        var port = configuration.GetValue("Email:SmtpPort", 587);
        var user = configuration["Email:SmtpUser"];
        using var message = new MimeMessage();
        message.From.Add(new MailboxAddress("Mülküm", MailboxAddress.Parse(sender).Address));
        message.To.Add(MailboxAddress.Parse(address));
        message.Subject = email.Subject;
        message.Headers.Add("Auto-Submitted", "auto-generated");
        message.Body = email.ToMimeBody();
        using var client = new SmtpClient { Timeout = 30_000 };
        await client.ConnectAsync(host, port, SmtpSecurity.For(port), cancellationToken);
        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, configuration["Email:SmtpPassword"] ?? string.Empty, cancellationToken);
        await client.SendAsync(new SendRequest(message), cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}

public static class SmtpSecurity
{
    public static SecureSocketOptions For(int port) =>
        port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
}
