using System.Security.Claims;
using Microsoft.EntityFrameworkCore;

namespace MulkYonetimi.Infrastructure;

public sealed class AccountMembershipResolver(ApplicationDbContext db)
{
    public async Task<Guid?> ResolveAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default)
    {
        if (principal.Identity?.IsAuthenticated != true ||
            !Guid.TryParse(principal.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId))
            return null;

        var accountIds = await (
            from member in db.AccountMembers.AsNoTracking()
            join user in db.Users.AsNoTracking() on member.UserId equals user.Id
            join account in db.Accounts.AsNoTracking() on member.AccountId equals account.Id
            where member.UserId == userId && user.EmailConfirmed &&
                  member.Role == "OWNER" && member.Status == "ACTIVE" && account.Status == "ACTIVE"
            select account.Id).Take(2).ToArrayAsync(cancellationToken);

        return accountIds.Length == 1 ? accountIds[0] : null;
    }
}
