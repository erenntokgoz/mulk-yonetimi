using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

public sealed class DocumentCleanupJob(ApplicationDbContext db, IR2DocumentStorage storage,
    DocumentStorageOptions options, ILogger<DocumentCleanupJob> logger)
{
    public async Task RunOnceAsync(DateTime nowUtc, CancellationToken ct)
    {
        if (!options.IsConfigured) return;
        nowUtc = DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc);
        var documents = await db.Documents.Where(item =>
            (item.Status == "PENDING" && item.UploadExpiresAtUtc <= nowUtc) ||
            (item.Status == "ACTIVE" && item.UploadCleanupCompletedAtUtc == null && item.UploadExpiresAtUtc <= nowUtc) ||
            (item.Status == "DELETED" && item.DeleteCleanupCompletedAtUtc == null && item.UploadExpiresAtUtc <= nowUtc))
            .OrderBy(item => item.CreatedAtUtc).Take(100).ToListAsync(ct);

        foreach (var candidate in documents)
        {
            db.ChangeTracker.Clear();
            var document = await db.Documents.SingleOrDefaultAsync(item => item.Id == candidate.Id, ct);
            if (document is null) continue;
            try
            {
                if (document.Status == "PENDING")
                {
                    document.Status = "DELETED";
                    document.DeletedAtUtc = nowUtc;
                    await db.SaveChangesAsync(ct);
                }
                if (document.Status == "ACTIVE")
                {
                    await storage.DeleteAsync(document.UploadObjectKey, ct);
                    document.UploadCleanupCompletedAtUtc = nowUtc;
                }
                else
                {
                    await DocumentEndpoints.DeleteObjectsAsync(storage, document, ct);
                    document.DeleteCleanupCompletedAtUtc = nowUtc;
                }
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                db.ChangeTracker.Clear();
            }
            catch (Exception) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning("Document cleanup will retry. DocumentId={DocumentId}", document.Id);
                db.ChangeTracker.Clear();
            }
        }
    }
}

// Süresi dolan yüklemeler gecikmeyle temizlenebilir; temizlik için veritabanını sık uyandırmaya değmez.
internal sealed class DocumentCleanupWorker(IServiceScopeFactory scopes, DocumentStorageOptions options,
    IConfiguration configuration, ILogger<DocumentCleanupWorker> logger) : BackgroundService
{
    internal static TimeSpan Interval(IConfiguration configuration) =>
        ScheduledJob.Hours(configuration, "Jobs:DocumentCleanupHours", 12, 168);

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.IsConfigured) return Task.CompletedTask;
        return ScheduledJob.RunAsync("Belge temizliği", Interval(configuration), async ct =>
        {
            await using var scope = scopes.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<DocumentCleanupJob>().RunOnceAsync(DateTime.UtcNow, ct);
        }, logger, stoppingToken);
    }
}
