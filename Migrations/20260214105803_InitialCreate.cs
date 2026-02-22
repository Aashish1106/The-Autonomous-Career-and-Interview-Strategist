using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AutoJobStrategist.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "JobApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyName = table.Column<string>(type: "text", nullable: false),
                    RoleTitle = table.Column<string>(type: "text", nullable: false),
                    JobUrl = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    MatchScore = table.Column<double>(type: "double precision", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JobApplications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "text", nullable: false),
                    BaseResumeText = table.Column<string>(type: "text", nullable: false),
                    CoreSkills = table.Column<string[]>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserProfiles", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "UserProfiles",
                columns: new[] { "Id", "BaseResumeText", "CoreSkills", "FullName" },
                values: new object[] { new Guid("11111111-1111-1111-1111-111111111111"), "Senior Full-Stack Developer with 3+ years of experience. At Infosys, I specialize in modernizing legacy systems and building scalable, cloud-native solutions using React, Angular, ASP.NET Core, C#, Node.js, AWS, and Azure. Strong focus on Gen AI integration and RAG architectures.", new[] { "React", "Angular", "C#", "ASP.NET Core", "Node.js", "AWS", "Azure", "Gen AI" }, "Tarigoppula Aashish Kumar" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "JobApplications");

            migrationBuilder.DropTable(
                name: "UserProfiles");
        }
    }
}
