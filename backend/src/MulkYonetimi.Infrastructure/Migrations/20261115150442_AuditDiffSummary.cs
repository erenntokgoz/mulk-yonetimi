using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MulkYonetimi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AuditDiffSummary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DiffSummary",
                table: "AuditEvents",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DiffSummary",
                table: "AuditEvents");
        }
    }
}
