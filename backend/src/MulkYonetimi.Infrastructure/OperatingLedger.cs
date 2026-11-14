using Microsoft.EntityFrameworkCore;

namespace MulkYonetimi.Infrastructure;

public enum DepositCustody { OWNER_HELD, BANK_BLOCKED }
public enum DepositMovementType { HELD, RETURNED, ADJUSTED }
public enum ExpenseCategory { MAINTENANCE, DUES, TAX, INSURANCE, OTHER }

public sealed class SecurityDeposit
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid LeaseId { get; set; }
    public DepositCustody CustodyType { get; set; }
    public string? Note { get; set; }
}

public sealed class DepositMovement
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid DepositId { get; set; }
    public DateOnly MovementOn { get; set; }
    public DepositMovementType MovementType { get; set; }
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public required string IdempotencyKey { get; set; }
}

public sealed class Expense
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }
    public Guid? UnitId { get; set; }
    public ExpenseCategory Category { get; set; }
    public decimal Amount { get; set; }
    public DateOnly ExpenseOn { get; set; }
    public DateOnly? PaidOn { get; set; }
    public string? Note { get; set; }
    public required string IdempotencyKey { get; set; }
    public DateTime? VoidedAtUtc { get; set; }
    public string? VoidReason { get; set; }
}

internal static class OperatingLedgerMapping
{
    public static void Configure(ModelBuilder builder)
    {
        builder.Entity<SecurityDeposit>(deposit =>
        {
            deposit.HasAlternateKey(item => new { item.AccountId, item.Id });
            deposit.HasIndex(item => new { item.AccountId, item.LeaseId }).IsUnique();
            deposit.HasOne<Lease>().WithMany().HasForeignKey(item => new { item.AccountId, item.LeaseId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            deposit.Property(item => item.CustodyType).HasConversion<string>().HasMaxLength(16);
            deposit.Property(item => item.Note).HasMaxLength(500);
        });
        builder.Entity<DepositMovement>(movement =>
        {
            movement.HasIndex(item => new { item.AccountId, item.DepositId, item.IdempotencyKey }).IsUnique();
            movement.HasOne<SecurityDeposit>().WithMany().HasForeignKey(item => new { item.AccountId, item.DepositId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            movement.Property(item => item.MovementType).HasConversion<string>().HasMaxLength(16);
            movement.Property(item => item.Amount).HasPrecision(19, 2);
            movement.Property(item => item.Note).HasMaxLength(500);
            movement.Property(item => item.IdempotencyKey).HasMaxLength(64).UseCollation("Latin1_General_100_BIN2");
        });
        builder.Entity<Expense>(expense =>
        {
            expense.HasIndex(item => new { item.AccountId, item.IdempotencyKey }).IsUnique();
            expense.HasIndex(item => new { item.AccountId, item.ExpenseOn, item.Id });
            expense.HasOne<Property>().WithMany().HasForeignKey(item => new { item.AccountId, item.PropertyId })
                .HasPrincipalKey(item => new { item.AccountId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            expense.HasOne<Unit>().WithMany().HasForeignKey(item => new { item.AccountId, item.PropertyId, item.UnitId })
                .HasPrincipalKey(item => new { item.AccountId, item.PropertyId, item.Id }).OnDelete(DeleteBehavior.Restrict);
            expense.Property(item => item.Category).HasConversion<string>().HasMaxLength(16);
            expense.Property(item => item.Amount).HasPrecision(19, 2);
            expense.Property(item => item.Note).HasMaxLength(500);
            expense.Property(item => item.VoidReason).HasMaxLength(500);
            expense.Property(item => item.IdempotencyKey).HasMaxLength(64).UseCollation("Latin1_General_100_BIN2");
        });
    }
}
