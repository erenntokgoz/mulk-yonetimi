namespace MulkYonetimi.Infrastructure;

public enum PropertyKind { SINGLE_UNIT, MULTI_UNIT }

public enum UnitUsageType { RESIDENTIAL, COMMERCIAL }

public enum TenantKind { PERSON, COMPANY }

public sealed class Property
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public required string Name { get; set; }
    public required string Address { get; set; }
    public PropertyKind Kind { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }
    public byte[] Version { get; set; } = [];
}

public sealed class Unit
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid PropertyId { get; set; }
    public required string Label { get; set; }
    public string? DoorNumber { get; set; }
    public decimal? AreaM2 { get; set; }
    public UnitUsageType UsageType { get; set; }
    public bool IsDefault { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }
}

public sealed class Tenant
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public TenantKind Kind { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? CompanyName { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public DateTime? ArchivedAtUtc { get; set; }
    public byte[] Version { get; set; } = [];
}

public sealed class AuditEvent
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid ActorUserId { get; set; }
    public Guid EntityId { get; set; }
    public required string EntityType { get; set; }
    public required string Action { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public string? CorrelationId { get; set; }
    public string? Reason { get; set; }
}
