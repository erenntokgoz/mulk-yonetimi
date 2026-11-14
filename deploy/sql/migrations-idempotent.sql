IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028150608_InitialBaseline'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261028150608_InitialBaseline', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE TABLE [Accounts] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [Status] nvarchar(16) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_Accounts] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE TABLE [AspNetRoles] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(256) NULL,
        [NormalizedName] nvarchar(256) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE TABLE [AspNetUsers] (
        [Id] uniqueidentifier NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        [UserName] nvarchar(256) NULL,
        [NormalizedUserName] nvarchar(256) NULL,
        [Email] nvarchar(256) NULL,
        [NormalizedEmail] nvarchar(256) NULL,
        [EmailConfirmed] bit NOT NULL,
        [PasswordHash] nvarchar(max) NULL,
        [SecurityStamp] nvarchar(max) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        [PhoneNumber] nvarchar(max) NULL,
        [PhoneNumberConfirmed] bit NOT NULL,
        [TwoFactorEnabled] bit NOT NULL,
        [LockoutEnd] datetimeoffset NULL,
        [LockoutEnabled] bit NOT NULL,
        [AccessFailedCount] int NOT NULL,
        CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE TABLE [AspNetRoleClaims] (
        [Id] int NOT NULL IDENTITY,
        [RoleId] uniqueidentifier NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE TABLE [AccountMembers] (
        [AccountId] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [Role] nvarchar(16) NOT NULL,
        [Status] nvarchar(16) NOT NULL,
        CONSTRAINT [PK_AccountMembers] PRIMARY KEY ([AccountId], [UserId]),
        CONSTRAINT [FK_AccountMembers_Accounts_AccountId] FOREIGN KEY ([AccountId]) REFERENCES [Accounts] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_AccountMembers_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE TABLE [AspNetUserClaims] (
        [Id] int NOT NULL IDENTITY,
        [UserId] uniqueidentifier NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE TABLE [AspNetUserLogins] (
        [LoginProvider] nvarchar(450) NOT NULL,
        [ProviderKey] nvarchar(450) NOT NULL,
        [ProviderDisplayName] nvarchar(max) NULL,
        [UserId] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
        CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE TABLE [AspNetUserRoles] (
        [UserId] uniqueidentifier NOT NULL,
        [RoleId] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
        CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE TABLE [AspNetUserTokens] (
        [UserId] uniqueidentifier NOT NULL,
        [LoginProvider] nvarchar(450) NOT NULL,
        [Name] nvarchar(450) NOT NULL,
        [Value] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
        CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE INDEX [IX_AccountMembers_UserId] ON [AccountMembers] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [AspNetRoleClaims] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [RoleNameIndex] ON [AspNetRoles] ([NormalizedName]) WHERE [NormalizedName] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE INDEX [IX_AspNetUserClaims_UserId] ON [AspNetUserClaims] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE INDEX [IX_AspNetUserLogins_UserId] ON [AspNetUserLogins] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [AspNetUserRoles] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [EmailIndex] ON [AspNetUsers] ([NormalizedEmail]) WHERE [NormalizedEmail] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [UserNameIndex] ON [AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028152825_IdentityAccountSchema'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261028152825_IdentityAccountSchema', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028213950_AuthEmailOutbox'
)
BEGIN
    CREATE TABLE [OutboxMessages] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [Kind] nvarchar(32) NOT NULL,
        [PayloadVersion] int NOT NULL,
        [RecipientEmail] nvarchar(256) NOT NULL,
        [ProtectedUrl] nvarchar(max) NOT NULL,
        [Status] nvarchar(16) NOT NULL,
        [AttemptCount] int NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        [NextAttemptAtUtc] datetime2 NOT NULL,
        [ClaimedUntilUtc] datetime2 NULL,
        [ClaimId] uniqueidentifier NULL,
        [SentAtUtc] datetime2 NULL,
        CONSTRAINT [PK_OutboxMessages] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_OutboxMessages_Accounts_AccountId] FOREIGN KEY ([AccountId]) REFERENCES [Accounts] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028213950_AuthEmailOutbox'
)
BEGIN
    CREATE INDEX [IX_OutboxMessages_AccountId] ON [OutboxMessages] ([AccountId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028213950_AuthEmailOutbox'
)
BEGIN
    CREATE INDEX [IX_OutboxMessages_Status_NextAttemptAtUtc] ON [OutboxMessages] ([Status], [NextAttemptAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261028213950_AuthEmailOutbox'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261028213950_AuthEmailOutbox', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112101414_PortfolioProperties'
)
BEGIN
    CREATE TABLE [AuditEvents] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [ActorUserId] uniqueidentifier NOT NULL,
        [EntityId] uniqueidentifier NOT NULL,
        [EntityType] nvarchar(32) NOT NULL,
        [Action] nvarchar(32) NOT NULL,
        [OccurredAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_AuditEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AuditEvents_Accounts_AccountId] FOREIGN KEY ([AccountId]) REFERENCES [Accounts] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112101414_PortfolioProperties'
)
BEGIN
    CREATE TABLE [Properties] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [Address] nvarchar(500) NOT NULL,
        [Kind] nvarchar(16) NOT NULL,
        [ArchivedAtUtc] datetime2 NULL,
        [Version] rowversion NOT NULL,
        CONSTRAINT [PK_Properties] PRIMARY KEY ([Id]),
        CONSTRAINT [AK_Properties_AccountId_Id] UNIQUE ([AccountId], [Id]),
        CONSTRAINT [FK_Properties_Accounts_AccountId] FOREIGN KEY ([AccountId]) REFERENCES [Accounts] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112101414_PortfolioProperties'
)
BEGIN
    CREATE TABLE [Units] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [PropertyId] uniqueidentifier NOT NULL,
        [Label] nvarchar(100) NOT NULL,
        [UsageType] nvarchar(16) NOT NULL,
        [IsDefault] bit NOT NULL,
        CONSTRAINT [PK_Units] PRIMARY KEY ([Id]),
        CONSTRAINT [AK_Units_AccountId_Id] UNIQUE ([AccountId], [Id]),
        CONSTRAINT [FK_Units_Properties_AccountId_PropertyId] FOREIGN KEY ([AccountId], [PropertyId]) REFERENCES [Properties] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112101414_PortfolioProperties'
)
BEGIN
    CREATE INDEX [IX_AuditEvents_AccountId_OccurredAtUtc] ON [AuditEvents] ([AccountId], [OccurredAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112101414_PortfolioProperties'
)
BEGIN
    CREATE INDEX [IX_Properties_AccountId_ArchivedAtUtc_Name_Id] ON [Properties] ([AccountId], [ArchivedAtUtc], [Name], [Id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112101414_PortfolioProperties'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Units_AccountId_PropertyId] ON [Units] ([AccountId], [PropertyId]) WHERE [IsDefault] = 1');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112101414_PortfolioProperties'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Units_AccountId_PropertyId_Label] ON [Units] ([AccountId], [PropertyId], [Label]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112101414_PortfolioProperties'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261112101414_PortfolioProperties', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112104120_UnitDetails'
)
BEGIN
    ALTER TABLE [Units] ADD [AreaM2] decimal(9,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112104120_UnitDetails'
)
BEGIN
    ALTER TABLE [Units] ADD [DoorNumber] nvarchar(32) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112104120_UnitDetails'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261112104120_UnitDetails', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112104455_TenantCards'
)
BEGIN
    CREATE TABLE [Tenants] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [Kind] nvarchar(16) NOT NULL,
        [FirstName] nvarchar(100) NULL,
        [LastName] nvarchar(100) NULL,
        [CompanyName] nvarchar(200) NULL,
        [Phone] nvarchar(32) NULL,
        [Email] nvarchar(256) NULL,
        [ArchivedAtUtc] datetime2 NULL,
        [Version] rowversion NOT NULL,
        CONSTRAINT [PK_Tenants] PRIMARY KEY ([Id]),
        CONSTRAINT [AK_Tenants_AccountId_Id] UNIQUE ([AccountId], [Id]),
        CONSTRAINT [FK_Tenants_Accounts_AccountId] FOREIGN KEY ([AccountId]) REFERENCES [Accounts] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112104455_TenantCards'
)
BEGIN
    CREATE INDEX [IX_Tenants_AccountId_ArchivedAtUtc] ON [Tenants] ([AccountId], [ArchivedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261112104455_TenantCards'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261112104455_TenantCards', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113132844_LeaseLedger'
)
BEGIN
    CREATE TABLE [Leases] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [UnitId] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [Status] nvarchar(16) NOT NULL,
        [StartDate] date NOT NULL,
        [PlannedEndDate] date NULL,
        [TerminationDate] date NULL,
        [DueDay] int NOT NULL,
        [DepositAmount] decimal(19,2) NOT NULL,
        [Note] nvarchar(1000) NULL,
        [TerminationReason] nvarchar(500) NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        [Version] rowversion NOT NULL,
        CONSTRAINT [PK_Leases] PRIMARY KEY ([Id]),
        CONSTRAINT [AK_Leases_AccountId_Id] UNIQUE ([AccountId], [Id]),
        CONSTRAINT [FK_Leases_Tenants_AccountId_TenantId] FOREIGN KEY ([AccountId], [TenantId]) REFERENCES [Tenants] ([AccountId], [Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Leases_Units_AccountId_UnitId] FOREIGN KEY ([AccountId], [UnitId]) REFERENCES [Units] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113132844_LeaseLedger'
)
BEGIN
    CREATE TABLE [RentCharges] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [LeaseId] uniqueidentifier NOT NULL,
        [PeriodStart] date NOT NULL,
        [DueDate] date NOT NULL,
        [Amount] decimal(19,2) NOT NULL,
        CONSTRAINT [PK_RentCharges] PRIMARY KEY ([Id]),
        CONSTRAINT [AK_RentCharges_AccountId_Id] UNIQUE ([AccountId], [Id]),
        CONSTRAINT [FK_RentCharges_Leases_AccountId_LeaseId] FOREIGN KEY ([AccountId], [LeaseId]) REFERENCES [Leases] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113132844_LeaseLedger'
)
BEGIN
    CREATE TABLE [RentRatePeriods] (
        [AccountId] uniqueidentifier NOT NULL,
        [LeaseId] uniqueidentifier NOT NULL,
        [EffectiveFrom] date NOT NULL,
        [MonthlyAmount] decimal(19,2) NOT NULL,
        [Reason] nvarchar(500) NULL,
        CONSTRAINT [PK_RentRatePeriods] PRIMARY KEY ([AccountId], [LeaseId], [EffectiveFrom]),
        CONSTRAINT [FK_RentRatePeriods_Leases_AccountId_LeaseId] FOREIGN KEY ([AccountId], [LeaseId]) REFERENCES [Leases] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113132844_LeaseLedger'
)
BEGIN
    CREATE INDEX [IX_Leases_AccountId_TenantId] ON [Leases] ([AccountId], [TenantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113132844_LeaseLedger'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Leases_AccountId_UnitId] ON [Leases] ([AccountId], [UnitId]) WHERE [Status] = ''ACTIVE''');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113132844_LeaseLedger'
)
BEGIN
    CREATE INDEX [IX_Leases_AccountId_UnitId_StartDate] ON [Leases] ([AccountId], [UnitId], [StartDate]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113132844_LeaseLedger'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RentCharges_AccountId_LeaseId_PeriodStart] ON [RentCharges] ([AccountId], [LeaseId], [PeriodStart]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113132844_LeaseLedger'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113132844_LeaseLedger', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133411_PaymentsLedger'
)
BEGIN
    CREATE TABLE [Payments] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [TenantId] uniqueidentifier NOT NULL,
        [PaidOn] date NOT NULL,
        [Amount] decimal(19,2) NOT NULL,
        [Method] nvarchar(16) NOT NULL,
        [Reference] nvarchar(500) NULL,
        [IdempotencyKey] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
        [VoidedAtUtc] datetime2 NULL,
        [VoidReason] nvarchar(500) NULL,
        CONSTRAINT [PK_Payments] PRIMARY KEY ([Id]),
        CONSTRAINT [AK_Payments_AccountId_Id] UNIQUE ([AccountId], [Id]),
        CONSTRAINT [FK_Payments_Tenants_AccountId_TenantId] FOREIGN KEY ([AccountId], [TenantId]) REFERENCES [Tenants] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133411_PaymentsLedger'
)
BEGIN
    CREATE TABLE [PaymentAllocations] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [PaymentId] uniqueidentifier NOT NULL,
        [RentChargeId] uniqueidentifier NOT NULL,
        [Amount] decimal(19,2) NOT NULL,
        [IdempotencyKey] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
        CONSTRAINT [PK_PaymentAllocations] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PaymentAllocations_Payments_AccountId_PaymentId] FOREIGN KEY ([AccountId], [PaymentId]) REFERENCES [Payments] ([AccountId], [Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_PaymentAllocations_RentCharges_AccountId_RentChargeId] FOREIGN KEY ([AccountId], [RentChargeId]) REFERENCES [RentCharges] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133411_PaymentsLedger'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PaymentAllocations_AccountId_PaymentId_IdempotencyKey] ON [PaymentAllocations] ([AccountId], [PaymentId], [IdempotencyKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133411_PaymentsLedger'
)
BEGIN
    CREATE INDEX [IX_PaymentAllocations_AccountId_RentChargeId] ON [PaymentAllocations] ([AccountId], [RentChargeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133411_PaymentsLedger'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Payments_AccountId_IdempotencyKey] ON [Payments] ([AccountId], [IdempotencyKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133411_PaymentsLedger'
)
BEGIN
    CREATE INDEX [IX_Payments_AccountId_PaidOn_Id] ON [Payments] ([AccountId], [PaidOn], [Id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133411_PaymentsLedger'
)
BEGIN
    CREATE INDEX [IX_Payments_AccountId_TenantId] ON [Payments] ([AccountId], [TenantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133411_PaymentsLedger'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113133411_PaymentsLedger', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133601_ChargeCorrections'
)
BEGIN
    CREATE TABLE [RentChargeCorrections] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [RentChargeId] uniqueidentifier NOT NULL,
        [PreviousAmount] decimal(19,2) NOT NULL,
        [Amount] decimal(19,2) NOT NULL,
        [Reason] nvarchar(500) NOT NULL,
        [OccurredAtUtc] datetime2 NOT NULL,
        [IdempotencyKey] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
        CONSTRAINT [PK_RentChargeCorrections] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RentChargeCorrections_RentCharges_AccountId_RentChargeId] FOREIGN KEY ([AccountId], [RentChargeId]) REFERENCES [RentCharges] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133601_ChargeCorrections'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RentChargeCorrections_AccountId_RentChargeId_IdempotencyKey] ON [RentChargeCorrections] ([AccountId], [RentChargeId], [IdempotencyKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113133601_ChargeCorrections'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113133601_ChargeCorrections', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    ALTER TABLE [Units] ADD CONSTRAINT [AK_Units_AccountId_PropertyId_Id] UNIQUE ([AccountId], [PropertyId], [Id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    CREATE TABLE [Expenses] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [PropertyId] uniqueidentifier NOT NULL,
        [UnitId] uniqueidentifier NULL,
        [Category] nvarchar(16) NOT NULL,
        [Amount] decimal(19,2) NOT NULL,
        [ExpenseOn] date NOT NULL,
        [PaidOn] date NULL,
        [Note] nvarchar(500) NULL,
        [IdempotencyKey] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
        [VoidedAtUtc] datetime2 NULL,
        [VoidReason] nvarchar(500) NULL,
        CONSTRAINT [PK_Expenses] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Expenses_Properties_AccountId_PropertyId] FOREIGN KEY ([AccountId], [PropertyId]) REFERENCES [Properties] ([AccountId], [Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Expenses_Units_AccountId_PropertyId_UnitId] FOREIGN KEY ([AccountId], [PropertyId], [UnitId]) REFERENCES [Units] ([AccountId], [PropertyId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    CREATE TABLE [SecurityDeposits] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [LeaseId] uniqueidentifier NOT NULL,
        [CustodyType] nvarchar(16) NOT NULL,
        [Note] nvarchar(500) NULL,
        CONSTRAINT [PK_SecurityDeposits] PRIMARY KEY ([Id]),
        CONSTRAINT [AK_SecurityDeposits_AccountId_Id] UNIQUE ([AccountId], [Id]),
        CONSTRAINT [FK_SecurityDeposits_Leases_AccountId_LeaseId] FOREIGN KEY ([AccountId], [LeaseId]) REFERENCES [Leases] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    CREATE TABLE [DepositMovements] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [DepositId] uniqueidentifier NOT NULL,
        [MovementOn] date NOT NULL,
        [MovementType] nvarchar(16) NOT NULL,
        [Amount] decimal(19,2) NOT NULL,
        [Note] nvarchar(500) NULL,
        [IdempotencyKey] nvarchar(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
        CONSTRAINT [PK_DepositMovements] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_DepositMovements_SecurityDeposits_AccountId_DepositId] FOREIGN KEY ([AccountId], [DepositId]) REFERENCES [SecurityDeposits] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    CREATE UNIQUE INDEX [IX_DepositMovements_AccountId_DepositId_IdempotencyKey] ON [DepositMovements] ([AccountId], [DepositId], [IdempotencyKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    CREATE INDEX [IX_Expenses_AccountId_ExpenseOn_Id] ON [Expenses] ([AccountId], [ExpenseOn], [Id]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Expenses_AccountId_IdempotencyKey] ON [Expenses] ([AccountId], [IdempotencyKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    CREATE INDEX [IX_Expenses_AccountId_PropertyId_UnitId] ON [Expenses] ([AccountId], [PropertyId], [UnitId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    CREATE UNIQUE INDEX [IX_SecurityDeposits_AccountId_LeaseId] ON [SecurityDeposits] ([AccountId], [LeaseId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261113134108_OperatingLedger'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261113134108_OperatingLedger', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    DROP INDEX [IX_OutboxMessages_AccountId] ON [OutboxMessages];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    ALTER TABLE [OutboxMessages] ADD [EventKey] nvarchar(260) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    ALTER TABLE [OutboxMessages] ADD [NotificationType] nvarchar(32) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    ALTER TABLE [OutboxMessages] ADD [Subject] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    ALTER TABLE [OutboxMessages] ADD [UserId] uniqueidentifier NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    ALTER TABLE [AspNetUsers] ADD [DisplayName] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    CREATE TABLE [NotificationPreferences] (
        [AccountId] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [EmailEnabled] bit NOT NULL,
        [RentDueEnabled] bit NOT NULL,
        [OverdueRentEnabled] bit NOT NULL,
        [LeaseEndEnabled] bit NOT NULL,
        [RentAnniversaryEnabled] bit NOT NULL,
        CONSTRAINT [PK_NotificationPreferences] PRIMARY KEY ([AccountId], [UserId]),
        CONSTRAINT [FK_NotificationPreferences_AccountMembers_AccountId_UserId] FOREIGN KEY ([AccountId], [UserId]) REFERENCES [AccountMembers] ([AccountId], [UserId]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    CREATE TABLE [Notifications] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [EventKey] nvarchar(200) NOT NULL,
        [Type] nvarchar(32) NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [Message] nvarchar(1000) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        [ReadAtUtc] datetime2 NULL,
        CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id]),
        CONSTRAINT [AK_Notifications_AccountId_Id] UNIQUE ([AccountId], [Id]),
        CONSTRAINT [FK_Notifications_AccountMembers_AccountId_UserId] FOREIGN KEY ([AccountId], [UserId]) REFERENCES [AccountMembers] ([AccountId], [UserId]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_OutboxMessages_AccountId_EventKey] ON [OutboxMessages] ([AccountId], [EventKey]) WHERE [EventKey] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    CREATE INDEX [IX_OutboxMessages_AccountId_UserId] ON [OutboxMessages] ([AccountId], [UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Notifications_AccountId_UserId_EventKey] ON [Notifications] ([AccountId], [UserId], [EventKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    CREATE INDEX [IX_Notifications_AccountId_UserId_ReadAtUtc_CreatedAtUtc] ON [Notifications] ([AccountId], [UserId], [ReadAtUtc], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    ALTER TABLE [OutboxMessages] ADD CONSTRAINT [FK_OutboxMessages_AccountMembers_AccountId_UserId] FOREIGN KEY ([AccountId], [UserId]) REFERENCES [AccountMembers] ([AccountId], [UserId]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114092312_AccountSettingsNotifications'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261114092312_AccountSettingsNotifications', N'10.0.14');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114093718_DocumentsPrivateStorage'
)
BEGIN
    CREATE TABLE [Documents] (
        [Id] uniqueidentifier NOT NULL,
        [AccountId] uniqueidentifier NOT NULL,
        [PropertyId] uniqueidentifier NULL,
        [UnitId] uniqueidentifier NULL,
        [LeaseId] uniqueidentifier NULL,
        [UploadObjectKey] nvarchar(1024) NOT NULL,
        [ObjectKey] nvarchar(1024) NULL,
        [OriginalName] nvarchar(200) NOT NULL,
        [ContentType] nvarchar(100) NOT NULL,
        [SizeBytes] bigint NOT NULL,
        [Status] nvarchar(16) NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        [UploadExpiresAtUtc] datetime2 NOT NULL,
        [CompletedAtUtc] datetime2 NULL,
        [DeletedAtUtc] datetime2 NULL,
        [UploadCleanupCompletedAtUtc] datetime2 NULL,
        [DeleteCleanupCompletedAtUtc] datetime2 NULL,
        [Version] rowversion NOT NULL,
        CONSTRAINT [PK_Documents] PRIMARY KEY ([Id]),
        CONSTRAINT [AK_Documents_AccountId_Id] UNIQUE ([AccountId], [Id]),
        CONSTRAINT [CK_Documents_ActiveObject] CHECK ([Status] <> 'ACTIVE' OR ([ObjectKey] IS NOT NULL AND [CompletedAtUtc] IS NOT NULL)),
        CONSTRAINT [CK_Documents_ExactlyOneOwner] CHECK (((CASE WHEN [PropertyId] IS NULL THEN 0 ELSE 1 END) + (CASE WHEN [UnitId] IS NULL THEN 0 ELSE 1 END) + (CASE WHEN [LeaseId] IS NULL THEN 0 ELSE 1 END)) = 1),
        CONSTRAINT [CK_Documents_Status] CHECK ([Status] IN ('PENDING', 'ACTIVE', 'DELETED')),
        CONSTRAINT [FK_Documents_Accounts_AccountId] FOREIGN KEY ([AccountId]) REFERENCES [Accounts] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Documents_Leases_AccountId_LeaseId] FOREIGN KEY ([AccountId], [LeaseId]) REFERENCES [Leases] ([AccountId], [Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Documents_Properties_AccountId_PropertyId] FOREIGN KEY ([AccountId], [PropertyId]) REFERENCES [Properties] ([AccountId], [Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Documents_Units_AccountId_UnitId] FOREIGN KEY ([AccountId], [UnitId]) REFERENCES [Units] ([AccountId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114093718_DocumentsPrivateStorage'
)
BEGIN
    CREATE INDEX [IX_Documents_AccountId_LeaseId] ON [Documents] ([AccountId], [LeaseId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114093718_DocumentsPrivateStorage'
)
BEGIN
    CREATE INDEX [IX_Documents_AccountId_PropertyId] ON [Documents] ([AccountId], [PropertyId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114093718_DocumentsPrivateStorage'
)
BEGIN
    CREATE INDEX [IX_Documents_AccountId_Status_CreatedAtUtc] ON [Documents] ([AccountId], [Status], [CreatedAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114093718_DocumentsPrivateStorage'
)
BEGIN
    CREATE INDEX [IX_Documents_AccountId_UnitId] ON [Documents] ([AccountId], [UnitId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114093718_DocumentsPrivateStorage'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Documents_ObjectKey] ON [Documents] ([ObjectKey]) WHERE [ObjectKey] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114093718_DocumentsPrivateStorage'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Documents_UploadObjectKey] ON [Documents] ([UploadObjectKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261114093718_DocumentsPrivateStorage'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261114093718_DocumentsPrivateStorage', N'10.0.14');
END;

COMMIT;
GO

