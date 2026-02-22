using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AutoJobStrategist.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEvaluationHistoryTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EvaluationHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyName = table.Column<string>(type: "text", nullable: true),
                    RoleTitle = table.Column<string>(type: "text", nullable: true),
                    JobUrl = table.Column<string>(type: "text", nullable: true),
                    JobDescription = table.Column<string>(type: "text", nullable: true),
                    MatchScore = table.Column<int>(type: "integer", nullable: false),
                    EvaluationJson = table.Column<string>(type: "text", nullable: true),
                    TailoredResumeJson = table.Column<string>(type: "text", nullable: true),
                    CoverLetterText = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationHistories", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EvaluationHistories");
        }
    }
}
