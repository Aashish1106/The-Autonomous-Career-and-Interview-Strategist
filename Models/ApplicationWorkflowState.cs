using System.Text.Json.Serialization;

namespace AutoJobStrategist.Api.Models
{
    public class ApplicationWorkflowState
    {
        [JsonPropertyName("job_details")]
        public JobDetails? JobDetails { get; set; }

        [JsonPropertyName("workflow_status")]
        public string? WorkflowStatus { get; set; }

        [JsonPropertyName("evaluation")]
        public Evaluation? Evaluation { get; set; }
    }

    public class JobDetails
    {
        [JsonPropertyName("company")]
        public string? Company { get; set; }

        [JsonPropertyName("role")]
        public string? Role { get; set; }

        [JsonPropertyName("is_remote")]
        public bool IsRemote { get; set; }
    }

    public class Evaluation
    {
        [JsonPropertyName("match_percentage")]
        public double MatchPercentage { get; set; }

        [JsonPropertyName("missing_skills")]
        public List<string>? MissingSkills { get; set; }

        [JsonPropertyName("recommended_action")]
        public string? RecommendedAction { get; set; }
    }
}