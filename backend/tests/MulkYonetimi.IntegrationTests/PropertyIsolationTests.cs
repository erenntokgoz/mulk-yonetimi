using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MulkYonetimi.Api;
using MulkYonetimi.Infrastructure;

namespace MulkYonetimi.IntegrationTests;

public sealed class PropertyIsolationTests
{
    private const string Properties = "/api/v1/properties";
    private const string Origin = "https://app.example.test";
    private const string Password = "Portfolio-Test-123!";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters =
        {
            new JsonStringEnumConverter<PropertyKind>(allowIntegerValues: false),
            new JsonStringEnumConverter<UnitUsageType>(allowIntegerValues: false),
            new JsonStringEnumConverter<TenantKind>(allowIntegerValues: false),
            new JsonStringEnumConverter<LeaseStatus>(allowIntegerValues: false),
            new JsonStringEnumConverter<PaymentMethod>(allowIntegerValues: false),
            new JsonStringEnumConverter<DepositCustody>(allowIntegerValues: false),
            new JsonStringEnumConverter<DepositMovementType>(allowIntegerValues: false),
            new JsonStringEnumConverter<ExpenseCategory>(allowIntegerValues: false)
        }
    };

    [Fact]
    public async Task Portfolio_endpoints_isolate_two_accounts_and_preserve_changes_in_sql_server()
    {
        var admin = Environment.GetEnvironmentVariable("MULK_SQL_TEST_ADMIN_CONNECTION")
            ?? throw new InvalidOperationException("MULK_SQL_TEST_ADMIN_CONNECTION is required for integration tests.");
        var connection = new SqlConnectionStringBuilder(admin)
        {
            InitialCatalog = $"MulkPortfolioTest_{Guid.NewGuid():N}"
        }.ConnectionString;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        await using var db = new ApplicationDbContext(options);

        try
        {
            await db.Database.MigrateAsync();
            var (accountA, userA) = AddOwner(db, "a");
            var (accountB, userB) = AddOwner(db, "b");
            await db.SaveChangesAsync();

            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
            {
                host.UseSetting("ConnectionStrings:DefaultConnection", connection);
                host.UseSetting("Auth:FrontendOrigin", Origin);
                host.UseSetting("Email:WorkerEnabled", "false");
            });
            using var clientA = await SignInAsync(factory, userA);
            using var clientB = await SignInAsync(factory, userB);

            var propertyA = await CreateAsync(clientA, new
            {
                name = " Müstakil ev ",
                address = " Ankara ",
                propertyKind = "SINGLE_UNIT",
                defaultUnitUsageType = "RESIDENTIAL",
                accountId = accountB.Id
            });
            var propertyB = await CreateAsync(clientB, new
            {
                name = "İş merkezi",
                address = "İstanbul",
                propertyKind = "MULTI_UNIT",
                accountId = accountA.Id
            });
            Assert.Equal("Müstakil ev", propertyA.Name);
            Assert.Equal("Ankara", propertyA.Address);
            Assert.Equal(8, propertyA.Version.Length);
            Assert.Equal(propertyA.Id, Assert.Single((await ListAsync(clientA)).Items).Id);
            Assert.Equal(propertyB.Id, Assert.Single((await ListAsync(clientB)).Items).Id);
            Assert.Equal(propertyA.Id, (await clientA.GetFromJsonAsync<PropertyResponse>(
                $"{Properties}/{propertyA.Id}", Json))!.Id);
            await AssertForeignPropertyHiddenAsync(clientA, propertyB);
            await AssertForeignPropertyHiddenAsync(clientB, propertyA);

            using var invalid = await clientA.PostAsJsonAsync(Properties,
                new { name = " ", address = "Ankara", propertyKind = "SINGLE_UNIT" });
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            clientA.DefaultRequestHeaders.Remove("Origin");
            using var missingOrigin = await clientA.PostAsJsonAsync(Properties,
                new { name = "Geçersiz", address = "Ankara", propertyKind = "MULTI_UNIT" });
            Assert.Equal(HttpStatusCode.Forbidden, missingOrigin.StatusCode);
            clientA.DefaultRequestHeaders.Add("Origin", Origin);

            var secondPropertyA = await CreateAsync(clientA,
                new { name = "Zemin kat", address = "Ankara", propertyKind = "MULTI_UNIT" });
            var firstPage = await ListAsync(clientA, "?pageSize=1");
            var secondPage = await ListAsync(clientA, "?pageSize=1&page=2");
            Assert.True(firstPage.HasMore);
            Assert.False(secondPage.HasMore);
            Assert.Equal(propertyA.Id, Assert.Single(firstPage.Items).Id);
            Assert.Equal(secondPropertyA.Id, Assert.Single(secondPage.Items).Id);

            var path = $"{Properties}/{propertyA.Id}";
            var updates = await Task.WhenAll(
                clientA.PatchAsJsonAsync(path, new { name = "Ev A", address = "Ankara", propertyA.Version }),
                clientA.PatchAsJsonAsync(path, new { name = "Ev B", address = "Ankara", propertyA.Version }));
            using var update = Assert.Single(updates, response => response.StatusCode == HttpStatusCode.OK);
            using var conflict = Assert.Single(updates, response => response.StatusCode == HttpStatusCode.Conflict);
            var updated = (await update.Content.ReadFromJsonAsync<PropertyResponse>(Json))!;
            Assert.False(propertyA.Version.SequenceEqual(updated.Version));

            using var staleArchive = await clientA.PostAsJsonAsync(path + "/archive", new { propertyA.Version });
            Assert.Equal(HttpStatusCode.Conflict, staleArchive.StatusCode);
            using var archive = await clientA.PostAsJsonAsync(path + "/archive", new { updated.Version });
            Assert.Equal(HttpStatusCode.NoContent, archive.StatusCode);
            using var retry = await clientA.PostAsJsonAsync(path + "/archive", new { updated.Version });
            Assert.Equal(HttpStatusCode.NoContent, retry.StatusCode);
            Assert.Equal(secondPropertyA.Id, Assert.Single((await ListAsync(clientA)).Items).Id);
            var archived = Assert.Single((await ListAsync(clientA, "?includeArchived=true")).Items,
                item => item.Id == propertyA.Id);
            Assert.Equal(DateTimeKind.Utc, archived.ArchivedAtUtc!.Value.Kind);
            using var editArchived = await clientA.PatchAsJsonAsync(path,
                new { name = "Ev", address = "Ankara", archived.Version });
            Assert.Equal(HttpStatusCode.Conflict, editArchived.StatusCode);

            var unit = await db.Units.AsNoTracking().SingleAsync();
            Assert.Equal(accountA.Id, unit.AccountId);
            Assert.Equal(propertyA.Id, unit.PropertyId);
            Assert.True(unit.IsDefault);
            Assert.Equal(UnitUsageType.RESIDENTIAL, unit.UsageType);
            var audits = await db.AuditEvents.AsNoTracking().Where(item => item.EntityId == propertyA.Id)
                .OrderBy(item => item.Action).ToArrayAsync();
            Assert.Equal(new[] { "ARCHIVED", "CREATED", "UPDATED" }, audits.Select(item => item.Action));
            Assert.All(audits, item =>
            {
                Assert.Equal(accountA.Id, item.AccountId);
                Assert.Equal(userA.Id, item.ActorUserId);
            });

            db.Units.Add(new Unit
            {
                Id = Guid.NewGuid(),
                AccountId = accountB.Id,
                PropertyId = propertyA.Id,
                Label = "Başka hesap",
                UsageType = UnitUsageType.COMMERCIAL
            });
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            db.ChangeTracker.Clear();
            db.Units.Add(new Unit
            {
                Id = Guid.NewGuid(),
                AccountId = accountA.Id,
                PropertyId = propertyA.Id,
                Label = "İkinci varsayılan",
                UsageType = UnitUsageType.RESIDENTIAL,
                IsDefault = true
            });
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            db.ChangeTracker.Clear();
            await VerifyUnitsAsync(clientA, clientB, propertyA, secondPropertyA, propertyB);
            await VerifyLeasesAsync(clientA, clientB, secondPropertyA.Id, options);
            var auditedReasons = await db.AuditEvents.AsNoTracking().Where(item => item.AccountId == accountA.Id &&
                (item.Action == "VOIDED" || item.Action == "CORRECTED" || item.Action == "RATE_ADDED"))
                .ToArrayAsync();
            Assert.NotEmpty(auditedReasons);
            Assert.All(auditedReasons, item =>
            {
                Assert.False(string.IsNullOrWhiteSpace(item.Reason));
                Assert.False(string.IsNullOrWhiteSpace(item.CorrelationId));
            });
            await VerifyTenantsAsync(clientA, clientB, accountA.Id, accountB.Id, db);
        }
        finally
        {
            await db.Database.EnsureDeletedAsync();
        }
    }

    private static async Task VerifyLeasesAsync(HttpClient clientA, HttpClient clientB, Guid propertyId,
        DbContextOptions<ApplicationDbContext> options)
    {
        const string leases = "/api/v1/leases";
        var unit = Assert.Single((await clientA.GetFromJsonAsync<UnitPage>($"{Properties}/{propertyId}/units", Json))!.Items);
        using var personResponse = await clientA.PostAsJsonAsync("/api/v1/tenants",
            new { kind = "PERSON", firstName = "Kira", lastName = "Test" });
        Assert.Equal(HttpStatusCode.Created, personResponse.StatusCode);
        var person = (await personResponse.Content.ReadFromJsonAsync<TenantResponse>(Json))!;
        var input = new
        {
            unitId = unit.Id,
            tenantId = person.Id,
            startDate = new DateOnly(2026, 1, 1),
            plannedEndDate = new DateOnly(2026, 1, 15),
            dueDay = 31,
            monthlyAmount = 20000m,
            depositAmount = 40000m
        };
        using var foreignCreate = await clientB.PostAsJsonAsync(leases, input);
        Assert.Equal(HttpStatusCode.NotFound, foreignCreate.StatusCode);
        using var create = await clientA.PostAsJsonAsync(leases, input);
        using var duplicateDraft = await clientA.PostAsJsonAsync(leases, input);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        Assert.Equal(HttpStatusCode.Created, duplicateDraft.StatusCode);
        var draft = (await create.Content.ReadFromJsonAsync<LeaseResponse>(Json))!;
        var other = (await duplicateDraft.Content.ReadFromJsonAsync<LeaseResponse>(Json))!;
        var foreign = $"{leases}/{draft.Id}";
        var rate = new
        {
            effectiveFrom = new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).AddMonths(1),
            monthlyAmount = 25000m,
            reason = "Yenileme"
        };
        using var foreignDetail = await clientB.GetAsync(foreign);
        using var foreignActivate = await clientB.PostAsJsonAsync(foreign + "/activate", new { draft.Version });
        using var foreignTerminate = await clientB.PostAsJsonAsync(foreign + "/terminate",
            new { draft.Version, terminationDate = input.startDate, reason = "Çıkış" });
        using var foreignRates = await clientB.GetAsync(foreign + "/rates");
        using var foreignAddRate = await clientB.PostAsJsonAsync(foreign + "/rates", rate);
        Assert.All(new[] { foreignDetail, foreignActivate, foreignTerminate, foreignRates, foreignAddRate },
            response => Assert.Equal(HttpStatusCode.NotFound, response.StatusCode));
        Assert.Empty((await clientB.GetFromJsonAsync<LeasePage>(leases, Json))!.Items);
        var activations = await Task.WhenAll(
            clientA.PostAsJsonAsync(foreign + "/activate", new { draft.Version }),
            clientA.PostAsJsonAsync($"{leases}/{other.Id}/activate", new { other.Version }));
        using var activation = Assert.Single(activations, response => response.StatusCode == HttpStatusCode.OK);
        using var conflict = Assert.Single(activations, response => response.StatusCode == HttpStatusCode.Conflict);
        var active = (await activation.Content.ReadFromJsonAsync<LeaseResponse>(Json))!;
        var activePath = $"{leases}/{active.Id}";
        var unitArchivePath = $"{Properties}/{propertyId}/units/{unit.Id}/archive";
        using var foreignUnitArchive = await clientB.PostAsync(unitArchivePath, null);
        Assert.Equal(HttpStatusCode.NotFound, foreignUnitArchive.StatusCode);
        using var occupiedUnitArchive = await clientA.PostAsync(unitArchivePath, null);
        Assert.Equal(HttpStatusCode.Conflict, occupiedUnitArchive.StatusCode);
        using var rateAdded = await clientA.PostAsJsonAsync(activePath + "/rates", rate);
        Assert.Equal(HttpStatusCode.Created, rateAdded.StatusCode);
        var rates = (await clientA.GetFromJsonAsync<LeaseRateResponse[]>(activePath + "/rates", Json))!;
        Assert.Equal(new[] { 20000m, 25000m }, rates.Select(item => item.MonthlyAmount));
        var renewalDate = new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).AddMonths(2);
        var renewal = new { active.Version, newEndDate = new DateOnly(2028, 12, 31),
            effectiveFrom = renewalDate, monthlyAmount = 27000m, reason = "Ek protokol" };
        using var foreignRenew = await clientB.PostAsJsonAsync(activePath + "/renewals", renewal);
        Assert.Equal(HttpStatusCode.NotFound, foreignRenew.StatusCode);
        var renewals = await Task.WhenAll(
            clientA.PostAsJsonAsync(activePath + "/renewals", renewal),
            clientA.PostAsJsonAsync(activePath + "/renewals", renewal));
        using var renewed = Assert.Single(renewals, response => response.StatusCode == HttpStatusCode.Created);
        using var renewalConflict = Assert.Single(renewals, response => response.StatusCode == HttpStatusCode.Conflict);
        var renewalHistory = Assert.Single((await clientA.GetFromJsonAsync<LeaseRenewalResponse[]>(
            activePath + "/renewals", Json))!);
        Assert.Equal(input.plannedEndDate, renewalHistory.PreviousEndDate);
        Assert.Equal(renewal.newEndDate, renewalHistory.NewEndDate);
        Assert.Equal(new[] { 20000m, 25000m, 27000m },
            (await clientA.GetFromJsonAsync<LeaseRateResponse[]>(activePath + "/rates", Json))!
                .Select(item => item.MonthlyAmount));
        var february = new DateOnly(2026, 2, 1);
        await Task.WhenAll(Enumerable.Range(0, 3).Select(async _ =>
        {
            await using var context = new ApplicationDbContext(options);
            await new RentChargeJob(context).GenerateAsync(february, CancellationToken.None);
        }));
        await VerifyPaymentsAsync(clientA, clientB, active);
        await VerifyOperatingLedgerAsync(clientA, clientB, active, propertyId);
        var currentLease = (await clientA.GetFromJsonAsync<LeaseResponse>(activePath, Json))!;
        using var terminated = await clientA.PostAsJsonAsync(activePath + "/terminate",
            new { currentLease.Version, terminationDate = new DateOnly(2026, 2, 1), reason = "Çıkış" });
        Assert.Equal(HttpStatusCode.OK, terminated.StatusCode);
        using var unitArchive = await clientA.PostAsync(unitArchivePath, null);
        Assert.Equal(HttpStatusCode.NoContent, unitArchive.StatusCode);
        Assert.Empty((await clientA.GetFromJsonAsync<UnitPage>($"{Properties}/{propertyId}/units", Json))!.Items);
        var historical = Assert.Single((await clientA.GetFromJsonAsync<UnitPage>(
            $"{Properties}/{propertyId}/units?includeArchived=true", Json))!.Items);
        Assert.Equal(DateTimeKind.Utc, historical.ArchivedAtUtc!.Value.Kind);
        Assert.Equal(12000m, (await clientA.GetFromJsonAsync<CashFlowResponse>(
            "/api/v1/reports/cashflow?fromDate=2026-02-01&toDate=2026-02-28&unitId=" + unit.Id, Json))!.NetOperatingCashFlow);
        var remaining = active.Id == draft.Id ? other : draft;
        using var overlapping = await clientA.PostAsJsonAsync($"{leases}/{remaining.Id}/activate", new { remaining.Version });
        Assert.Equal(HttpStatusCode.Conflict, overlapping.StatusCode);
        using var archive = await clientA.PostAsJsonAsync($"/api/v1/tenants/{person.Id}/archive", new { person.Version });
        Assert.Equal(HttpStatusCode.NoContent, archive.StatusCode);
    }

    private static async Task VerifyOperatingLedgerAsync(HttpClient owner, HttpClient foreign, LeaseResponse lease, Guid propertyId)
    {
        const string deposits = "/api/v1/deposits";
        const string expenses = "/api/v1/expenses";
        const string month = "2026-02-01";
        const string cashPath = "/api/v1/reports/cashflow?fromDate=2026-02-01&toDate=2026-02-28";
        var depositInput = new { leaseId = lease.Id, custodyType = "BANK_BLOCKED" };
        using var deniedDeposit = await foreign.PostAsJsonAsync(deposits, depositInput);
        Assert.Equal(HttpStatusCode.NotFound, deniedDeposit.StatusCode);
        using var created = await owner.PostAsJsonAsync(deposits, depositInput);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var deposit = (await created.Content.ReadFromJsonAsync<DepositResponse>(Json))!;
        Assert.Equal(40000m, deposit.AmountAgreed);
        var movements = $"{deposits}/{deposit.Id}/movements";
        var hold = new { movementOn = month, movementType = "HELD", amount = 40000m };
        using var deniedList = await foreign.GetAsync(movements);
        using var deniedMove = await PostWithKeyAsync(foreign, movements, hold, "hold");
        Assert.Equal(HttpStatusCode.NotFound, deniedList.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, deniedMove.StatusCode);
        using var held = await PostWithKeyAsync(owner, movements, hold, "hold");
        using var heldRetry = await PostWithKeyAsync(owner, movements, hold, "hold");
        Assert.Equal(HttpStatusCode.Created, held.StatusCode);
        Assert.Equal(HttpStatusCode.OK, heldRetry.StatusCode);
        var refund = new { movementOn = "2026-02-05", movementType = "RETURNED", amount = 25000m };
        var refunds = await Task.WhenAll(PostWithKeyAsync(owner, movements, refund, "return-one"),
            PostWithKeyAsync(owner, movements, refund, "return-two"));
        using var returned = Assert.Single(refunds, response => response.StatusCode == HttpStatusCode.Created);
        using var blocked = Assert.Single(refunds, response => response.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(15000m, Assert.Single((await owner.GetFromJsonAsync<DepositPage>(deposits, Json))!.Items).Balance);
        Assert.Equal(2, (await owner.GetFromJsonAsync<DepositMovementPage>(movements, Json))!.Items.Length);
        Assert.Empty((await foreign.GetFromJsonAsync<DepositPage>(deposits, Json))!.Items);

        var paid = new
        {
            propertyId,
            unitId = lease.UnitId,
            category = "MAINTENANCE",
            amount = 1000m,
            expenseOn = "2026-01-28",
            paidOn = "2026-02-10"
        };
        using var deniedExpense = await PostWithKeyAsync(foreign, expenses, paid, "paid");
        Assert.Equal(HttpStatusCode.NotFound, deniedExpense.StatusCode);
        using var expense = await PostWithKeyAsync(owner, expenses, paid, "paid");
        using var replay = await PostWithKeyAsync(owner, expenses, paid, "paid");
        Assert.Equal(HttpStatusCode.Created, expense.StatusCode);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        var paidExpense = (await expense.Content.ReadFromJsonAsync<ExpenseResponse>(Json))!;
        using var unpaid = await PostWithKeyAsync(owner, expenses,
            new { propertyId, category = "TAX", amount = 2000m, expenseOn = month }, "unpaid");
        Assert.Equal(HttpStatusCode.Created, unpaid.StatusCode);
        Assert.Single((await owner.GetFromJsonAsync<ExpensePage>(
            expenses + "?category=TAX&fromDate=2026-02-01&toDate=2026-02-28", Json))!.Items);
        Assert.Empty((await foreign.GetFromJsonAsync<ExpensePage>(expenses, Json))!.Items);
        var voidPath = $"{expenses}/{paidExpense.Id}/void";
        using var deniedVoid = await foreign.PostAsJsonAsync(voidPath, new { reason = "Yetkisiz" });
        Assert.Equal(HttpStatusCode.NotFound, deniedVoid.StatusCode);

        var dashboardPath = "/api/v1/dashboard/summary?periodStart=" + month;
        var dashboard = (await owner.GetFromJsonAsync<DashboardSummary>(dashboardPath, Json))!;
        Assert.Equal(1, dashboard.TotalUnits);
        Assert.Equal(1, dashboard.OccupiedUnits);
        Assert.Equal(20000m, dashboard.PeriodCharges);
        Assert.Equal(12000m, dashboard.PeriodUnpaid);
        Assert.Equal(29000m, dashboard.OverdueBalance);
        Assert.Equal(2000m, dashboard.RecordedExpenses);
        var cash = (await owner.GetFromJsonAsync<CashFlowResponse>(cashPath, Json))!;
        using var cashCsv = await owner.GetAsync(cashPath.Replace("/cashflow?", "/cashflow.csv?"));
        Assert.Equal(HttpStatusCode.OK, cashCsv.StatusCode);
        Assert.Contains("13000.00", await cashCsv.Content.ReadAsStringAsync());
        using var foreignCsv = await foreign.GetAsync(cashPath.Replace("/cashflow?", "/cashflow.csv?") +
            "&propertyId=" + propertyId);
        Assert.Equal(HttpStatusCode.NotFound, foreignCsv.StatusCode);
        using var paymentCsv = await owner.GetAsync("/api/v1/reports/payments.csv?fromDate=2026-02-01&toDate=2026-02-28&propertyId=" + propertyId);
        Assert.Equal(HttpStatusCode.OK, paymentCsv.StatusCode);
        Assert.Contains("paidOn", await paymentCsv.Content.ReadAsStringAsync());
        Assert.Equal(13000m, cash.CashIn);
        Assert.Equal(8000m, cash.Allocated);
        Assert.Equal(5000m, cash.Unallocated);
        Assert.Equal(1000m, cash.CashOut);
        Assert.Equal(12000m, cash.NetOperatingCashFlow);
        var scoped = (await owner.GetFromJsonAsync<CashFlowResponse>(cashPath + "&unitId=" + lease.UnitId, Json))!;
        Assert.Equal(8000m, scoped.CashIn);
        Assert.Equal(1000m, scoped.CashOut);
        Assert.Null(scoped.Unallocated);
        using var deniedCash = await foreign.GetAsync(cashPath + "&unitId=" + lease.UnitId);
        using var deniedSummary = await foreign.GetAsync(dashboardPath + "&propertyId=" + propertyId);
        Assert.Equal(HttpStatusCode.NotFound, deniedCash.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, deniedSummary.StatusCode);
        Assert.Equal(0, (await foreign.GetFromJsonAsync<DashboardSummary>(dashboardPath, Json))!.PeriodCharges);
        Assert.Equal(0, (await foreign.GetFromJsonAsync<CashFlowResponse>(cashPath, Json))!.CashIn);

        using var voided = await owner.PostAsJsonAsync(voidPath, new { reason = "Yanlış kayıt" });
        Assert.Equal(HttpStatusCode.OK, voided.StatusCode);
        Assert.Equal(0, (await owner.GetFromJsonAsync<CashFlowResponse>(cashPath, Json))!.CashOut);
        Assert.Single((await owner.GetFromJsonAsync<ExpensePage>(expenses, Json))!.Items);
        Assert.Equal(2, (await owner.GetFromJsonAsync<ExpensePage>(expenses + "?includeVoided=true", Json))!.Items.Length);
    }

    private static async Task VerifyPaymentsAsync(HttpClient clientA, HttpClient clientB, LeaseResponse lease)
    {
        const string payments = "/api/v1/payments";
        const string charges = "/api/v1/rent-charges";
        var rows = (await clientA.GetFromJsonAsync<RentChargePage>(charges, Json))!.Items;
        Assert.Equal(2, rows.Length);
        Assert.Equal(new DateOnly(2026, 2, 28), rows[0].DueDate);
        Assert.Empty((await clientB.GetFromJsonAsync<RentChargePage>(charges + "?leaseId=" + lease.Id, Json))!.Items);
        var charge = rows[0];
        var input = new { tenantId = lease.TenantId, paidOn = new DateOnly(2026, 2, 5), amount = 12000m, method = "TRANSFER" };
        using var foreignCreate = await PostWithKeyAsync(clientB, payments, input, "same-key");
        Assert.Equal(HttpStatusCode.NotFound, foreignCreate.StatusCode);
        var creates = await Task.WhenAll(PostWithKeyAsync(clientA, payments, input, "same-key"),
            PostWithKeyAsync(clientA, payments, input, "same-key"));
        using var created = Assert.Single(creates, response => response.StatusCode == HttpStatusCode.Created);
        using var retried = Assert.Single(creates, response => response.StatusCode == HttpStatusCode.OK);
        var payment = (await created.Content.ReadFromJsonAsync<PaymentResponse>(Json))!;
        Assert.Equal(payment.Id, (await retried.Content.ReadFromJsonAsync<PaymentResponse>(Json))!.Id);
        var path = $"{payments}/{payment.Id}";
        var allocationPath = path + "/allocations";
        var allocation = new { rentChargeId = charge.Id, amount = 12000m };
        using var foreignRead = await clientB.GetAsync(path);
        using var foreignAllocate = await PostWithKeyAsync(clientB, allocationPath, allocation, "foreign");
        using var foreignVoid = await clientB.PostAsJsonAsync(path + "/void", new { reason = "Yetkisiz" });
        Assert.All(new[] { foreignRead, foreignAllocate, foreignVoid },
            response => Assert.Equal(HttpStatusCode.NotFound, response.StatusCode));
        Assert.Empty((await clientB.GetFromJsonAsync<PaymentPage>(payments, Json))!.Items);

        using var allocated = await PostWithKeyAsync(clientA, allocationPath, allocation, "partial");
        using var replay = await PostWithKeyAsync(clientA, allocationPath, allocation, "partial");
        Assert.Equal(HttpStatusCode.Created, allocated.StatusCode);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        var partial = (await clientA.GetFromJsonAsync<RentChargePage>(charges, Json))!.Items[0];
        Assert.Equal(8000m, partial.Balance);
        Assert.Equal("PARTIAL", partial.Status);

        using var excessResponse = await PostWithKeyAsync(clientA, payments,
            new { input.tenantId, input.paidOn, amount = 13000m, input.method }, "excess");
        Assert.Equal(HttpStatusCode.Created, excessResponse.StatusCode);
        var excess = (await excessResponse.Content.ReadFromJsonAsync<PaymentResponse>(Json))!;
        var excessPath = $"{payments}/{excess.Id}";
        var settle = new { rentChargeId = charge.Id, amount = 8000m };
        var allocations = await Task.WhenAll(PostWithKeyAsync(clientA, excessPath + "/allocations", settle, "settle-a"),
            PostWithKeyAsync(clientA, excessPath + "/allocations", settle, "settle-b"));
        using var winner = Assert.Single(allocations, response => response.StatusCode == HttpStatusCode.Created);
        using var loser = Assert.Single(allocations, response => response.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(5000m, (await clientA.GetFromJsonAsync<PaymentResponse>(excessPath, Json))!.UnallocatedAmount);
        Assert.Equal("PAID", (await clientA.GetFromJsonAsync<RentChargePage>(charges, Json))!.Items[0].Status);
        var correction = new { amount = 17000m, reason = "Kısmi ay" };
        using var blockedCorrection = await PostWithKeyAsync(clientA, $"{charges}/{charge.Id}/corrections",
            correction, "blocked");
        Assert.Equal(HttpStatusCode.Conflict, blockedCorrection.StatusCode);
        var january = rows[1];
        var correctionPath = $"{charges}/{january.Id}/corrections";
        using var foreignCorrection = await PostWithKeyAsync(clientB, correctionPath, correction, "correct");
        Assert.Equal(HttpStatusCode.NotFound, foreignCorrection.StatusCode);
        using var corrected = await PostWithKeyAsync(clientA, correctionPath, correction, "correct");
        using var correctedReplay = await PostWithKeyAsync(clientA, correctionPath, correction, "correct");
        Assert.Equal(HttpStatusCode.Created, corrected.StatusCode);
        Assert.Equal(HttpStatusCode.OK, correctedReplay.StatusCode);
        var change = (await corrected.Content.ReadFromJsonAsync<RentChargeCorrectionResponse>(Json))!;
        Assert.Equal(20000m, change.PreviousAmount);
        Assert.Equal(17000m, (await clientA.GetFromJsonAsync<RentChargePage>(charges, Json))!.Items[1].Amount);

        using var voided = await clientA.PostAsJsonAsync(path + "/void", new { reason = "Hatalı kayıt" });
        Assert.Equal(HttpStatusCode.OK, voided.StatusCode);
        var result = (await voided.Content.ReadFromJsonAsync<PaymentResponse>(Json))!;
        Assert.Equal("VOIDED", result.Status);
        Assert.False(Assert.Single(result.Allocations).IsEffective);
        Assert.Equal(12000m, (await clientA.GetFromJsonAsync<RentChargePage>(charges, Json))!.Items[0].Balance);
    }

    private static async Task<HttpResponseMessage> PostWithKeyAsync(HttpClient client, string path, object body, string key)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
        request.Headers.Add("Idempotency-Key", key);
        return await client.SendAsync(request);
    }

    private static async Task VerifyUnitsAsync(HttpClient clientA, HttpClient clientB,
        PropertyResponse archived, PropertyResponse multiA, PropertyResponse multiB)
    {
        var unitsA = $"{Properties}/{multiA.Id}/units";
        var unitsB = $"{Properties}/{multiB.Id}/units";
        var archivedUnits = $"{Properties}/{archived.Id}/units";
        var input = new { label = " Dükkan ", usageType = "COMMERCIAL", doorNumber = " 3 ", areaM2 = 45.25m };
        var existingDefault = Assert.Single((await clientA.GetFromJsonAsync<UnitPage>(archivedUnits, Json))!.Items);
        Assert.True(existingDefault.IsDefault);
        using var archivedCreate = await clientA.PostAsJsonAsync(archivedUnits, input);
        Assert.Equal(HttpStatusCode.Conflict, archivedCreate.StatusCode);

        foreach (var (client, foreignPath) in new[] { (clientA, unitsB), (clientB, unitsA) })
        {
            using var list = await client.GetAsync(foreignPath);
            using var create = await client.PostAsJsonAsync(foreignPath, input);
            Assert.Equal(HttpStatusCode.NotFound, list.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, create.StatusCode);
        }
        using var invalid = await clientA.PostAsJsonAsync(unitsA, new { label = "", usageType = "RESIDENTIAL", areaM2 = 1.234m });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var results = await Task.WhenAll(clientA.PostAsJsonAsync(unitsA, input), clientA.PostAsJsonAsync(unitsA, input));
        using var created = Assert.Single(results, response => response.StatusCode == HttpStatusCode.Created);
        using var duplicate = Assert.Single(results, response => response.StatusCode == HttpStatusCode.Conflict);
        var unit = Assert.Single((await clientA.GetFromJsonAsync<UnitPage>(unitsA, Json))!.Items);
        Assert.Equal(multiA.Id, unit.PropertyId);
        Assert.Equal("Dükkan", unit.Label);
        Assert.Equal("3", unit.DoorNumber);
        Assert.Equal(45.25m, unit.AreaM2);
        Assert.Empty((await clientB.GetFromJsonAsync<UnitPage>(unitsB, Json))!.Items);
    }

    private static async Task VerifyTenantsAsync(HttpClient clientA, HttpClient clientB,
        Guid accountA, Guid accountB, ApplicationDbContext db)
    {
        const string tenants = "/api/v1/tenants";
        using var createdA = await clientA.PostAsJsonAsync(tenants,
            new { kind = "PERSON", firstName = " Ada ", lastName = "Çelik", accountId = accountB });
        using var createdB = await clientB.PostAsJsonAsync(tenants,
            new { kind = "COMPANY", companyName = "Örnek Ltd.", accountId = accountA });
        Assert.Equal(HttpStatusCode.Created, createdA.StatusCode);
        Assert.Equal(HttpStatusCode.Created, createdB.StatusCode);
        var tenantA = (await createdA.Content.ReadFromJsonAsync<TenantResponse>(Json))!;
        var tenantB = (await createdB.Content.ReadFromJsonAsync<TenantResponse>(Json))!;
        Assert.Equal("Ada", tenantA.FirstName);
        Assert.Equal(tenantA.Id, Assert.Single((await clientA.GetFromJsonAsync<TenantPage>(tenants, Json))!.Items).Id);
        Assert.Equal(tenantB.Id, Assert.Single((await clientB.GetFromJsonAsync<TenantPage>(tenants, Json))!.Items).Id);
        Assert.Empty((await clientA.GetFromJsonAsync<TenantPage>(tenants + "?q=Ltd.", Json))!.Items);
        Assert.Single((await clientA.GetFromJsonAsync<TenantPage>(
            tenants + "?q=" + Uri.EscapeDataString("Ada Çelik"), Json))!.Items);
        Assert.Equal(accountA, (await db.Tenants.AsNoTracking().SingleAsync(item => item.Id == tenantA.Id)).AccountId);
        Assert.Equal(accountB, (await db.Tenants.AsNoTracking().SingleAsync(item => item.Id == tenantB.Id)).AccountId);

        foreach (var (client, foreign) in new[] { (clientA, tenantB), (clientB, tenantA) })
        {
            var path = $"{tenants}/{foreign.Id}";
            using var get = await client.GetAsync(path);
            using var patch = await client.PatchAsJsonAsync(path,
                new { kind = "COMPANY", companyName = "Yetkisiz", foreign.Version });
            using var archive = await client.PostAsJsonAsync(path + "/archive", new { foreign.Version });
            Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, patch.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, archive.StatusCode);
        }

        var ownPath = $"{tenants}/{tenantA.Id}";
        var input = new { kind = "PERSON", firstName = "Ada", lastName = "Çelik", email = "ada@example.test", tenantA.Version };
        using var update = await clientA.PatchAsJsonAsync(ownPath, input);
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = (await update.Content.ReadFromJsonAsync<TenantResponse>(Json))!;
        Assert.Equal(input.email, updated.Email);
        using var stale = await clientA.PatchAsJsonAsync(ownPath, input);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        using var archiveA = await clientA.PostAsJsonAsync(ownPath + "/archive", new { updated.Version });
        Assert.Equal(HttpStatusCode.NoContent, archiveA.StatusCode);
        Assert.Empty((await clientA.GetFromJsonAsync<TenantPage>(tenants, Json))!.Items);
        var archived = Assert.Single((await clientA.GetFromJsonAsync<TenantPage>(tenants + "?includeArchived=true", Json))!.Items,
            item => item.Id == tenantA.Id);
        Assert.Equal(DateTimeKind.Utc, archived.ArchivedAtUtc!.Value.Kind);
    }

    private static (Account, ApplicationUser) AddOwner(ApplicationDbContext db, string prefix)
    {
        var email = $"{prefix}@example.test";
        var account = new Account { Id = Guid.NewGuid(), Name = prefix };
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = email,
            UserName = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString()
        };
        user.PasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(user, Password);
        db.AddRange(account, user, new AccountMember
        {
            AccountId = account.Id,
            UserId = user.Id,
            Role = "OWNER",
            Status = "ACTIVE"
        });
        return (account, user);
    }

    private static async Task<HttpClient> SignInAsync(WebApplicationFactory<Program> factory, ApplicationUser user)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Origin", Origin);
        using var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { user.Email, Password });
        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
        return client;
    }

    private static async Task<PropertyResponse> CreateAsync(HttpClient client, object input)
    {
        using var created = await client.PostAsJsonAsync(Properties, input);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var property = (await created.Content.ReadFromJsonAsync<PropertyResponse>(Json))!;
        Assert.EndsWith($"/{property.Id}", created.Headers.Location?.ToString());
        return property;
    }

    private static async Task<PropertyPage> ListAsync(HttpClient client, string query = "") =>
        (await client.GetFromJsonAsync<PropertyPage>(Properties + query, Json))!;

    private static async Task AssertForeignPropertyHiddenAsync(HttpClient client, PropertyResponse foreign)
    {
        var path = $"{Properties}/{foreign.Id}";
        using var get = await client.GetAsync(path);
        using var patch = await client.PatchAsJsonAsync(path,
            new { name = "Yetkisiz", address = "Yetkisiz", foreign.Version });
        using var archive = await client.PostAsJsonAsync(path + "/archive", new { foreign.Version });
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, patch.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, archive.StatusCode);
    }
}
