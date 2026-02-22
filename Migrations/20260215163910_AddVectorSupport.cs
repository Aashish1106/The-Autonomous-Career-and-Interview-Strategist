using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace AutoJobStrategist.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVectorSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.AddColumn<Vector>(
                name: "ResumeEmbedding",
                table: "UserProfiles",
                type: "vector(1536)",
                nullable: true);

            migrationBuilder.AddColumn<Vector>(
                name: "JobEmbedding",
                table: "JobApplications",
                type: "vector(1536)",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "UserProfiles",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                column: "ResumeEmbedding",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResumeEmbedding",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "JobEmbedding",
                table: "JobApplications");

            migrationBuilder.AlterDatabase()
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
