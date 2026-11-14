using Microsoft.EntityFrameworkCore;

namespace MulkYonetimi.Infrastructure;

public sealed class Document
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid? PropertyId { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? LeaseId { get; set; }
    public required string UploadObjectKey { get; set; }
    public string? ObjectKey { get; set; }
    public required string OriginalName { get; set; }
    public required string ContentType { get; set; }
    public long SizeBytes { get; set; }
    public string Status { get; set; } = "PENDING";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UploadExpiresAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public DateTime? UploadCleanupCompletedAtUtc { get; set; }
    public DateTime? DeleteCleanupCompletedAtUtc { get; set; }
    public byte[] Version { get; set; } = [];
}

internal static class DocumentMapping
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<Document>(document =>
        {
            document.HasAlternateKey(item => new { item.AccountId, item.Id });
            document.Property(item => item.UploadObjectKey).HasMaxLength(1024);
            document.Property(item => item.ObjectKey).HasMaxLength(1024);
            document.Property(item => item.OriginalName).HasMaxLength(200);
            document.Property(item => item.ContentType).HasMaxLength(100);
            document.Property(item => item.Status).HasMaxLength(16);
            document.Property(item => item.Version).IsRowVersion();
            document.Property(item => item.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
            document.HasOne<Account>().WithMany().HasForeignKey(item => item.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            document.HasOne<Property>().WithMany()
                .HasForeignKey(item => new { item.AccountId, item.PropertyId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            document.HasOne<Unit>().WithMany()
                .HasForeignKey(item => new { item.AccountId, item.UnitId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            document.HasOne<Lease>().WithMany()
                .HasForeignKey(item => new { item.AccountId, item.LeaseId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            document.ToTable(table =>
            {
                table.HasCheckConstraint("CK_Documents_ExactlyOneOwner",
                    "((CASE WHEN [PropertyId] IS NULL THEN 0 ELSE 1 END) + " +
                    "(CASE WHEN [UnitId] IS NULL THEN 0 ELSE 1 END) + " +
                    "(CASE WHEN [LeaseId] IS NULL THEN 0 ELSE 1 END)) = 1");
                table.HasCheckConstraint("CK_Documents_Status", "[Status] IN ('PENDING', 'ACTIVE', 'DELETED')");
                table.HasCheckConstraint("CK_Documents_ActiveObject",
                    "[Status] <> 'ACTIVE' OR ([ObjectKey] IS NOT NULL AND [CompletedAtUtc] IS NOT NULL)");
            });
            document.HasIndex(item => new { item.AccountId, item.Status, item.CreatedAtUtc });
            document.HasIndex(item => item.UploadObjectKey).IsUnique();
            document.HasIndex(item => item.ObjectKey).IsUnique().HasFilter("[ObjectKey] IS NOT NULL");
        });
    }
}
