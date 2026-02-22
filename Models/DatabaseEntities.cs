using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Pgvector;

namespace AutoJobStrategist.Api.Models
{
    public class UserProfile
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public string FullName { get; set; } = string.Empty;

        public string BaseResumeText { get; set; } = string.Empty;

        public string[] CoreSkills { get; set; } = Array.Empty<string>();

        // This will hold the mathematical representation of your resume
        [Column(TypeName = "vector(768)")]
        public Vector? ResumeEmbedding { get; set; }

        public string? StructuredResumeJson { get; set; }
    }

    public class JobApplication
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public string CompanyName { get; set; } = string.Empty;

        public string RoleTitle { get; set; } = string.Empty;

        // This will be the URL we scrape later
        public string JobUrl { get; set; } = string.Empty;

        public string Status { get; set; } = "Discovered";

        public double MatchScore { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // This will hold the mathematical representation of the job description
        [Column(TypeName = "vector(768)")]
        public Vector? JobEmbedding { get; set; }
    }
}