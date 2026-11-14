using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MulkYonetimi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UnitArchive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ArchivedAtUtc",
                table: "Units",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Units_AccountId_PropertyId_ArchivedAtUtc",
                table: "Units",
                columns: new[] { "AccountId", "PropertyId", "ArchivedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Units_AccountId_PropertyId_ArchivedAtUtc",
                table: "Units");

            migrationBuilder.DropColumn(
                name: "ArchivedAtUtc",
                table: "Units");
        }
    }
}
