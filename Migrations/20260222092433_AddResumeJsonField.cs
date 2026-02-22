using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AutoJobStrategist.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddResumeJsonField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StructuredResumeJson",
                table: "UserProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "UserProfiles",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                column: "StructuredResumeJson",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StructuredResumeJson",
                table: "UserProfiles");
        }
    }
}
