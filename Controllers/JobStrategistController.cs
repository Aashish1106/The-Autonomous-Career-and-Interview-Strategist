using AutoJobStrategist.Api.Data;
using AutoJobStrategist.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Playwright;
using Microsoft.SemanticKernel;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;
using UglyToad.PdfPig;

namespace AutoJobStrategist.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class JobStrategistController : ControllerBase
    {
        private readonly Kernel _kernel;
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private static readonly HttpClient _httpClient = new HttpClient();

        public JobStrategistController(Kernel kernel, AppDbContext context, IConfiguration config)
        {
            _kernel = kernel;
            _context = context;
            _config = config;
        }

        // ---> THE NATIVE REST OVERRIDE FOR VECTOR EMBEDDINGS <---
        private async Task<float[]> GenerateEmbeddingNativelyAsync(string text)
        {
            var apiKey = _config["Google:ApiKey"];
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={apiKey}";

            var requestBody = new
            {
                model = "models/gemini-embedding-001",
                content = new { parts = new[] { new { text = text } } },
                outputDimensionality = 768
            };

            var response = await _httpClient.PostAsJsonAsync(url, requestBody);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new Exception($"Native API Crash: {error}");
            }

            var jsonDocument = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
            return jsonDocument.RootElement
                .GetProperty("embedding")
                .GetProperty("values")
                .EnumerateArray()
                .Select(e => e.GetSingle())
                .ToArray();
        }

        // -------------------------------------------------------------------
        // 1. GET: Fetch Existing Neural Identity
        // -------------------------------------------------------------------
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            try
            {
                var profile = await _context.UserProfiles.FirstOrDefaultAsync();

                if (profile == null)
                    return NotFound(new { message = "No profile found. Please initialize the Identity Matrix." });

                return Ok(profile);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Failed to retrieve Master Context: {ex.Message}");
            }
        }

        // -------------------------------------------------------------------
        // 2. PUT: Save & Sync Identity to Database (Merged with Vectors)
        // -------------------------------------------------------------------
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateMasterProfile([FromBody] UpdateProfileRequest request)
        {
            if (request == null) return BadRequest("Invalid profile payload.");

            // Hardcoded to your specific profile ID until JWT Auth is added
            var adminId = Guid.Parse("11111111-1111-1111-1111-111111111111");

            try
            {
                var profile = await _context.UserProfiles.FindAsync(adminId);

                if (profile == null)
                {
                    profile = new UserProfile { Id = adminId };
                    _context.UserProfiles.Add(profile);
                }

                // Map to your EXACT model properties (Handling the arrays properly)
                profile.FullName = request.FullName ?? "";
                profile.BaseResumeText = request.BaseResumeText ?? "";
                profile.CoreSkills = request.CoreSkills?.ToArray() ?? Array.Empty<string>();
                profile.StructuredResumeJson = JsonSerializer.Serialize(request.StructuredResumeJson);

                // Dynamically re-calculate the vector embedding for the new resume
                var myResumeContext = $@"
                Name: {profile.FullName}
                Experience: {profile.BaseResumeText}
                Core Skills: {string.Join(", ", profile.CoreSkills)}";

                var resumeVectorArray = await GenerateEmbeddingNativelyAsync(myResumeContext);
                profile.ResumeEmbedding = new Vector(resumeVectorArray);

                await _context.SaveChangesAsync();

                return Ok(new { message = "Master Context Updated & Vectorized Successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Database sync failed: {ex.Message}");
            }
        }

        // -------------------------------------------------------------------
        // 3. POST: PDF Neural Extractor
        // -------------------------------------------------------------------
        [HttpPost("parse-pdf")]
        public async Task<IActionResult> ParseResumePdf(IFormFile file)
        {
            if (file == null || file.Length == 0 || !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Please upload a valid PDF file.");

            try
            {
                var rawText = new System.Text.StringBuilder();
                using (var stream = file.OpenReadStream())
                using (var document = PdfDocument.Open(stream))
                {
                    foreach (var page in document.GetPages())
                    {
                        rawText.Append(page.Text);
                        rawText.Append(" ");
                    }
                }

                var promptTemplate = @"
                You are Jarvis, an elite technical recruiter and data architect. Analyze the following raw resume text and extract the key information into a highly structured JSON format. 
                
                CRITICAL INSTRUCTIONS:
                - Return ONLY valid JSON. Do not include markdown formatting (like ```json), and do not include conversational text.
                - You must accurately extract the person's full name.
                - Match this exact schema structure:
                {
                  ""fullName"": ""string"",
                  ""profileSummary"": ""string"",
                  ""coreSkills"": [""string""],
                  ""workExperience"": [{ ""company"": ""string"", ""role"": ""string"", ""duration"": ""string"", ""bullets"": [""string""] }],
                  ""education"": [{ ""institution"": ""string"", ""degree"": ""string"", ""duration"": ""string"" }],
                  ""projects"": [{ ""name"": ""string"", ""technologies"": [""string""], ""description"": ""string"" }],
                  ""certifications"": [""string""]
                }

                RAW TEXT:
                {{$resumeText}}";

                var arguments = new KernelArguments() { { "resumeText", rawText.ToString() } };
                var result = await _kernel.InvokePromptAsync(promptTemplate, arguments);
                var rawResponse = result.ToString();

                var startIndex = rawResponse.IndexOf('{');
                var endIndex = rawResponse.LastIndexOf('}');

                if (startIndex != -1 && endIndex != -1)
                {
                    var cleanJson = rawResponse.Substring(startIndex, endIndex - startIndex + 1);
                    var parsedJson = JsonSerializer.Deserialize<JsonElement>(cleanJson);
                    return Ok(parsedJson);
                }

                return StatusCode(500, "Agent failed to return valid JSON.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"PDF Parsing failed: {ex.Message}");
            }
        }

        // -------------------------------------------------------------------
        // 4. POST: Evaluate Job
        // -------------------------------------------------------------------
        [HttpPost("evaluate-job")]
        public async Task<IActionResult> EvaluateJobMatch([FromBody] EvaluateJobRequest request)
        {
            var userProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));

            if (userProfile == null) return NotFound("User profile not found in database.");

            var myResumeContext = $@"
            Name: {userProfile.FullName}
            Experience: {userProfile.BaseResumeText}
            Core Skills: {string.Join(", ", userProfile.CoreSkills)}";

            var promptTemplate = @"
            You are an elite technical recruiter and career strategist. 
            I am providing a candidate's resume and a target job description.
            Evaluate the match strictly based on technical skills and experience.
            
            Job Description: {{$jobText}}
            
            Candidate Resume: {{$resumeText}}

            IMPORTANT: You must return strictly valid JSON. 
            Do NOT wrap the response in markdown blocks (e.g., ```json). 
            Do NOT include any conversational text before or after the JSON. 

            The JSON MUST perfectly match this exact structure and use these exact keys:
            {
                ""job_details"": {
                    ""company"": ""Extracted Company Name"",
                    ""role"": ""Extracted Role Title"",
                    ""is_remote"": false
                },
                ""workflow_status"": ""Evaluating_Match"",
                ""evaluation"": {
                    ""match_percentage"": 85.5,
                    ""missing_skills"": [""Skill 1"", ""Skill 2""],
                    ""recommended_action"": ""Proceed to apply""
                }
            }";

            try
            {
                var arguments = new KernelArguments()
                {
                    { "jobText", request.JobDescriptionText },
                    { "resumeText", myResumeContext }
                };

                var result = await _kernel.InvokePromptAsync(promptTemplate, arguments);
                var rawResponse = result.ToString();

                var startIndex = rawResponse.IndexOf('{');
                var endIndex = rawResponse.LastIndexOf('}');

                if (startIndex != -1 && endIndex != -1)
                {
                    var cleanJson = rawResponse.Substring(startIndex, endIndex - startIndex + 1);
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var structuredState = JsonSerializer.Deserialize<ApplicationWorkflowState>(cleanJson, options);

                    if (structuredState?.JobDetails != null)
                    {
                        var jobVectorArray = await GenerateEmbeddingNativelyAsync(request.JobDescriptionText);
                        var resumeVectorArray = await GenerateEmbeddingNativelyAsync(myResumeContext);

                        var newApplication = new JobApplication
                        {
                            CompanyName = structuredState.JobDetails.Company ?? "Unknown",
                            RoleTitle = structuredState.JobDetails.Role ?? "Unknown",
                            JobUrl = request.JobUrl ?? "",
                            Status = structuredState.WorkflowStatus ?? "Discovered",
                            MatchScore = structuredState.Evaluation?.MatchPercentage ?? 0,
                            JobEmbedding = new Vector(jobVectorArray)
                        };

                        userProfile.ResumeEmbedding = new Vector(resumeVectorArray);

                        _context.JobApplications.Add(newApplication);
                        await _context.SaveChangesAsync();
                    }

                    return Ok(structuredState);
                }

                return StatusCode(500, $"Agent did not return a valid JSON object. Raw output: {rawResponse}");
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("429") || ex.Message.Contains("Too Many Requests") || ex.Message.Contains("quota"))
                {
                    return StatusCode(429, "API_EXHAUSTED: Jarvis token reserves are depleted for the day. Please try again tomorrow.");
                }

                return StatusCode(500, $"Agent failure: {ex.Message}");
            }
        }

        // -------------------------------------------------------------------
        // 5. GET: System Telemetry
        // -------------------------------------------------------------------
        [HttpGet("telemetry")]
        public async Task<IActionResult> GetSystemTelemetry()
        {
            try
            {
                // Count records across your system
                var totalJobsScraped = await _context.JobApplications.CountAsync();
                var totalJobsEmbedded = await _context.JobApplications.CountAsync(j => j.JobEmbedding != null);
                var totalVaultRecords = await _context.EvaluationHistories.CountAsync();
                var totalInterviews = await _context.EvaluationHistories.CountAsync(h => h.InterviewHistoryJson != null);

                var dbConnected = await _context.Database.CanConnectAsync();

                // ---> NEW: Token Ledger Logic <---
                // In the future, we will read this directly from your UserProfile table
                int dailyTokenBudget = 1000000; // Gemini Free Tier standard
                int tokensBurnedToday = 145230; // Mock value until we hook up the Semantic Kernel interceptor
                int tokensRemaining = dailyTokenBudget - tokensBurnedToday;

                // Calculate time until midnight (when quotas typically reset)
                var timeUntilReset = DateTime.UtcNow.Date.AddDays(1) - DateTime.UtcNow;
                string resetString = $"{(int)timeUntilReset.TotalHours}h {timeUntilReset.Minutes}m";

                return Ok(new
                {
                    status = dbConnected ? "Online" : "Offline",
                    vectorEngine = "pgvector (768-D) Active",
                    apiHealth = "Nominal",
                    lastPing = DateTime.UtcNow,
                    metrics = new
                    {
                        totalJobsScraped,
                        totalJobsEmbedded,
                        totalVaultRecords,
                        totalInterviews,
                        dailyTokenBudget,
                        tokensRemaining,
                        resetString
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Telemetry failure: {ex.Message}");
            }
        }

        // -------------------------------------------------------------------
        // THE REST OF YOUR ENDPOINTS (Unchanged, just cleaned up spacing)
        // -------------------------------------------------------------------

        [HttpGet("top-matches")]
        public async Task<IActionResult> GetTopSemanticMatches()
        {
            var userProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));

            if (userProfile?.ResumeEmbedding == null)
                return BadRequest("No resume embedding found. Please evaluate a job first!");

            var topJobsRaw = await _context.JobApplications
                .Where(j => j.JobEmbedding != null)
                .OrderBy(j => j.JobEmbedding!.CosineDistance(userProfile.ResumeEmbedding))
                .Select(j => new
                {
                    j.Id,
                    j.CompanyName,
                    j.RoleTitle,
                    j.Status,
                    j.MatchScore,
                    CosineDistance = j.JobEmbedding!.CosineDistance(userProfile.ResumeEmbedding)
                })
                .Take(20)
                .ToListAsync();

            var topJobs = topJobsRaw.Select(j =>
            {
                double rawSimilarity = 1 - j.CosineDistance;
                double minBounds = 0.50;
                double maxBounds = 0.75;
                double amplifiedScore = ((rawSimilarity - minBounds) / (maxBounds - minBounds)) * 100;
                double finalScore = Math.Max(0, Math.Min(99.9, amplifiedScore));

                return new
                {
                    j.Id,
                    j.CompanyName,
                    j.RoleTitle,
                    j.Status,
                    LlmMatchScore = j.MatchScore,
                    VectorMatchScore = Math.Round(finalScore, 1)
                };
            }).ToList();

            return Ok(topJobs);
        }

        [HttpPost("tailor-resume")]
        public async Task<IActionResult> TailorResume([FromBody] AgentTaskRequest request)
        {
            var userProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));

            if (userProfile == null) return NotFound("User profile not found.");

            var myResumeContext = $@"Experience: {userProfile.BaseResumeText}\nCore Skills: {string.Join(", ", userProfile.CoreSkills)}";

            string customInstructionBlock = string.IsNullOrWhiteSpace(request.UserInstruction) ? "" : $@"
            USER CUSTOM INSTRUCTION: ""{request.UserInstruction}""
            GATEKEEPER RULE: Evaluate the user's custom instruction. If it is a bad strategic move, reject it gently in `coach_feedback` and set `is_instruction_accepted` to false.";

            var promptTemplate = @"
            You are an elite technical resume writer. Review the candidate's resume and target job description.
            For each distinct FULL sentence or bullet point, generate 3 tailored variations.
            
            Job Description: {{$jobText}}
            Candidate Resume: {{$resumeText}}
            " + customInstructionBlock + @"
            
            Return strictly valid JSON:
            {
                ""is_instruction_accepted"": true,
                ""coach_feedback"": null,
                ""suggestions"": [
                    {
                        ""original_bullet"": ""..."",
                        ""variations"": [ { ""focus"": ""..."", ""text"": ""..."" } ],
                        ""best_variation_index"": 0,
                        ""jarvis_reasoning"": ""...""
                    }
                ]
            }";

            try
            {
                var arguments = new KernelArguments() { { "jobText", request.JobDescription }, { "resumeText", myResumeContext } };
                var result = await _kernel.InvokePromptAsync(promptTemplate, arguments);
                var rawResponse = result.ToString();

                var startIndex = rawResponse.IndexOf('{');
                var endIndex = rawResponse.LastIndexOf('}');
                if (startIndex != -1 && endIndex != -1)
                {
                    var cleanJson = rawResponse.Substring(startIndex, endIndex - startIndex + 1);
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    return Ok(JsonSerializer.Deserialize<TailoredResumeState>(cleanJson, options));
                }
                return StatusCode(500, "Agent failed to return valid JSON.");
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("429")) return StatusCode(429, "API_EXHAUSTED");
                return StatusCode(500, $"Agent failure: {ex.Message}");
            }
        }

        [HttpPost("generate-cover-letter")]
        public async Task<IActionResult> GenerateCoverLetter([FromBody] AgentTaskRequest request)
        {
            var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));
            if (userProfile == null) return NotFound("User profile not found.");

            string candidateProfile = $@"Name: {userProfile.FullName}\nExperience: {userProfile.BaseResumeText}\nCore Skills: {string.Join(", ", userProfile.CoreSkills)}";
            string customInstructionBlock = string.IsNullOrWhiteSpace(request.UserInstruction) ? "" : $@"USER CUSTOM INSTRUCTION: ""{request.UserInstruction}""";

            var prompt = $@"
            You are an elite Executive Career Coach. Write a 3-paragraph cover letter.
            CANDIDATE PROFILE: {candidateProfile}
            TARGET JOB: {request.JobDescription}
            {customInstructionBlock}
            
            Return strictly valid JSON:
            {{ ""is_instruction_accepted"": true, ""coach_feedback"": null, ""cover_letter"": ""..."" }}";

            try
            {
                var result = await _kernel.InvokePromptAsync(prompt);
                var rawResponse = result.ToString();
                var startIndex = rawResponse.IndexOf('{');
                var endIndex = rawResponse.LastIndexOf('}');

                if (startIndex != -1 && endIndex != -1)
                {
                    var cleanJson = rawResponse.Substring(startIndex, endIndex - startIndex + 1);
                    var state = JsonSerializer.Deserialize<CoverLetterState>(cleanJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (string.IsNullOrWhiteSpace(request.UserInstruction) && state != null) state.IsInstructionAccepted = true;
                    return Ok(state);
                }
                return StatusCode(500, "Agent failed to return valid JSON.");
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("429")) return StatusCode(429, "API_EXHAUSTED");
                return StatusCode(500, $"Agent failure: {ex.Message}");
            }
        }

        [HttpPost("scrape-url")]
        public async Task<IActionResult> ScrapeJobUrl([FromBody] string url)
        {
            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out _)) return BadRequest("Invalid URL format.");

            try
            {
                using var playwright = await Playwright.CreateAsync();
                await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = true });
                var page = await browser.NewPageAsync(new BrowserNewPageOptions { UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36" });

                var response = await page.GotoAsync(url, new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded });
                await page.WaitForTimeoutAsync(3000);
                var initialText = await page.InnerTextAsync("body");

                if (response?.Status == 403 || initialText.Contains("Access Denied") || initialText.Contains("Cloudflare"))
                    return StatusCode(403, "WAF_BLOCKED: Jarvis encountered a firewall.");

                var finalCleanText = await page.InnerTextAsync("body");
                var formattedText = System.Text.RegularExpressions.Regex.Replace(finalCleanText, @"\s+", " ").Trim();

                byte[] screenshotBytes = await page.ScreenshotAsync(new PageScreenshotOptions { Type = ScreenshotType.Jpeg, Quality = 80 });
                string base64Image = Convert.ToBase64String(screenshotBytes);

                return Ok(new { scrapedText = formattedText, screenshotBase64 = base64Image });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Agent Scraper failed: {ex.Message}");
            }
        }

        [HttpPost("generate-interview-questions")]
        public async Task<IActionResult> GenerateInterviewQuestions([FromBody] InterviewGenerationRequest request)
        {
            var userProfile = await _context.UserProfiles.FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));
            if (userProfile == null) return NotFound("User profile not found.");

            var myResumeContext = $@"Experience: {userProfile.BaseResumeText}\nCore Skills: {string.Join(", ", userProfile.CoreSkills)}";
            var promptTemplate = @"You are an elite interviewer. Generate 10 highly specific, challenging interview questions based on the candidate's skills and the job.
            Job: {{$jobText}}
            Resume: {{$resumeText}}
            Return strictly JSON: { ""questions"": [ { ""focus_area"": """", ""question_text"": """", ""ideal_concept_to_mention"": """" } ] }";

            try
            {
                var arguments = new KernelArguments() { { "jobText", request.JobDescription }, { "resumeText", myResumeContext } };
                var result = await _kernel.InvokePromptAsync(promptTemplate, arguments);
                var rawResponse = result.ToString();

                var startIndex = rawResponse.IndexOf('{');
                var endIndex = rawResponse.LastIndexOf('}');
                if (startIndex != -1 && endIndex != -1)
                {
                    var cleanJson = rawResponse.Substring(startIndex, endIndex - startIndex + 1);
                    return Ok(JsonSerializer.Deserialize<InterviewQuestionState>(cleanJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }));
                }
                return StatusCode(500, "Agent failed to return valid JSON.");
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("429")) return StatusCode(429, new { error = "RATE_LIMIT_EXHAUSTED" });
                return StatusCode(500, $"Interview Generation Failed: {ex.Message}");
            }
        }

        [HttpPost("evaluate-interview-answer")]
        public async Task<IActionResult> EvaluateInterviewAnswer([FromBody] EvaluateAnswerRequest request)
        {
            var promptTemplate = @"Evaluate the candidate's answer. Be brutally honest.
            Job Context: {{$jobText}}
            Question Asked: {{$questionText}}
            Candidate's Answer: {{$userAnswer}}
            Return strictly JSON: { ""score"": 85, ""feedback"": """", ""better_answer_example"": """", ""recommended_resources"": [ { ""platform"": """", ""topic"": """", ""search_query"": """" } ] }";

            try
            {
                var arguments = new KernelArguments() { { "jobText", request.JobDescription }, { "questionText", request.QuestionText }, { "userAnswer", request.UserAnswer } };
                var result = await _kernel.InvokePromptAsync(promptTemplate, arguments);
                var rawResponse = result.ToString();

                var startIndex = rawResponse.IndexOf('{');
                var endIndex = rawResponse.LastIndexOf('}');
                if (startIndex != -1 && endIndex != -1)
                {
                    var cleanJson = rawResponse.Substring(startIndex, endIndex - startIndex + 1);
                    return Ok(JsonSerializer.Deserialize<AnswerEvaluationState>(cleanJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }));
                }
                return StatusCode(500, "Agent failed to return valid JSON.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Evaluation Failed: {ex.Message}");
            }
        }

        [HttpPost("save-history")]
        public async Task<IActionResult> SaveToHistory([FromBody] SaveHistoryRequest request)
        {
            var userId = Guid.Parse("11111111-1111-1111-1111-111111111111");

            try
            {
                EvaluationHistory record;
                if (request.JobId.HasValue && request.JobId != Guid.Empty)
                {
                    record = await _context.EvaluationHistories.FindAsync(request.JobId.Value);
                    if (record == null) return NotFound("Job record not found.");
                    record.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    record = new EvaluationHistory { UserId = userId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
                    _context.EvaluationHistories.Add(record);
                }

                record.JobUrl = request.Url;
                record.JobDescription = request.JobDescription;

                if (request.Evaluation.HasValue && request.Evaluation.Value.ValueKind != JsonValueKind.Null)
                {
                    record.EvaluationJson = request.Evaluation.Value.ToString();
                    if (request.Evaluation.Value.TryGetProperty("companyName", out var companyProp)) record.CompanyName = companyProp.GetString();
                    if (request.Evaluation.Value.TryGetProperty("roleTitle", out var roleProp)) record.RoleTitle = roleProp.GetString();
                    if (request.Evaluation.Value.TryGetProperty("matchScore", out var scoreProp)) record.MatchScore = (int)Math.Round(scoreProp.GetDouble());
                }

                if (!string.IsNullOrWhiteSpace(request.CoverLetter)) record.CoverLetterText = request.CoverLetter;
                if (request.TailoredSuggestions.HasValue && request.TailoredSuggestions.Value.ValueKind != JsonValueKind.Null) record.TailoredResumeJson = request.TailoredSuggestions.Value.ToString();
                if (request.InterviewHistory.HasValue && request.InterviewHistory.Value.ValueKind != JsonValueKind.Null) record.InterviewHistoryJson = request.InterviewHistory.Value.ToString();

                await _context.SaveChangesAsync();
                return Ok(new { message = "Successfully saved to Vault.", jobId = record.Id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Failed to save history: {ex.Message}");
            }
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetEvaluationHistory()
        {
            var userId = Guid.Parse("11111111-1111-1111-1111-111111111111");
            try
            {
                var history = await _context.EvaluationHistories.Where(h => h.UserId == userId).OrderByDescending(h => h.UpdatedAt).ToListAsync();
                return Ok(history);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Failed to fetch history: {ex.Message}");
            }
        }

        [HttpDelete("history/{id}")]
        public async Task<IActionResult> DeleteHistoryRecord(Guid id)
        {
            try
            {
                var record = await _context.EvaluationHistories.FindAsync(id);
                if (record == null) return NotFound("Record not found.");
                _context.EvaluationHistories.Remove(record);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Snapshot purged from Vault." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Failed to delete history: {ex.Message}");
            }
        }

        [HttpPatch("history/{id}/upgrade")]
        public async Task<IActionResult> UpgradeHistoryRecord(Guid id, [FromBody] UpgradeHistoryRequest request)
        {
            var record = await _context.EvaluationHistories.FindAsync(id);
            if (record == null) return NotFound("Vault record not found.");

            if (!string.IsNullOrWhiteSpace(request.JobDescription)) record.JobDescription = request.JobDescription;
            if (!string.IsNullOrWhiteSpace(request.JobUrl)) record.JobUrl = request.JobUrl;
            if (!string.IsNullOrWhiteSpace(request.CompanyName)) record.CompanyName = request.CompanyName;
            if (!string.IsNullOrWhiteSpace(request.RoleTitle)) record.RoleTitle = request.RoleTitle;

            record.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(record);
        }
    }

    // ---> ENFORCED DATA CONTRACTS (DTOs) <---

    // NEW: Added missing classes for the Job Evaluation output
    public class ApplicationWorkflowState
    {
        [JsonPropertyName("job_details")]
        public JobDetails? JobDetails { get; set; }

        [JsonPropertyName("workflow_status")]
        public string? WorkflowStatus { get; set; }

        [JsonPropertyName("evaluation")]
        public EvaluationDetails? Evaluation { get; set; }
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

    public class EvaluationDetails
    {
        [JsonPropertyName("match_percentage")]
        public double MatchPercentage { get; set; }

        [JsonPropertyName("missing_skills")]
        public List<string>? MissingSkills { get; set; }

        [JsonPropertyName("recommended_action")]
        public string? RecommendedAction { get; set; }
    }

    public class AgentTaskRequest
    {
        public string JobDescription { get; set; } = string.Empty;
        public string? UserInstruction { get; set; }
    }

    public class EvaluateJobRequest
    {
        public string JobDescriptionText { get; set; } = string.Empty;
        public string? JobUrl { get; set; }
    }

    public class CoverLetterState
    {
        [JsonPropertyName("is_instruction_accepted")]
        public bool IsInstructionAccepted { get; set; }

        [JsonPropertyName("coach_feedback")]
        public string? CoachFeedback { get; set; }

        [JsonPropertyName("cover_letter")]
        public string? CoverLetter { get; set; }
    }

    public class TailoredResumeState
    {
        [JsonPropertyName("is_instruction_accepted")]
        public bool IsInstructionAccepted { get; set; } = true;

        [JsonPropertyName("coach_feedback")]
        public string? CoachFeedback { get; set; }

        [JsonPropertyName("suggestions")]
        public List<SuggestionItem> Suggestions { get; set; } = new();
    }

    public class SuggestionItem
    {
        [JsonPropertyName("original_bullet")]
        public string OriginalBullet { get; set; } = string.Empty;

        [JsonPropertyName("variations")]
        public List<VariationItem> Variations { get; set; } = new();

        [JsonPropertyName("best_variation_index")]
        public int BestVariationIndex { get; set; }

        [JsonPropertyName("jarvis_reasoning")]
        public string JarvisReasoning { get; set; } = string.Empty;
    }

    public class VariationItem
    {
        [JsonPropertyName("focus")]
        public string Focus { get; set; } = string.Empty;

        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;
    }

    // Note: Ideally move this to your Models folder alongside UserProfile
    public class EvaluationHistory
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string? CompanyName { get; set; }
        public string? RoleTitle { get; set; }
        public string? JobUrl { get; set; }
        public string? JobDescription { get; set; }
        public int MatchScore { get; set; }
        public string? EvaluationJson { get; set; }
        public string? TailoredResumeJson { get; set; }
        public string? CoverLetterText { get; set; }
        public string? InterviewHistoryJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class SaveHistoryRequest
    {
        public Guid? JobId { get; set; }
        public string? Url { get; set; }
        public string? JobDescription { get; set; }
        public JsonElement? Evaluation { get; set; }
        public string? CoverLetter { get; set; }
        public JsonElement? TailoredSuggestions { get; set; }
        public JsonElement? InterviewHistory { get; set; }
    }

    public class UpdateProfileRequest
    {
        public string? FullName { get; set; }
        public string? BaseResumeText { get; set; }
        public List<string>? CoreSkills { get; set; }
        public object? StructuredResumeJson { get; set; }
    }

    public class InterviewGenerationRequest
    {
        public string JobDescription { get; set; } = string.Empty;
    }

    public class InterviewQuestionState
    {
        [JsonPropertyName("questions")]
        public List<InterviewQuestion> Questions { get; set; } = new();
    }

    public class InterviewQuestion
    {
        [JsonPropertyName("focus_area")]
        public string FocusArea { get; set; } = string.Empty;

        [JsonPropertyName("question_text")]
        public string QuestionText { get; set; } = string.Empty;

        [JsonPropertyName("ideal_concept_to_mention")]
        public string IdealConceptToMention { get; set; } = string.Empty;
    }

    public class EvaluateAnswerRequest
    {
        public string QuestionText { get; set; } = string.Empty;
        public string UserAnswer { get; set; } = string.Empty;
        public string JobDescription { get; set; } = string.Empty;
    }

    public class AnswerEvaluationState
    {
        [JsonPropertyName("score")]
        public int Score { get; set; }

        [JsonPropertyName("feedback")]
        public string Feedback { get; set; } = string.Empty;

        [JsonPropertyName("better_answer_example")]
        public string BetterAnswerExample { get; set; } = string.Empty;

        [JsonPropertyName("recommended_resources")]
        public List<RecommendedResource> RecommendedResources { get; set; } = new();
    }

    public class RecommendedResource
    {
        [JsonPropertyName("platform")]
        public string Platform { get; set; } = string.Empty;

        [JsonPropertyName("topic")]
        public string Topic { get; set; } = string.Empty;

        [JsonPropertyName("search_query")]
        public string SearchQuery { get; set; } = string.Empty;
    }

    public class UpgradeHistoryRequest
    {
        public string? JobDescription { get; set; }
        public string? JobUrl { get; set; }
        public string? CompanyName { get; set; }
        public string? RoleTitle { get; set; }
    }
}