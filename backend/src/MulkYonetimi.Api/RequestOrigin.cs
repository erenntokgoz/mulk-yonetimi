namespace MulkYonetimi.Api;

internal static class RequestOrigin
{
    public static bool IsAllowed(HttpContext context, IConfiguration configuration)
    {
        var configured = configuration["Auth:FrontendOrigin"];
        return Uri.TryCreate(configured, UriKind.Absolute, out var allowed) &&
               (allowed.Scheme == Uri.UriSchemeHttp || allowed.Scheme == Uri.UriSchemeHttps) &&
               allowed.UserInfo.Length == 0 && allowed.AbsolutePath == "/" &&
               allowed.Query.Length == 0 && allowed.Fragment.Length == 0 &&
               context.Request.Headers.Origin == allowed.GetLeftPart(UriPartial.Authority);
    }
}
