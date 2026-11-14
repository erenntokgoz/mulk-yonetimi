using Microsoft.EntityFrameworkCore;

namespace MulkYonetimi.Infrastructure;

public sealed class NotificationPreference
{
    public Guid AccountId { get; set; }
    public Guid UserId { get; set; }
    public bool EmailEnabled { get; set; }
    public bool RentDueEnabled { get; set; } = true;
    public bool OverdueRentEnabled { get; set; } = true;
    public bool LeaseEndEnabled { get; set; } = true;
    public bool RentAnniversaryEnabled { get; set; } = true;
}

public sealed class Notification
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid UserId { get; set; }
    public required string EventKey { get; set; }
    public required string Type { get; set; }
    public required string Title { get; set; }
    public required string Message { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReadAtUtc { get; set; }
}

internal static class NotificationMapping
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<NotificationPreference>(preference =>
        {
            preference.HasKey(item => new { item.AccountId, item.UserId });
            preference.HasOne<AccountMember>().WithMany()
                .HasForeignKey(item => new { item.AccountId, item.UserId })
                .HasPrincipalKey(item => new { item.AccountId, item.UserId })
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Notification>(notification =>
        {
            notification.HasAlternateKey(item => new { item.AccountId, item.Id });
            notification.Property(item => item.EventKey).HasMaxLength(200);
            notification.Property(item => item.Type).HasMaxLength(32);
            notification.Property(item => item.Title).HasMaxLength(200);
            notification.Property(item => item.Message).HasMaxLength(1000);
            notification.Property(item => item.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
            notification.HasOne<AccountMember>().WithMany()
                .HasForeignKey(item => new { item.AccountId, item.UserId })
                .HasPrincipalKey(item => new { item.AccountId, item.UserId })
                .OnDelete(DeleteBehavior.Restrict);
            notification.HasIndex(item => new { item.AccountId, item.UserId, item.EventKey }).IsUnique();
            notification.HasIndex(item => new { item.AccountId, item.UserId, item.ReadAtUtc, item.CreatedAtUtc });
        });
    }
}
