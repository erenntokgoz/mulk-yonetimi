using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using MulkYonetimi.Api;

namespace MulkYonetimi.Api.Tests;

public sealed class EmailOutboxWorkerTests
{
    private static readonly DateTime Now = new(2026, 11, 16, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Enqueue_signal_sends_immediately_without_waiting_for_the_sweep()
    {
        var dispatcher = new FakeDispatcher();
        var signal = new EmailOutboxSignal();
        using var worker = Worker(dispatcher, signal);
        await worker.StartAsync(CancellationToken.None);
        await dispatcher.WaitForCallsAsync(1);

        var watch = Stopwatch.StartNew();
        signal.Notify();
        await dispatcher.WaitForCallsAsync(2);
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(5));
        await worker.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task Idle_worker_does_not_poll_the_database()
    {
        var dispatcher = new FakeDispatcher();
        using var worker = Worker(dispatcher, new EmailOutboxSignal());
        await worker.StartAsync(CancellationToken.None);
        await dispatcher.WaitForCallsAsync(1);
        await Task.Delay(TimeSpan.FromSeconds(1));
        await worker.StopAsync(CancellationToken.None);
        Assert.Equal(1, dispatcher.DispatchCalls);
        Assert.Equal(1, dispatcher.NextAttemptCalls);
    }

    [Fact]
    public async Task Full_batches_are_drained_in_one_wake()
    {
        var dispatcher = new FakeDispatcher(EmailOutboxDispatcher.BatchSize, EmailOutboxDispatcher.BatchSize, 3);
        using var worker = Worker(dispatcher, new EmailOutboxSignal());
        await worker.StartAsync(CancellationToken.None);
        await dispatcher.WaitForCallsAsync(3);
        await Task.Delay(TimeSpan.FromMilliseconds(300));
        await worker.StopAsync(CancellationToken.None);
        Assert.Equal(3, dispatcher.DispatchCalls);
        Assert.Equal(1, dispatcher.NextAttemptCalls);
    }

    [Fact]
    public async Task Signals_coalesce_and_none_are_lost()
    {
        var signal = new EmailOutboxSignal();
        signal.Notify();
        signal.Notify();
        Assert.True(await signal.WaitAsync(TimeSpan.Zero, CancellationToken.None));
        Assert.False(await signal.WaitAsync(TimeSpan.FromMilliseconds(50), CancellationToken.None));
        var waiting = signal.WaitAsync(TimeSpan.FromMinutes(1), CancellationToken.None);
        signal.Notify();
        Assert.True(await waiting.WaitAsync(TimeSpan.FromSeconds(5)));
    }

    [Fact]
    public void Sweep_defaults_to_six_hours_and_is_configurable()
    {
        Assert.Equal(TimeSpan.FromMinutes(360), EmailOutboxWorker.SweepInterval(Configuration()));
        Assert.Equal(TimeSpan.FromMinutes(90),
            EmailOutboxWorker.SweepInterval(Configuration(("Jobs:OutboxSweepMinutes", "90"))));
        Assert.Equal(TimeSpan.FromMinutes(5),
            EmailOutboxWorker.SweepInterval(Configuration(("Jobs:OutboxSweepMinutes", "1"))));
    }

    [Fact]
    public void Without_pending_work_the_worker_sleeps_until_the_sweep()
    {
        Assert.Equal(TimeSpan.FromHours(6), EmailOutboxWorker.NextDelay(Now, Now.AddHours(6), null));
    }

    [Fact]
    public void Retry_due_before_the_sweep_wakes_the_worker_at_its_time()
    {
        Assert.Equal(TimeSpan.FromMinutes(16),
            EmailOutboxWorker.NextDelay(Now, Now.AddHours(6), Now.AddMinutes(16)));
    }

    [Fact]
    public void Retry_wakes_are_never_closer_than_five_minutes()
    {
        Assert.Equal(EmailOutboxWorker.MinimumRetryGap,
            EmailOutboxWorker.NextDelay(Now, Now.AddHours(6), Now.AddMinutes(1)));
        Assert.Equal(EmailOutboxWorker.MinimumRetryGap,
            EmailOutboxWorker.NextDelay(Now, Now.AddHours(6), Now.AddMinutes(-30)));
    }

    [Fact]
    public void Retry_after_the_sweep_waits_for_the_sweep()
    {
        Assert.Equal(TimeSpan.FromMinutes(20),
            EmailOutboxWorker.NextDelay(Now, Now.AddMinutes(20), Now.AddMinutes(40)));
        Assert.Equal(TimeSpan.FromMinutes(2),
            EmailOutboxWorker.NextDelay(Now, Now.AddMinutes(2), Now.AddMinutes(1)));
        Assert.Equal(TimeSpan.Zero, EmailOutboxWorker.NextDelay(Now, Now.AddMinutes(-1), null));
    }

    private static EmailOutboxWorker Worker(FakeDispatcher dispatcher, EmailOutboxSignal signal)
    {
        var services = new ServiceCollection().AddScoped<IEmailOutboxDispatcher>(_ => dispatcher)
            .BuildServiceProvider();
        return new EmailOutboxWorker(services.GetRequiredService<IServiceScopeFactory>(), signal, Configuration(),
            NullLogger<EmailOutboxWorker>.Instance);
    }

    private static IConfiguration Configuration(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(item =>
            new KeyValuePair<string, string?>(item.Key, item.Value))).Build();

    private sealed class FakeDispatcher(params int[] batches) : IEmailOutboxDispatcher
    {
        private readonly ConcurrentQueue<int> results = new(batches);
        private int dispatchCalls;
        private int nextAttemptCalls;

        public int DispatchCalls => Volatile.Read(ref dispatchCalls);
        public int NextAttemptCalls => Volatile.Read(ref nextAttemptCalls);

        public Task<int> DispatchOnceAsync(CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref dispatchCalls);
            return Task.FromResult(results.TryDequeue(out var processed) ? processed : 0);
        }

        public Task<DateTime?> NextAttemptAtUtcAsync(CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref nextAttemptCalls);
            return Task.FromResult<DateTime?>(null);
        }

        public async Task WaitForCallsAsync(int count)
        {
            var deadline = DateTime.UtcNow.AddSeconds(10);
            while (DispatchCalls < count)
            {
                Assert.True(DateTime.UtcNow < deadline, $"Dispatcher was called {DispatchCalls} times, expected {count}.");
                await Task.Delay(10);
            }
        }
    }
}
