using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MulkYonetimi.Infrastructure;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class Account
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class AccountMember
{
    public Guid AccountId { get; set; }
    public Guid UserId { get; set; }
    public required string Role { get; set; }
    public required string Status { get; set; }
}

public sealed class OutboxMessage
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public required string Kind { get; set; }
    public int PayloadVersion { get; set; } = 1;
    public required string RecipientEmail { get; set; }
    public required string ProtectedUrl { get; set; }
    public string Status { get; set; } = "PENDING";
    public int AttemptCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime NextAttemptAtUtc { get; set; }
    public DateTime? ClaimedUntilUtc { get; set; }
    public Guid? ClaimId { get; set; }
    public DateTime? SentAtUtc { get; set; }
}

public sealed class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<AccountMember> AccountMembers => Set<AccountMember>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(user =>
        {
            user.Property(item => item.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
            user.HasIndex(item => item.NormalizedEmail).IsUnique()
                .HasFilter("[NormalizedEmail] IS NOT NULL");
        });

        builder.Entity<Account>(account =>
        {
            account.Property(item => item.Name).HasMaxLength(200);
            account.Property(item => item.Status).HasMaxLength(16);
            account.Property(item => item.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
        });

        builder.Entity<AccountMember>(member =>
        {
            member.HasKey(item => new { item.AccountId, item.UserId });
            member.Property(item => item.Role).HasMaxLength(16);
            member.Property(item => item.Status).HasMaxLength(16);
            member.HasOne<Account>().WithMany().HasForeignKey(item => item.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            member.HasOne<ApplicationUser>().WithMany().HasForeignKey(item => item.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<OutboxMessage>(message =>
        {
            message.Property(item => item.Kind).HasMaxLength(32);
            message.Property(item => item.RecipientEmail).HasMaxLength(256);
            message.Property(item => item.Status).HasMaxLength(16);
            message.Property(item => item.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
            message.HasOne<Account>().WithMany().HasForeignKey(item => item.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            message.HasIndex(item => new { item.Status, item.NextAttemptAtUtc });
        });
    }
}
