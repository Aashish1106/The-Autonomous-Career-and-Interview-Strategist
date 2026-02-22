using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace AutoJobStrategist.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateVectorToGoogleSize : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Vector>(
                name: "ResumeEmbedding",
                table: "UserProfiles",
                type: "vector(768)",
                nullable: true,
                oldClrType: typeof(Vector),
                oldType: "vector(1536)",
                oldNullable: true);

            migrationBuilder.AlterColumn<Vector>(
                name: "JobEmbedding",
                table: "JobApplications",
                type: "vector(768)",
                nullable: true,
                oldClrType: typeof(Vector),
                oldType: "vector(1536)",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Vector>(
                name: "ResumeEmbedding",
                table: "UserProfiles",
                type: "vector(1536)",
                nullable: true,
                oldClrType: typeof(Vector),
                oldType: "vector(768)",
                oldNullable: true);

            migrationBuilder.AlterColumn<Vector>(
                name: "JobEmbedding",
                table: "JobApplications",
                type: "vector(1536)",
                nullable: true,
                oldClrType: typeof(Vector),
                oldType: "vector(768)",
                oldNullable: true);
        }
    }
}
