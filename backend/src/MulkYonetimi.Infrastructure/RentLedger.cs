namespace MulkYonetimi.Infrastructure;

public enum LeaseStatus { DRAFT, ACTIVE, TERMINATED }

public sealed class Lease
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid UnitId { get; set; }
    public Guid TenantId { get; set; }
    public LeaseStatus Status { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? PlannedEndDate { get; set; }
    public DateOnly? TerminationDate { get; set; }
    public int DueDay { get; set; }
    public decimal DepositAmount { get; set; }
    public string? Note { get; set; }
    public string? TerminationReason { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public byte[] Version { get; set; } = [];
}

public sealed class RentRatePeriod
{
    public Guid AccountId { get; set; }
    public Guid LeaseId { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public decimal MonthlyAmount { get; set; }
    public string? Reason { get; set; }
}

public sealed class RentCharge
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid LeaseId { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly DueDate { get; set; }
    public decimal Amount { get; set; }
}

public enum PaymentMethod { TRANSFER, CASH, OTHER }

public sealed class RentChargeCorrection
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid RentChargeId { get; set; }
    public decimal PreviousAmount { get; set; }
    public decimal Amount { get; set; }
    public required string Reason { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public required string IdempotencyKey { get; set; }
}

public sealed class Payment
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid TenantId { get; set; }
    public DateOnly PaidOn { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public string? Reference { get; set; }
    public required string IdempotencyKey { get; set; }
    public DateTime? VoidedAtUtc { get; set; }
    public string? VoidReason { get; set; }
}

public sealed class PaymentAllocation
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid PaymentId { get; set; }
    public Guid RentChargeId { get; set; }
    public decimal Amount { get; set; }
    public required string IdempotencyKey { get; set; }
}
