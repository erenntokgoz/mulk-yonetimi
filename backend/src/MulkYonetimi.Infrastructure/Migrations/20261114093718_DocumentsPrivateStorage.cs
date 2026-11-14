using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MulkYonetimi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DocumentsPrivateStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Documents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UnitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UploadObjectKey = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: false),
                    ObjectKey = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    OriginalName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UploadExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UploadCleanupCompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeleteCleanupCompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Documents", x => x.Id);
                    table.UniqueConstraint("AK_Documents_AccountId_Id", x => new { x.AccountId, x.Id });
                    table.CheckConstraint("CK_Documents_ActiveObject", "[Status] <> 'ACTIVE' OR ([ObjectKey] IS NOT NULL AND [CompletedAtUtc] IS NOT NULL)");
                    table.CheckConstraint("CK_Documents_ExactlyOneOwner", "((CASE WHEN [PropertyId] IS NULL THEN 0 ELSE 1 END) + (CASE WHEN [UnitId] IS NULL THEN 0 ELSE 1 END) + (CASE WHEN [LeaseId] IS NULL THEN 0 ELSE 1 END)) = 1");
                    table.CheckConstraint("CK_Documents_Status", "[Status] IN ('PENDING', 'ACTIVE', 'DELETED')");
                    table.ForeignKey(
                        name: "FK_Documents_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Documents_Leases_AccountId_LeaseId",
                        columns: x => new { x.AccountId, x.LeaseId },
                        principalTable: "Leases",
                        principalColumns: new[] { "AccountId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Documents_Properties_AccountId_PropertyId",
                        columns: x => new { x.AccountId, x.PropertyId },
                        principalTable: "Properties",
                        principalColumns: new[] { "AccountId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Documents_Units_AccountId_UnitId",
                        columns: x => new { x.AccountId, x.UnitId },
                        principalTable: "Units",
                        principalColumns: new[] { "AccountId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_AccountId_LeaseId",
                table: "Documents",
                columns: new[] { "AccountId", "LeaseId" });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_AccountId_PropertyId",
                table: "Documents",
                columns: new[] { "AccountId", "PropertyId" });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_AccountId_Status_CreatedAtUtc",
                table: "Documents",
                columns: new[] { "AccountId", "Status", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_AccountId_UnitId",
                table: "Documents",
                columns: new[] { "AccountId", "UnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_ObjectKey",
                table: "Documents",
                column: "ObjectKey",
                unique: true,
                filter: "[ObjectKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_UploadObjectKey",
                table: "Documents",
                column: "UploadObjectKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Documents");
        }
    }
}
