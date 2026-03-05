using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Pgvector;


namespace AutoJobStrategist.Api.Models
{
    public class ResumeVectorChunk
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid UserId { get; set; }

        public string ChunkType { get; set; } = string.Empty; // e.g., "Skills", "Experience", "Summary"

        public string Content { get; set; } = string.Empty; // The actual raw text

        // ---> THIS IS THE MAGIC PROPERTY <---
        // This holds the 768 floating point numbers from Google Gemini
        [Column(TypeName = "vector(768)")]
        public Vector? Embedding { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

