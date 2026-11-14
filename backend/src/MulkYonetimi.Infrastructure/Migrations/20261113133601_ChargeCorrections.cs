using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MulkYonetimi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ChargeCorrections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RentChargeCorrections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RentChargeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PreviousAmount = table.Column<decimal>(type: "decimal(19,2)", precision: 19, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(19,2)", precision: 19, scale: 2, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false, collation: "Latin1_General_100_BIN2")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RentChargeCorrections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RentChargeCorrections_RentCharges_AccountId_RentChargeId",
                        columns: x => new { x.AccountId, x.RentChargeId },
                        principalTable: "RentCharges",
                        principalColumns: new[] { "AccountId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RentChargeCorrections_AccountId_RentChargeId_IdempotencyKey",
                table: "RentChargeCorrections",
                columns: new[] { "AccountId", "RentChargeId", "IdempotencyKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RentChargeCorrections");
        }
    }
}
