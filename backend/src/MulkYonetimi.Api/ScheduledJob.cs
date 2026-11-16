namespace MulkYonetimi.Api;

// Arka plan işleri Azure SQL serverless veritabanını uyanık tutmamak için seyrek çalışır (ADR 013).
internal static class ScheduledJob
{
    internal static readonly TimeSpan FirstRetryDelay = TimeSpan.FromMinutes(5);

    // Kira ve bildirim işleri için üst sınır 24 saattir: sabit tempolu ≤24 saatlik çalışma, her İstanbul
    // takvim gününe en az bir tur düşürür; yalnız gününde tetiklenen yıl dönümü bildirimi atlanmaz.
    public static TimeSpan Hours(IConfiguration configuration, string key, double defaultHours, double maximumHours)
    {
        var hours = configuration.GetValue(key, defaultHours);
        if (double.IsNaN(hours)) hours = defaultHours;
        return TimeSpan.FromHours(Math.Clamp(hours, 1, maximumHours));
    }

    // Başarısız tur hemen yeniden sorgu atmaz; 5 dakikadan başlayıp normal aralığa kadar katlanarak bekler.
    public static TimeSpan RetryDelay(int consecutiveFailures, TimeSpan interval)
    {
        var exponent = Math.Clamp(consecutiveFailures - 1, 0, 10);
        var delay = FirstRetryDelay * (1 << exponent);
        return delay < interval ? delay : interval;
    }

    // Aralık turun başlangıcından ölçülür; iş süresi takvimi kaydırmaz.
    public static TimeSpan NextDelay(DateTime startedUtc, DateTime nowUtc, TimeSpan interval, int consecutiveFailures)
    {
        if (consecutiveFailures > 0) return RetryDelay(consecutiveFailures, interval);
        var delay = startedUtc + interval - nowUtc;
        return delay < TimeSpan.Zero ? TimeSpan.Zero : delay;
    }

    public static async Task RunAsync(string jobName, TimeSpan interval, Func<CancellationToken, Task> run,
        ILogger logger, CancellationToken stoppingToken)
    {
        var failures = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            var startedUtc = DateTime.UtcNow;
            try
            {
                await run(stoppingToken);
                failures = 0;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception)
            {
                failures++;
            }

            var delay = NextDelay(startedUtc, DateTime.UtcNow, interval, failures);
            if (failures > 0)
                logger.LogWarning("{JobName} başarısız oldu; {RetryMinutes} dakika sonra yeniden denenecek.",
                    jobName, (int)delay.TotalMinutes);
            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }
}
