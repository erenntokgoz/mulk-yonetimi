using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;
using static MulkYonetimi.Api.PortfolioAccess;

namespace MulkYonetimi.Api;

public sealed record DocumentUploadIntentRequest(Guid? PropertyId, Guid? UnitId, Guid? LeaseId,
    string? OriginalName, string? ContentType, long SizeBytes);
public sealed record DocumentUploadIntentResponse(Guid Id, string UploadUrl, DateTime ExpiresAtUtc,
    string ContentType, IReadOnlyDictionary<string, string> RequiredHeaders);
public sealed record DocumentResponse(Guid Id, Guid? PropertyId, Guid? UnitId, Guid? LeaseId,
    string OriginalName, string ContentType, long SizeBytes, string Status, DateTime CreatedAtUtc,
    DateTime? CompletedAtUtc);
public sealed record DocumentPage(IReadOnlyList<DocumentResponse> Items, int Page, int PageSize, bool HasMore);
public sealed record DocumentDownloadResponse(string DownloadUrl, DateTime ExpiresAtUtc);

internal static class DocumentEndpoints
{
    private static readonly HashSet<string> AllowedContentTypes =
        ["application/pdf", "image/jpeg", "image/png"];

    public static void MapDocumentEndpoints(this WebApplication app)
    {
        var group = app.MapPortfolioGroup("/api/v1/documents");
        group.MapGet("", ListAsync).WithName("ListDocuments").Produces<DocumentPage>()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(403);
        group.MapPost("/upload-intents", CreateUploadIntentAsync).WithName("CreateDocumentUploadIntent")
            .Produces<DocumentUploadIntentResponse>(201).ProducesValidationProblem()
            .ProducesProblem(404).ProducesProblem(503);
        group.MapPost("/{id:guid}/complete", CompleteAsync).WithName("CompleteDocumentUpload")
            .Produces<DocumentResponse>().ProducesValidationProblem().ProducesProblem(404)
            .ProducesProblem(409).ProducesProblem(410).ProducesProblem(422).ProducesProblem(503);
        group.MapGet("/{id:guid}/download-url", GetDownloadUrlAsync).WithName("GetDocumentDownloadUrl")
            .Produces<DocumentDownloadResponse>().ProducesProblem(404).ProducesProblem(503);
        group.MapDelete("/{id:guid}", DeleteAsync).WithName("DeleteDocument")
            .Produces(StatusCodes.Status204NoContent).ProducesProblem(404);
    }

    private static async Task<IResult> ListAsync(ApplicationDbContext db, AccountMembershipResolver memberships,
        ClaimsPrincipal principal, CancellationToken ct, int page = 1, int pageSize = 25,
        Guid? propertyId = null, Guid? unitId = null, Guid? leaseId = null)
    {
        if (ValidatePage(page, pageSize) is { } invalid) return invalid;
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var query = db.Documents.AsNoTracking().Where(item => item.AccountId == accountId && item.Status == "ACTIVE");
        if (propertyId is { } property) query = query.Where(item => item.PropertyId == property);
        if (unitId is { } unit) query = query.Where(item => item.UnitId == unit);
        if (leaseId is { } lease) query = query.Where(item => item.LeaseId == lease);
        var rows = await query.OrderByDescending(item => item.CreatedAtUtc).ThenBy(item => item.Id)
            .Skip((page - 1) * pageSize).Take(pageSize + 1).ToListAsync(ct);
        var hasMore = rows.Count > pageSize;
        if (hasMore) rows.RemoveAt(rows.Count - 1);
        return Results.Ok(new DocumentPage(rows.Select(ToResponse).ToArray(), page, pageSize, hasMore));
    }

    private static async Task<IResult> CreateUploadIntentAsync(DocumentUploadIntentRequest input,
        ClaimsPrincipal principal, AccountMembershipResolver memberships, ApplicationDbContext db,
        DocumentStorageOptions storageOptions, IR2DocumentStorage storage, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        if (input.SizeBytes <= 0 || input.SizeBytes > storageOptions.MaximumFileSizeBytes)
            return Invalid("sizeBytes", $"Dosya boyutu 1 ile {storageOptions.MaximumFileSizeBytes} bayt arasında olmalıdır.");
        var contentType = input.ContentType?.Trim().ToLowerInvariant();
        if (contentType is null || !AllowedContentTypes.Contains(contentType))
            return Invalid("contentType", "Yalnız PDF, JPEG veya PNG dosyası yüklenebilir.");
        var name = CleanFileName(input.OriginalName);
        if (name is null || !ExtensionMatches(name, contentType))
            return Invalid("originalName", "Dosya adı geçerli olmalı ve dosya türüyle eşleşmelidir.");
        var referenceCount = (input.PropertyId is null ? 0 : 1) + (input.UnitId is null ? 0 : 1) +
            (input.LeaseId is null ? 0 : 1);
        if (referenceCount != 1)
            return Invalid("reference", "Tam olarak bir mülk, bağımsız bölüm veya sözleşme seçilmelidir.");
        var allowed = input.PropertyId is { } propertyId
            ? await db.Properties.AnyAsync(item => item.AccountId == accountId && item.Id == propertyId, ct)
            : input.UnitId is { } unitId
                ? await db.Units.AnyAsync(item => item.AccountId == accountId && item.Id == unitId, ct)
                : await db.Leases.AnyAsync(item => item.AccountId == accountId && item.Id == input.LeaseId, ct);
        if (!allowed) return Results.NotFound();
        if (!storageOptions.IsConfigured) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

        var id = Guid.NewGuid();
        var keyPrefix = $"accounts/{accountId:N}/documents/{id:N}/{Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant()}";
        var uploadKey = $"{keyPrefix}/upload";
        var objectKey = $"{keyPrefix}/active";
        var now = DateTime.UtcNow;
        var expires = now.AddSeconds(storageOptions.PutUrlSeconds);
        string uploadUrl;
        try
        {
            uploadUrl = storage.CreateUploadUrl(uploadKey, contentType);
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        var document = new Document
        {
            Id = id,
            AccountId = accountId,
            PropertyId = input.PropertyId,
            UnitId = input.UnitId,
            LeaseId = input.LeaseId,
            UploadObjectKey = uploadKey,
            ObjectKey = objectKey,
            OriginalName = name,
            ContentType = contentType,
            SizeBytes = input.SizeBytes,
            CreatedAtUtc = now,
            UploadExpiresAtUtc = expires
        };
        await using var transaction = await RentRules.LockAccountAsync(db, accountId, ct);
        var reserved = db.Documents.Where(item => item.AccountId == accountId && item.Status != "DELETED");
        var count = await reserved.CountAsync(ct);
        var storedBytes = await reserved.SumAsync(item => (long?)item.SizeBytes, ct) ?? 0L;
        if (count >= storageOptions.MaximumDocumentCountPerAccount ||
            input.SizeBytes > storageOptions.MaximumStorageBytesPerAccount - storedBytes)
            return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Belge kotası doldu.");
        db.Documents.Add(document);
        AddAudit(db, principal, accountId, id, "DOCUMENT", "UPLOAD_INTENDED");
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Created($"/api/v1/documents/{id}", new DocumentUploadIntentResponse(id, uploadUrl,
            expires, contentType, new Dictionary<string, string> { ["Content-Type"] = contentType }));
    }

    private static async Task<IResult> CompleteAsync(Guid id, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, DocumentStorageOptions storageOptions,
        IR2DocumentStorage storage, IDocumentMalwareScanner malwareScanner, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var document = await db.Documents.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        if (document is null || document.Status == "DELETED") return Results.NotFound();
        if (document.Status == "ACTIVE") return Results.Ok(ToResponse(document));
        if (document.UploadExpiresAtUtc <= DateTime.UtcNow)
        {
            document.Status = "DELETED";
            document.DeletedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.StatusCode((int)HttpStatusCode.Gone);
        }
        if (!storageOptions.IsConfigured) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

        try
        {
            var metadata = await storage.GetMetadataAsync(document.UploadObjectKey, ct);
            if (metadata.SizeBytes != document.SizeBytes ||
                !string.Equals(metadata.ContentType?.Split(';', 2)[0].Trim(), document.ContentType,
                    StringComparison.OrdinalIgnoreCase))
                return Invalid("object", "Yüklenen dosya boyutu veya içerik türü istekle eşleşmiyor.");
            var signature = await storage.ReadSignatureAsync(document.UploadObjectKey, ct);
            if (!MatchesSignature(signature, document.ContentType))
                return Invalid("object", "Dosyanın içeriği bildirilen dosya türüyle eşleşmiyor.");
            var scanVerdict = await malwareScanner.ScanAsync(document.UploadObjectKey, ct);
            if (scanVerdict == DocumentScanVerdict.Unavailable)
                return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
            if (scanVerdict != DocumentScanVerdict.Clean)
                return Results.UnprocessableEntity();
            await storage.PromoteAsync(document.UploadObjectKey, document.ObjectKey!, document.ContentType, ct);
            document.Status = "ACTIVE";
            document.CompletedAtUtc = DateTime.UtcNow;
            AddAudit(db, principal, accountId, id, "DOCUMENT", "COMPLETED");
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToResponse(document));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Conflict();
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> GetDownloadUrlAsync(Guid id, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, DocumentStorageOptions storageOptions,
        IR2DocumentStorage storage, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var document = await db.Documents.AsNoTracking().SingleOrDefaultAsync(item =>
            item.AccountId == accountId && item.Id == id && item.Status == "ACTIVE", ct);
        if (document is null) return Results.NotFound();
        if (!storageOptions.IsConfigured) return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        try
        {
            var url = storage.CreateDownloadUrl(document.ObjectKey!, document.OriginalName, document.ContentType);
            AddAudit(db, principal, accountId, id, "DOCUMENT", "DOWNLOAD_URL_ISSUED");
            await db.SaveChangesAsync(ct);
            return Results.Ok(new DocumentDownloadResponse(url,
                DateTime.UtcNow.AddSeconds(storageOptions.GetUrlSeconds)));
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> DeleteAsync(Guid id, ClaimsPrincipal principal,
        AccountMembershipResolver memberships, ApplicationDbContext db, IR2DocumentStorage storage,
        DocumentStorageOptions storageOptions, ILoggerFactory loggerFactory, CancellationToken ct)
    {
        if (await memberships.ResolveAsync(principal, ct) is not { } accountId) return Results.Forbid();
        var document = await db.Documents.SingleOrDefaultAsync(item => item.AccountId == accountId && item.Id == id, ct);
        if (document is null) return Results.NotFound();
        if (document.Status == "DELETED") return Results.NoContent();
        document.Status = "DELETED";
        document.DeletedAtUtc = DateTime.UtcNow;
        AddAudit(db, principal, accountId, id, "DOCUMENT", "SOFT_DELETED");
        await db.SaveChangesAsync(ct);
        if (storageOptions.IsConfigured)
        {
            try
            {
                if (document.ObjectKey is { } objectKey)
                    await storage.DeleteAsync(objectKey, ct);
            }
            catch (Exception) when (!ct.IsCancellationRequested)
            {
                loggerFactory.CreateLogger("DocumentCleanup")
                    .LogWarning("Document cleanup will retry. DocumentId={DocumentId}", id);
            }
        }
        return Results.NoContent();
    }

    internal static async Task DeleteObjectsAsync(IR2DocumentStorage storage, Document document, CancellationToken ct)
    {
        if (document.ObjectKey is { } objectKey) await storage.DeleteAsync(objectKey, ct);
        await storage.DeleteAsync(document.UploadObjectKey, ct);
    }

    internal static bool MatchesSignature(byte[] signature, string contentType) => contentType switch
    {
        "application/pdf" => signature.AsSpan().StartsWith("%PDF-"u8),
        "image/jpeg" => signature.Length >= 3 && signature[0] == 0xff && signature[1] == 0xd8 && signature[2] == 0xff,
        "image/png" => signature.AsSpan().SequenceEqual(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a }),
        _ => false
    };

    private static bool ExtensionMatches(string name, string contentType) => contentType switch
    {
        "application/pdf" => Path.GetExtension(name).Equals(".pdf", StringComparison.OrdinalIgnoreCase),
        "image/jpeg" => Path.GetExtension(name) is { } extension &&
            (extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) || extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase)),
        "image/png" => Path.GetExtension(name).Equals(".png", StringComparison.OrdinalIgnoreCase),
        _ => false
    };

    private static string? CleanFileName(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var name = Path.GetFileName(input.Trim().Replace('\\', '/'));
        return name.Length is > 0 and <= 200 && !name.Any(char.IsControl) ? name : null;
    }

    private static DocumentResponse ToResponse(Document document) => new(document.Id, document.PropertyId,
        document.UnitId, document.LeaseId, document.OriginalName, document.ContentType, document.SizeBytes,
        document.Status, DateTime.SpecifyKind(document.CreatedAtUtc, DateTimeKind.Utc),
        document.CompletedAtUtc is { } completed ? DateTime.SpecifyKind(completed, DateTimeKind.Utc) : null);
}
