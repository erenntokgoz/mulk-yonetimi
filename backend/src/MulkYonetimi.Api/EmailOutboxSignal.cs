using System.Data.Common;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.Api;

// Outbox işleyicisini süreç içinde uyandırır. Kapasite 1: art arda gelen sinyaller tek turda birleşir, hiçbiri kaybolmaz.
public sealed class EmailOutboxSignal
{
    private readonly Channel<byte> channel = Channel.CreateBounded<byte>(new BoundedChannelOptions(1)
    {
        FullMode = BoundedChannelFullMode.DropWrite,
        SingleReader = true
    });

    public void Notify() => channel.Writer.TryWrite(0);

    public async Task<bool> WaitAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        if (channel.Reader.TryRead(out _)) return true;
        if (timeout <= TimeSpan.Zero) return false;
        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutSource.CancelAfter(timeout);
        try
        {
            await channel.Reader.ReadAsync(timeoutSource.Token);
            return true;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return false;
        }
    }
}

// Yeni outbox kaydı ancak commit sonrasında görünür; sinyal bu yüzden açık transaction varsa commit'e ertelenir.
internal sealed class OutboxPendingSignals
{
    private readonly ConditionalWeakTable<DbContext, object> pending = new();

    public void Mark(DbContext context) => pending.AddOrUpdate(context, this);
    public bool Clear(DbContext context) => pending.Remove(context);
}

internal sealed class OutboxSaveChangesSignalInterceptor(OutboxPendingSignals pending, EmailOutboxSignal signal)
    : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        MarkIfOutboxAdded(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
        InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        MarkIfOutboxAdded(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        SignalIfCommitted(eventData.Context);
        return result;
    }

    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result,
        CancellationToken cancellationToken = default)
    {
        SignalIfCommitted(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData) => Forget(eventData.Context);

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        Forget(eventData.Context);
        return Task.CompletedTask;
    }

    private void MarkIfOutboxAdded(DbContext? context)
    {
        if (context is not null && context.ChangeTracker.Entries<OutboxMessage>()
                .Any(entry => entry.State == EntityState.Added))
            pending.Mark(context);
    }

    private void SignalIfCommitted(DbContext? context)
    {
        if (context is null || context.Database.CurrentTransaction is not null) return;
        if (pending.Clear(context)) signal.Notify();
    }

    private void Forget(DbContext? context)
    {
        if (context is not null && context.Database.CurrentTransaction is null) pending.Clear(context);
    }
}

internal sealed class OutboxTransactionSignalInterceptor(OutboxPendingSignals pending, EmailOutboxSignal signal)
    : DbTransactionInterceptor
{
    public override void TransactionCommitted(DbTransaction transaction, TransactionEndEventData eventData) =>
        Committed(eventData.Context);

    public override Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        Committed(eventData.Context);
        return Task.CompletedTask;
    }

    public override void TransactionRolledBack(DbTransaction transaction, TransactionEndEventData eventData) =>
        Forget(eventData.Context);

    public override Task TransactionRolledBackAsync(DbTransaction transaction, TransactionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        Forget(eventData.Context);
        return Task.CompletedTask;
    }

    private void Committed(DbContext? context)
    {
        if (context is not null && pending.Clear(context)) signal.Notify();
    }

    private void Forget(DbContext? context)
    {
        if (context is not null) pending.Clear(context);
    }
}
