using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AutoJobStrategist.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTokenLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DailyTokensBurned",
                table: "UserProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastTokenReset",
                table: "UserProfiles",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.UpdateData(
                table: "UserProfiles",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "DailyTokensBurned", "LastTokenReset" },
                values: new object[] { 0, new DateTime(2024, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DailyTokensBurned",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "LastTokenReset",
                table: "UserProfiles");
        }
    }
}
