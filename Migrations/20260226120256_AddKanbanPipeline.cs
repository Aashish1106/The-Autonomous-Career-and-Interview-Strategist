using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AutoJobStrategist.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddKanbanPipeline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AppliedDate",
                table: "EvaluationHistories",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BotErrorMessage",
                table: "EvaluationHistories",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PipelineStage",
                table: "EvaluationHistories",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AppliedDate",
                table: "EvaluationHistories");

            migrationBuilder.DropColumn(
                name: "BotErrorMessage",
                table: "EvaluationHistories");

            migrationBuilder.DropColumn(
                name: "PipelineStage",
                table: "EvaluationHistories");
        }
    }
}
