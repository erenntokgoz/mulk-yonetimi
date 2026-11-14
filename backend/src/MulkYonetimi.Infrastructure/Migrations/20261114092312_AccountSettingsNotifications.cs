using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MulkYonetimi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AccountSettingsNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OutboxMessages_AccountId",
                table: "OutboxMessages");

            migrationBuilder.AddColumn<string>(
                name: "EventKey",
                table: "OutboxMessages",
                type: "nvarchar(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NotificationType",
                table: "OutboxMessages",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Subject",
                table: "OutboxMessages",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "OutboxMessages",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "AspNetUsers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "NotificationPreferences",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EmailEnabled = table.Column<bool>(type: "bit", nullable: false),
                    RentDueEnabled = table.Column<bool>(type: "bit", nullable: false),
                    OverdueRentEnabled = table.Column<bool>(type: "bit", nullable: false),
                    LeaseEndEnabled = table.Column<bool>(type: "bit", nullable: false),
                    RentAnniversaryEnabled = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationPreferences", x => new { x.AccountId, x.UserId });
                    table.ForeignKey(
                        name: "FK_NotificationPreferences_AccountMembers_AccountId_UserId",
                        columns: x => new { x.AccountId, x.UserId },
                        principalTable: "AccountMembers",
                        principalColumns: new[] { "AccountId", "UserId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    ReadAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.UniqueConstraint("AK_Notifications_AccountId_Id", x => new { x.AccountId, x.Id });
                    table.ForeignKey(
                        name: "FK_Notifications_AccountMembers_AccountId_UserId",
                        columns: x => new { x.AccountId, x.UserId },
                        principalTable: "AccountMembers",
                        principalColumns: new[] { "AccountId", "UserId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_AccountId_EventKey",
                table: "OutboxMessages",
                columns: new[] { "AccountId", "EventKey" },
                unique: true,
                filter: "[EventKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_AccountId_UserId",
                table: "OutboxMessages",
                columns: new[] { "AccountId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_AccountId_UserId_EventKey",
                table: "Notifications",
                columns: new[] { "AccountId", "UserId", "EventKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_AccountId_UserId_ReadAtUtc_CreatedAtUtc",
                table: "Notifications",
                columns: new[] { "AccountId", "UserId", "ReadAtUtc", "CreatedAtUtc" });

            migrationBuilder.AddForeignKey(
                name: "FK_OutboxMessages_AccountMembers_AccountId_UserId",
                table: "OutboxMessages",
                columns: new[] { "AccountId", "UserId" },
                principalTable: "AccountMembers",
                principalColumns: new[] { "AccountId", "UserId" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OutboxMessages_AccountMembers_AccountId_UserId",
                table: "OutboxMessages");

            migrationBuilder.DropTable(
                name: "NotificationPreferences");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_OutboxMessages_AccountId_EventKey",
                table: "OutboxMessages");

            migrationBuilder.DropIndex(
                name: "IX_OutboxMessages_AccountId_UserId",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "EventKey",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "NotificationType",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "Subject",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "OutboxMessages");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "AspNetUsers");

            migrationBuilder.CreateIndex(
                name: "IX_OutboxMessages_AccountId",
                table: "OutboxMessages",
                column: "AccountId");
        }
    }
}
