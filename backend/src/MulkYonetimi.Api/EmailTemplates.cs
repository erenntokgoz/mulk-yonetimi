namespace MulkYonetimi.Api;

public static class EmailTemplates
{
    public static RenderedEmail ConfirmEmail(string confirmationUrl) => EmailLayout.Render(new EmailContent(
        Subject: "E-posta adresinizi doğrulayın",
        Preheader: "Giriş yapabilmek için önce adresin size ait olduğunu doğrulayın.",
        Heading: "E-posta adresinizi doğrulayın",
        Paragraphs:
        [
            "Bu adresle bir Mülküm hesabı oluşturuldu. Giriş yapabilmek için önce adresin size ait olduğunu doğrulayın."
        ],
        Action: new EmailAction("E-postamı doğrula", confirmationUrl,
            "Adresinizi doğrulamak için bu bağlantıyı açın."),
        Note: "Hesabı siz oluşturmadıysanız bu iletiyi yok sayabilirsiniz. Adres doğrulanmadıkça hesaba giriş yapılamaz.",
        Reason: "Bu iletiyi adresinizle bir Mülküm hesabı oluşturulduğu için aldınız."));

    public static RenderedEmail ResetPassword(string resetUrl) => EmailLayout.Render(new EmailContent(
        Subject: "Parolanızı sıfırlayın",
        Preheader: "Mülküm hesabınız için parola sıfırlama isteği aldık.",
        Heading: "Parolanızı sıfırlayın",
        Paragraphs:
        [
            "Mülküm hesabınız için parola sıfırlama isteği aldık. Yeni bir parola belirledikten sonra hesabınıza giriş yapabilirsiniz."
        ],
        Action: new EmailAction("Yeni parola belirle", resetUrl,
            "Yeni parola belirlemek için bu bağlantıyı açın."),
        Note: "Bu isteği siz yapmadıysanız iletiyi yok sayabilirsiniz. Yeni parola kaydedilmedikçe mevcut parolanız geçerli kalır.",
        Reason: "Bu iletiyi hesabınızda parola sıfırlama istendiği için aldınız."));

    // Subject and body come from the notification row, so older queued messages render with the same layout.
    public static RenderedEmail Notification(string subject, string body) => EmailLayout.Render(new EmailContent(
        Subject: subject,
        Preheader: body,
        Heading: subject,
        Paragraphs: [body],
        Action: null,
        Note: null,
        Reason: "Bu iletiyi Mülküm'de e-posta bildirimlerini açtığınız için aldınız. " +
            "Bildirim türlerini Ayarlar sayfasındaki Bildirim tercihleri bölümünden değiştirebilirsiniz."));
}
