using Microsoft.EntityFrameworkCore;

namespace MulkYonetimi.Infrastructure;

internal static class RentLedgerMapping
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<Lease>(lease =>
        {
            lease.HasAlternateKey(item => new { item.AccountId, item.Id });
            lease.HasOne<Unit>().WithMany().HasForeignKey(item => new { item.AccountId, item.UnitId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            lease.HasOne<Tenant>().WithMany().HasForeignKey(item => new { item.AccountId, item.TenantId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            lease.Property(item => item.Status).HasConversion<string>().HasMaxLength(16);
            lease.HasIndex(item => new { item.AccountId, item.UnitId }).IsUnique().HasFilter("[Status] = 'ACTIVE'");
            lease.HasIndex(item => new { item.AccountId, item.UnitId, item.StartDate });
            lease.Property(item => item.DepositAmount).HasPrecision(19, 2);
            lease.Property(item => item.Note).HasMaxLength(1000);
            lease.Property(item => item.TerminationReason).HasMaxLength(500);
            lease.Property(item => item.Version).IsRowVersion();
        });
        builder.Entity<RentRatePeriod>(rate =>
        {
            rate.HasKey(item => new { item.AccountId, item.LeaseId, item.EffectiveFrom });
            rate.HasOne<Lease>().WithMany().HasForeignKey(item => new { item.AccountId, item.LeaseId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            rate.Property(item => item.MonthlyAmount).HasPrecision(19, 2);
            rate.Property(item => item.Reason).HasMaxLength(500);
        });
        builder.Entity<LeaseRenewal>(renewal =>
        {
            renewal.HasKey(item => item.Id);
            renewal.HasIndex(item => new { item.AccountId, item.LeaseId, item.EffectiveFrom }).IsUnique();
            renewal.HasOne<Lease>().WithMany().HasForeignKey(item => new { item.AccountId, item.LeaseId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            renewal.Property(item => item.MonthlyAmount).HasPrecision(19, 2);
            renewal.Property(item => item.Reason).HasMaxLength(500);
        });
        builder.Entity<RentCharge>(charge =>
        {
            charge.HasAlternateKey(item => new { item.AccountId, item.Id });
            charge.HasIndex(item => new { item.AccountId, item.LeaseId, item.PeriodStart }).IsUnique();
            charge.HasOne<Lease>().WithMany().HasForeignKey(item => new { item.AccountId, item.LeaseId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            charge.Property(item => item.Amount).HasPrecision(19, 2);
        });
        builder.Entity<Payment>(payment =>
        {
            payment.HasAlternateKey(item => new { item.AccountId, item.Id });
            payment.HasIndex(item => new { item.AccountId, item.IdempotencyKey }).IsUnique();
            payment.HasIndex(item => new { item.AccountId, item.PaidOn, item.Id });
            payment.HasOne<Tenant>().WithMany().HasForeignKey(item => new { item.AccountId, item.TenantId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            payment.Property(item => item.Amount).HasPrecision(19, 2);
            payment.Property(item => item.Method).HasConversion<string>().HasMaxLength(16);
            payment.Property(item => item.IdempotencyKey).HasMaxLength(64).UseCollation("Latin1_General_100_BIN2");
            payment.Property(item => item.Reference).HasMaxLength(500);
            payment.Property(item => item.VoidReason).HasMaxLength(500);
        });
        builder.Entity<RentChargeCorrection>(correction =>
        {
            correction.HasIndex(item => new { item.AccountId, item.RentChargeId, item.IdempotencyKey }).IsUnique();
            correction.HasOne<RentCharge>().WithMany().HasForeignKey(item => new { item.AccountId, Id = item.RentChargeId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            correction.Property(item => item.PreviousAmount).HasPrecision(19, 2);
            correction.Property(item => item.Amount).HasPrecision(19, 2);
            correction.Property(item => item.Reason).HasMaxLength(500);
            correction.Property(item => item.IdempotencyKey).HasMaxLength(64).UseCollation("Latin1_General_100_BIN2");
        });
        builder.Entity<PaymentAllocation>(allocation =>
        {
            allocation.HasIndex(item => new { item.AccountId, item.PaymentId, item.IdempotencyKey }).IsUnique();
            allocation.HasOne<Payment>().WithMany().HasForeignKey(item => new { item.AccountId, item.PaymentId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            allocation.HasOne<RentCharge>().WithMany().HasForeignKey(item => new { item.AccountId, item.RentChargeId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            allocation.Property(item => item.Amount).HasPrecision(19, 2);
            allocation.Property(item => item.IdempotencyKey).HasMaxLength(64).UseCollation("Latin1_General_100_BIN2");
        });
    }
}
