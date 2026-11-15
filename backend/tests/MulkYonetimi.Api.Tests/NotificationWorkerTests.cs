using MulkYonetimi.Api;

namespace MulkYonetimi.Api.Tests;

public sealed class NotificationWorkerTests
{
    [Fact]
    public void RunsFrequentlyEnoughToPickUpNewRentCharges()
    {
        Assert.Equal(TimeSpan.FromMinutes(15), NotificationWorker.Interval);
    }
}
