using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MulkYonetimi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OperatingLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_Units_AccountId_PropertyId_Id",
                table: "Units",
                columns: new[] { "AccountId", "PropertyId", "Id" });

            migrationBuilder.CreateTable(
                name: "Expenses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(19,2)", precision: 19, scale: 2, nullable: false),
                    ExpenseOn = table.Column<DateOnly>(type: "date", nullable: false),
                    PaidOn = table.Column<DateOnly>(type: "date", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false, collation: "Latin1_General_100_BIN2"),
                    VoidedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    VoidReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Expenses_Properties_AccountId_PropertyId",
                        columns: x => new { x.AccountId, x.PropertyId },
                        principalTable: "Properties",
                        principalColumns: new[] { "AccountId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Expenses_Units_AccountId_PropertyId_UnitId",
                        columns: x => new { x.AccountId, x.PropertyId, x.UnitId },
                        principalTable: "Units",
                        principalColumns: new[] { "AccountId", "PropertyId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SecurityDeposits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustodyType = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityDeposits", x => x.Id);
                    table.UniqueConstraint("AK_SecurityDeposits_AccountId_Id", x => new { x.AccountId, x.Id });
                    table.ForeignKey(
                        name: "FK_SecurityDeposits_Leases_AccountId_LeaseId",
                        columns: x => new { x.AccountId, x.LeaseId },
                        principalTable: "Leases",
                        principalColumns: new[] { "AccountId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DepositMovements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DepositId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MovementOn = table.Column<DateOnly>(type: "date", nullable: false),
                    MovementType = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(19,2)", precision: 19, scale: 2, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false, collation: "Latin1_General_100_BIN2")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepositMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DepositMovements_SecurityDeposits_AccountId_DepositId",
                        columns: x => new { x.AccountId, x.DepositId },
                        principalTable: "SecurityDeposits",
                        principalColumns: new[] { "AccountId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DepositMovements_AccountId_DepositId_IdempotencyKey",
                table: "DepositMovements",
                columns: new[] { "AccountId", "DepositId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_AccountId_ExpenseOn_Id",
                table: "Expenses",
                columns: new[] { "AccountId", "ExpenseOn", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_AccountId_IdempotencyKey",
                table: "Expenses",
                columns: new[] { "AccountId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_AccountId_PropertyId_UnitId",
                table: "Expenses",
                columns: new[] { "AccountId", "PropertyId", "UnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_SecurityDeposits_AccountId_LeaseId",
                table: "SecurityDeposits",
                columns: new[] { "AccountId", "LeaseId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DepositMovements");

            migrationBuilder.DropTable(
                name: "Expenses");

            migrationBuilder.DropTable(
                name: "SecurityDeposits");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Units_AccountId_PropertyId_Id",
                table: "Units");
        }
    }
}
