using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MulkYonetimi.Infrastructure;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public DateTime CreatedAtUtc { get; set; }
    public string? DisplayName { get; set; }
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

public sealed class AccountPlan
{
    public Guid AccountId { get; set; }
    public required string Code { get; set; }
}

public sealed class AccountEntitlement
{
    public Guid AccountId { get; set; }
    public required string Code { get; set; }
    public int? LimitValue { get; set; }
}

public sealed class OutboxMessage
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public required string Kind { get; set; }
    public int PayloadVersion { get; set; } = 1;
    public required string RecipientEmail { get; set; }
    public required string ProtectedUrl { get; set; }
    public string? EventKey { get; set; }
    public Guid? UserId { get; set; }
    public string? NotificationType { get; set; }
    public string? Subject { get; set; }
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
    public DbSet<AccountPlan> AccountPlans => Set<AccountPlan>();
    public DbSet<AccountEntitlement> AccountEntitlements => Set<AccountEntitlement>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<Property> Properties => Set<Property>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Lease> Leases => Set<Lease>();
    public DbSet<RentRatePeriod> RentRatePeriods => Set<RentRatePeriod>();
    public DbSet<LeaseRenewal> LeaseRenewals => Set<LeaseRenewal>();
    public DbSet<RentCharge> RentCharges => Set<RentCharge>();
    public DbSet<RentChargeCorrection> RentChargeCorrections => Set<RentChargeCorrection>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PaymentAllocation> PaymentAllocations => Set<PaymentAllocation>();
    public DbSet<SecurityDeposit> SecurityDeposits => Set<SecurityDeposit>();
    public DbSet<DepositMovement> DepositMovements => Set<DepositMovement>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Document> Documents => Set<Document>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        RentLedgerMapping.Configure(builder);
        OperatingLedgerMapping.Configure(builder);
        NotificationMapping.Configure(builder);
        DocumentMapping.Configure(builder);

        builder.Entity<ApplicationUser>(user =>
        {
            user.Property(item => item.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
            user.Property(item => item.DisplayName).HasMaxLength(200);
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
        builder.Entity<AccountPlan>(plan =>
        {
            plan.HasKey(item => item.AccountId);
            plan.Property(item => item.Code).HasMaxLength(32);
            plan.HasOne<Account>().WithMany().HasForeignKey(item => item.AccountId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<AccountEntitlement>(entitlement =>
        {
            entitlement.HasKey(item => new { item.AccountId, item.Code });
            entitlement.Property(item => item.Code).HasMaxLength(32);
            entitlement.HasOne<Account>().WithMany().HasForeignKey(item => item.AccountId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<OutboxMessage>(message =>
        {
            message.Property(item => item.Kind).HasMaxLength(32);
            message.Property(item => item.RecipientEmail).HasMaxLength(256);
            message.Property(item => item.EventKey).HasMaxLength(260);
            message.Property(item => item.NotificationType).HasMaxLength(32);
            message.Property(item => item.Subject).HasMaxLength(200);
            message.Property(item => item.Status).HasMaxLength(16);
            message.Property(item => item.CreatedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()");
            message.HasOne<Account>().WithMany().HasForeignKey(item => item.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            message.HasIndex(item => new { item.Status, item.NextAttemptAtUtc });
            message.HasIndex(item => new { item.AccountId, item.EventKey }).IsUnique()
                .HasFilter("[EventKey] IS NOT NULL");
            message.HasOne<AccountMember>().WithMany()
                .HasForeignKey(item => new { item.AccountId, item.UserId })
                .HasPrincipalKey(item => new { item.AccountId, item.UserId })
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Property>(property =>
        {
            property.HasAlternateKey(item => new { item.AccountId, item.Id });
            property.Property(item => item.Name).HasMaxLength(200);
            property.Property(item => item.Address).HasMaxLength(500);
            property.Property(item => item.Kind).HasConversion<string>().HasMaxLength(16);
            property.Property(item => item.Version).IsRowVersion();
            property.HasOne<Account>().WithMany().HasForeignKey(item => item.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            property.HasIndex(item => new { item.AccountId, item.ArchivedAtUtc, item.Name, item.Id });
        });

        builder.Entity<Unit>(unit =>
        {
            unit.HasAlternateKey(item => new { item.AccountId, item.Id });
            unit.Property(item => item.Label).HasMaxLength(100);
            unit.Property(item => item.DoorNumber).HasMaxLength(32);
            unit.Property(item => item.AreaM2).HasPrecision(9, 2);
            unit.Property(item => item.UsageType).HasConversion<string>().HasMaxLength(16);
            unit.HasIndex(item => new { item.AccountId, item.PropertyId, item.ArchivedAtUtc });
            unit.HasOne<Property>().WithMany()
                .HasForeignKey(item => new { item.AccountId, item.PropertyId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id })
                .OnDelete(DeleteBehavior.Restrict);
            unit.HasIndex(item => new { item.AccountId, item.PropertyId, item.Label }).IsUnique();
            unit.HasIndex(item => new { item.AccountId, item.PropertyId }).IsUnique().HasFilter("[IsDefault] = 1");
        });

        builder.Entity<Tenant>(tenant =>
        {
            tenant.HasAlternateKey(item => new { item.AccountId, item.Id });
            tenant.Property(item => item.Kind).HasConversion<string>().HasMaxLength(16);
            tenant.Property(item => item.FirstName).HasMaxLength(100);
            tenant.Property(item => item.LastName).HasMaxLength(100);
            tenant.Property(item => item.CompanyName).HasMaxLength(200);
            tenant.Property(item => item.Phone).HasMaxLength(32);
            tenant.Property(item => item.Email).HasMaxLength(256);
            tenant.Property(item => item.Version).IsRowVersion();
            tenant.HasOne<Account>().WithMany().HasForeignKey(item => item.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            tenant.HasIndex(item => new { item.AccountId, item.ArchivedAtUtc });
        });

        builder.Entity<AuditEvent>(audit =>
        {
            audit.Property(item => item.EntityType).HasMaxLength(32);
            audit.Property(item => item.Action).HasMaxLength(32);
            audit.Property(item => item.CorrelationId).HasMaxLength(64);
            audit.Property(item => item.Reason).HasMaxLength(500);
            audit.HasOne<Account>().WithMany().HasForeignKey(item => item.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            audit.HasIndex(item => new { item.AccountId, item.OccurredAtUtc });
        });
    }
}
