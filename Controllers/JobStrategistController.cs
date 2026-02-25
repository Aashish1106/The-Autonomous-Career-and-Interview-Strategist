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
using System.Text.RegularExpressions;

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

        // --->  THE TOKEN TOLLBOOTH <---
        private async Task TrackTokenUsageAsync(FunctionResult result, string promptText)
        {
            try
            {
                var adminId = Guid.Parse("11111111-1111-1111-1111-111111111111");
                var profile = await _context.UserProfiles.FindAsync(adminId);
                if (profile == null) return;

                // 1. Check if it's a new day. If so, reset the ledger.
                if (DateTime.UtcNow.Date > profile.LastTokenReset.Date)
                {
                    profile.DailyTokensBurned = 0;
                    profile.LastTokenReset = DateTime.UtcNow;
                }

                // 2. Calculate Tokens
                // Semantic Kernel's Gemini Connector doesn't always expose the Usage object cleanly in preview builds.
                // As a bulletproof enterprise standard, we use the universally accepted LLM token estimation formula:
                // 1 Token ≈ 4 Characters (English text).

                string responseText = result.GetValue<string>() ?? "";
                int promptTokens = promptText.Length / 4;
                int completionTokens = responseText.Length / 4;
                int totalTokens = promptTokens + completionTokens;

                // 3. Update the Database
                profile.DailyTokensBurned += totalTokens;

                // Save silently without disrupting the main thread
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Never crash the main API response just because telemetry failed
                Console.WriteLine($"Token tracking failed: {ex.Message}");
            }
        }

        // ---> PDF TEXT SANITIZER <---
        private string SanitizePdfText(string rawText)
        {
            if (string.IsNullOrWhiteSpace(rawText)) return string.Empty;

            // 1. Strip out null bytes and unprintable PDF ghost characters
            string cleaned = rawText.Replace("\0", " ");

            // 2. Squash massive whitespace gaps (turns 50 blank lines into 1 space)
            cleaned = Regex.Replace(cleaned, @"\s+", " ");

            return cleaned.Trim();
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
        public async Task<IActionResult> ParseResumePdf([FromForm] PdfUploadRequest request)
        {
            // Map the file from the request
            var file = request.File;

            // 1. Strict File Format Validation
            if (file == null || file.Length == 0 || !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Please upload a valid PDF file.");

            try
            {
                var rawTextBuilder = new System.Text.StringBuilder();
                using (var stream = file.OpenReadStream())
                using (var document = UglyToad.PdfPig.PdfDocument.Open(stream))
                {
                    foreach (var page in document.GetPages())
                    {
                        rawTextBuilder.Append(page.Text);
                        rawTextBuilder.Append(" ");
                    }
                }

                // ---> THE SAFEGUARD PROTOCOL <---
                // Wash the text through the sanitizer to remove ghost characters
                string extractedText = SanitizePdfText(rawTextBuilder.ToString());

                // Safeguard 1: Image-only PDF block
                if (string.IsNullOrWhiteSpace(extractedText))
                {
                    return BadRequest("Could not extract readable text. Ensure the PDF is not a scanned image.");
                }

                // Safeguard 2: The Token Bomb block (Prevents API crashes)
                if (extractedText.Length > 30000)
                {
                    return BadRequest("PDF exceeds maximum allowed length. Please upload a standard resume under 10 pages.");
                }

                var promptTemplate = @"
        You are ACE, an elite technical recruiter and data architect. Analyze the following raw resume text and extract the key information into a highly structured JSON format. 
        
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

                // Pass the *sanitized* text to the AI
                var arguments = new KernelArguments() { { "resumeText", extractedText } };
                var result = await _kernel.InvokePromptAsync(promptTemplate, arguments);

                // Log the exact token burn
                await TrackTokenUsageAsync(result, promptTemplate);

                var rawResponse = result.ToString();

                var startIndex = rawResponse.IndexOf('{');
                var endIndex = rawResponse.LastIndexOf('}');

                if (startIndex != -1 && endIndex != -1)
                {
                    var cleanJson = rawResponse.Substring(startIndex, endIndex - startIndex + 1);
                    var parsedJson = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(cleanJson);
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
                await TrackTokenUsageAsync(result, promptTemplate);
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
                    return StatusCode(429, "API_EXHAUSTED: ACE token reserves are depleted for the day. Please try again tomorrow.");
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
                // Run the Micro-Ping to test Google's servers
                var currentApiHealth = await CheckApiHealthAsync();

                // Volume Metrics
                var totalJobsScraped = await _context.JobApplications.CountAsync();
                var totalJobsEmbedded = await _context.JobApplications.CountAsync(j => j.JobEmbedding != null);
                var totalVaultRecords = await _context.EvaluationHistories.CountAsync();
                var totalInterviews = await _context.EvaluationHistories.CountAsync(h => h.InterviewHistoryJson != null);

                // Database Health
                var dbConnected = await _context.Database.CanConnectAsync();

                // ---> DYNAMIC VECTOR ENGINE CHECK <---
                string vectorStatus = "Offline";
                if (dbConnected)
                {
                    try
                    {
                        var conn = _context.Database.GetDbConnection();
                        await conn.OpenAsync();
                        using var cmd = conn.CreateCommand();
                        cmd.CommandText = "SELECT 1 FROM pg_extension WHERE extname = 'vector'";
                        var result = await cmd.ExecuteScalarAsync();

                        if (result != null)
                            vectorStatus = "pgvector (768-D): Active";
                        else
                            vectorStatus = "pgvector (768-D): Missing";

                        await conn.CloseAsync();
                    }
                    catch
                    {
                        vectorStatus = "Query Failed";
                    }
                }

                // Token Ledger Math
                int dailyTokenBudget = 1000000; // Gemini Free Tier standard
                var profile = await _context.UserProfiles.FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));

                // If the user hasn't made an API call yet today, we handle the reset logic on read as well
                if (profile != null && DateTime.UtcNow.Date > profile.LastTokenReset.Date)
                {
                    profile.DailyTokensBurned = 0;
                    profile.LastTokenReset = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                int tokensBurnedToday = profile?.DailyTokensBurned ?? 0;
                int tokensRemaining = Math.Max(0, dailyTokenBudget - tokensBurnedToday);

                // Calculate time until midnight (when quotas typically reset)
                var timeUntilReset = DateTime.UtcNow.Date.AddDays(1) - DateTime.UtcNow;
                string resetString = $"{(int)timeUntilReset.TotalHours}h {timeUntilReset.Minutes}m";

                return Ok(new
                {
                    status = dbConnected ? "Online" : "Offline",
                    vectorEngine = vectorStatus,
                    apiHealth = currentApiHealth,
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

        // ---> THE API HEALTH MICRO-PING <---
        private async Task<string> CheckApiHealthAsync()
        {
            try
            {
                // Send a 3-token heartbeat check to Google's servers
                await _kernel.InvokePromptAsync("Ping. Reply OK.");
                return "Nominal";
            }
            catch (Exception ex) when (ex.Message.Contains("429") || ex.Message.Contains("quota") || ex.Message.Contains("Too Many Requests"))
            {
                return "Rate Limited (429)";
            }
            catch (Exception)
            {
                return "API Outage (Offline)";
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
                        ""ACE_reasoning"": ""...""
                    }
                ]
            }";

            try
            {
                var arguments = new KernelArguments() { { "jobText", request.JobDescription }, { "resumeText", myResumeContext } };
                var result = await _kernel.InvokePromptAsync(promptTemplate, arguments);
                await TrackTokenUsageAsync(result, promptTemplate);
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
                await TrackTokenUsageAsync(result, prompt);
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
                    return StatusCode(403, "WAF_BLOCKED: ACE encountered a firewall.");

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
                await TrackTokenUsageAsync(result, promptTemplate);
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
                await TrackTokenUsageAsync(result, promptTemplate);
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

        // -------------------------------------------------------------------
        // AUTOMATION HUB: GET BOT CONFIG (Zero Trust & Masked Email)
        // -------------------------------------------------------------------
        [HttpGet("bot-config")]
        public async Task<IActionResult> GetBotConfig()
        {
            try
            {
                var profile = await _context.UserProfiles.FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));
                if (profile == null) return NotFound("Profile not found.");

                string aesKey = _config["Security:AesMasterKey"];

                // 1. Decrypt the email
                string decryptedEmail = string.IsNullOrWhiteSpace(profile.EncryptedLinkedInEmail)
                    ? ""
                    : Utilities.EncryptionHelper.Decrypt(profile.EncryptedLinkedInEmail, aesKey);

                // 2. Create the Email Mask (e.g., a****@example.com)
                string emailMask = "";
                if (!string.IsNullOrWhiteSpace(decryptedEmail))
                {
                    var parts = decryptedEmail.Split('@');
                    if (parts.Length == 2 && parts[0].Length > 0)
                    {
                        emailMask = $"{parts[0][0]}****@{parts[1]}";
                    }
                    else
                    {
                        emailMask = "********"; // Fallback if it's a weirdly formatted string
                    }
                }

                // 3. Password Mask
                string passwordMask = string.IsNullOrWhiteSpace(profile.EncryptedLinkedInPassword) ? "" : "********";

                return Ok(new
                {
                    linkedInEmail = emailMask, // <--- Send the mask, NOT the decrypted email
                    linkedInPassword = passwordMask,
                    dailyLimit = profile.DailyApplicationLimit,
                    headlessMode = profile.HeadlessMode,
                    matchThreshold = profile.MatchThreshold
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Failed to fetch bot config: {ex.Message}");
            }
        }

        // -------------------------------------------------------------------
        // AUTOMATION HUB: UPDATE BOT CONFIG (AES-256)
        // -------------------------------------------------------------------
        [HttpPut("bot-config")]
        public async Task<IActionResult> UpdateBotConfig([FromBody] BotConfigRequest request)
        {
            try
            {
                var profile = await _context.UserProfiles.FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));
                if (profile == null) return NotFound("Profile not found.");

                string aesKey = _config["Security:AesMasterKey"];

                // Encrypt Email
                if (!string.IsNullOrWhiteSpace(request.LinkedInEmail))
                    profile.EncryptedLinkedInEmail = Utilities.EncryptionHelper.Encrypt(request.LinkedInEmail, aesKey);

                // Only encrypt and save the password if the user actually typed a new one. 
                // If the payload says "********", they didn't change it, so ignore it!
                if (!string.IsNullOrWhiteSpace(request.LinkedInPassword) && request.LinkedInPassword != "********")
                {
                    profile.EncryptedLinkedInPassword = Utilities.EncryptionHelper.Encrypt(request.LinkedInPassword, aesKey);
                }

                profile.DailyApplicationLimit = request.DailyLimit;
                profile.HeadlessMode = request.HeadlessMode;
                profile.MatchThreshold = request.MatchThreshold;

                await _context.SaveChangesAsync();

                return Ok(new { message = "Automation protocols locked and heavily encrypted." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Encryption failed: {ex.Message}");
            }
        }
    }

    // ---> ENFORCED DATA CONTRACTS (DTOs) <---

    // Added missing classes for the Job Evaluation output
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

        [JsonPropertyName("ACE_reasoning")]
        public string ACEReasoning { get; set; } = string.Empty;
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
    public class BotConfigRequest
    {
        public string? LinkedInEmail { get; set; }
        public string? LinkedInPassword { get; set; }
        public int DailyLimit { get; set; }
        public bool HeadlessMode { get; set; }
        public int MatchThreshold { get; set; }
    }
}