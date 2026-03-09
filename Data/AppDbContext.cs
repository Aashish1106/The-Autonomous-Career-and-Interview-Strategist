using AutoJobStrategist.Api.Controllers;
using AutoJobStrategist.Api.Models;
using Microsoft.EntityFrameworkCore;
using Pgvector.EntityFrameworkCore;

namespace AutoJobStrategist.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<UserProfile> UserProfiles { get; set; }
        public DbSet<JobApplication> JobApplications { get; set; }
        public DbSet<EvaluationHistory> EvaluationHistories { get; set; }
        public DbSet<ResumeVectorChunk> ResumeVectorChunks { get; set; }
        public DbSet<SystemNotification> SystemNotifications { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Explicitly enable pgvector in the database schema
            modelBuilder.HasPostgresExtension("vector");

            modelBuilder.Entity<UserProfile>().HasData(
                new UserProfile
                {
                    Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    FullName = "Admin User",
                    BaseResumeText = "Awaiting deployment initialization. Please paste your complete resume via the Admin Settings dashboard to initialize the agentic vector space.",
                    CoreSkills = new[] { "Setup Required" },

                    // ---> Explicitly set static values to prevent EF Core timestamp panic <---
                    DailyTokensBurned = 0,
                    LastTokenReset = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                }
            );
        }
    }
}