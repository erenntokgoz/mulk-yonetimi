using System.Net;
using System.Net.Mail;

namespace MulkYonetimi.Api;

public sealed record RegisterRequest(string Email, string Password, string AccountName);
public sealed record ConfirmEmailRequest(Guid UserId, string Token);

public interface IConfirmationMailer
{
    Task SendAsync(string address, string confirmationUrl, CancellationToken cancellationToken);
}

public sealed class SmtpConfirmationMailer(IConfiguration configuration) : IConfirmationMailer
{
    public async Task SendAsync(string address, string confirmationUrl, CancellationToken cancellationToken)
    {
        var host = configuration["Email:SmtpHost"];
        var sender = configuration["Email:From"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(sender))
            throw new InvalidOperationException("SMTP is not configured.");
        using var client = new SmtpClient(host, configuration.GetValue("Email:SmtpPort", 587))
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(configuration["Email:SmtpUser"], configuration["Email:SmtpPassword"])
        };
        using var message = new MailMessage(sender, address, "E-posta doğrulama",
            $"E-posta adresinizi doğrulamak için bağlantıyı açın: {confirmationUrl}");
        await client.SendMailAsync(message, cancellationToken);
    }
}
