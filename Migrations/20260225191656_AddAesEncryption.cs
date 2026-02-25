using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AutoJobStrategist.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAesEncryption : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DailyApplicationLimit",
                table: "UserProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "EncryptedLinkedInEmail",
                table: "UserProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EncryptedLinkedInPassword",
                table: "UserProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HeadlessMode",
                table: "UserProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "MatchThreshold",
                table: "UserProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.UpdateData(
                table: "UserProfiles",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "DailyApplicationLimit", "EncryptedLinkedInEmail", "EncryptedLinkedInPassword", "HeadlessMode", "MatchThreshold" },
                values: new object[] { 25, null, null, true, 75 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DailyApplicationLimit",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "EncryptedLinkedInEmail",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "EncryptedLinkedInPassword",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "HeadlessMode",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "MatchThreshold",
                table: "UserProfiles");
        }
    }
}
