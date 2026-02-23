using AutoJobStrategist.Api.Data;
using AutoJobStrategist.Api.Models;
using Azure.Core;
using HtmlAgilityPack;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Playwright;
using Microsoft.SemanticKernel;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using System.Collections.Generic;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization; // <-- This lets us force exact JSON names
using System.Text.RegularExpressions;
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

        // ---> THE NATIVE REST OVERRIDE <---
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
        // -----------------------------------

        [HttpPut("profile")]
        public async Task<IActionResult> UpdateAdminProfile([FromBody] UpdateProfileRequest request)
        {
            // Hardcoded to your specific profile ID until we add JWT Auth
            var adminId = Guid.Parse("11111111-1111-1111-1111-111111111111");

            try
            {
                var userProfile = await _context.UserProfiles.FindAsync(adminId);

                if (userProfile == null)
                    return NotFound("Admin profile not found.");

                // Update the raw text
                userProfile.FullName = request.FullName;
                userProfile.BaseResumeText = request.BaseResumeText;
                userProfile.CoreSkills = request.CoreSkills;

                // Save the new massive ATS JSON object to the DB
                if (request.StructuredResumeJson.HasValue && request.StructuredResumeJson.Value.ValueKind != System.Text.Json.JsonValueKind.Null)
                {
                    userProfile.StructuredResumeJson = request.StructuredResumeJson.Value.ToString();
                }

                // Dynamically re-calculate the vector embedding for the new resume
                var myResumeContext = $@"
        Name: {userProfile.FullName}
        Experience: {userProfile.BaseResumeText}
        Core Skills: {string.Join(", ", userProfile.CoreSkills)}";

                var resumeVectorArray = await GenerateEmbeddingNativelyAsync(myResumeContext);
                userProfile.ResumeEmbedding = new Vector(resumeVectorArray);

                // EF Core automatically tracks the state change and fires the SQL UPDATE
                await _context.SaveChangesAsync();

                return Ok(new { message = "Admin profile successfully updated and vectorized." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Failed to update profile: {ex.Message}");
            }
        }

        [HttpPost("parse-pdf")]
        public async Task<IActionResult> ParseResumePdf(IFormFile file)
        {
            if (file == null || file.Length == 0 || !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Please upload a valid PDF file.");

            try
            {
                // 1. Crack open the PDF and extract raw, messy text
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

                // 2. The Semantic Kernel JSON Schema Prompt
                var promptTemplate = @"
        You are an elite ATS (Applicant Tracking System) parser.
        I will provide raw, messy text extracted from a PDF resume.
        You must organize this text into a strict, highly structured JSON object.

        RAW TEXT:
        {{$resumeText}}

        IMPORTANT: Return STRICTLY valid JSON. Do not wrap in markdown block quotes.
        The JSON MUST match this exact schema:
        {
            ""profileSummary"": ""Extracted summary or objective"",
            ""contactDetails"": {
                ""email"": ""..."",
                ""phone"": ""..."",
                ""location"": ""...""
            },
            ""links"": [""url1"", ""url2""],
            ""coreSkills"": [""skill1"", ""skill2""],
            ""workExperience"": [
                {
                    ""company"": ""..."",
                    ""role"": ""..."",
                    ""duration"": ""..."",
                    ""bullets"": [""bullet 1"", ""bullet 2""]
                }
            ],
            ""education"": [
                {
                    ""institution"": ""..."",
                    ""degree"": ""..."",
                    ""duration"": ""...""
                }
            ],
            ""projects"": [
                {
                    ""name"": ""..."",
                    ""technologies"": [""tech1""],
                    ""description"": ""...""
                }
            ],
            ""certifications"": [""cert1"", ""cert2""]
        }";

                var arguments = new KernelArguments() { { "resumeText", rawText.ToString() } };

                // Use GetUserKernel() here if you implemented the BYOK logic, otherwise use _kernel
                var result = await _kernel.InvokePromptAsync(promptTemplate, arguments);
                var rawResponse = result.ToString();

                // 3. Clean and parse the LLM output
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

            // ---> SAFE PROMPT: No '$', uses {{$variable}}, and single braces for JSON <---
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
                // ---> Injecting risky text safely <---
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
                return StatusCode(500, $"Agent failure: {ex.Message}");
            }
        }

        
        [HttpGet("top-matches")]
        public async Task<IActionResult> GetTopSemanticMatches()
        {
            var userProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));

            if (userProfile?.ResumeEmbedding == null)
                return BadRequest("No resume embedding found. Please evaluate a job first!");

            var topJobs = await _context.JobApplications
                .Where(j => j.JobEmbedding != null)
                .OrderBy(j => j.JobEmbedding!.CosineDistance(userProfile.ResumeEmbedding))
                .Select(j => new
                {
                    j.Id,
                    j.CompanyName,
                    j.RoleTitle,
                    j.Status,
                    VectorMatchScore = Math.Round((1 - j.JobEmbedding!.CosineDistance(userProfile.ResumeEmbedding)) * 100, 1),
                    LlmMatchScore = j.MatchScore
                })
                .Take(5)
                .ToListAsync();

            return Ok(topJobs);
        }

        [HttpPost("tailor-resume")]
        public async Task<IActionResult> TailorResume([FromBody] AgentTaskRequest request)
        {
            var userProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));

            if (userProfile == null) return NotFound("User profile not found.");

            var myResumeContext = $@"
        Experience: {userProfile.BaseResumeText}
        Core Skills: {string.Join(", ", userProfile.CoreSkills)}";

            string customInstructionBlock = string.IsNullOrWhiteSpace(request.UserInstruction)
                ? ""
                : $@"
        USER CUSTOM INSTRUCTION: ""{request.UserInstruction}""
        GATEKEEPER RULE: Evaluate the user's custom instruction against the job description. 
        If it is a bad strategic move (e.g., emphasizing irrelevant skills, lying, or hurting their ATS score), you MUST reject it. 
        If rejecting, act as an empathetic, polite, and elite executive mentor. Explain gently why it is a bad idea in the `coach_feedback` field and set `is_instruction_accepted` to false. 
        If it is a good strategy, or if there is no instruction, set `is_instruction_accepted` to true, leave feedback null, and generate the tailored variations incorporating the instruction.";

            var promptTemplate = @"
        You are an elite technical resume writer and empathetic career coach.
        Review the candidate's resume and the target job description.
        
        CRITICAL PARSING RULE:
        You must extract COMPLETE sentences or COMPLETE bullet points from the candidate's resume. 
        
        TASK:
        For each distinct FULL sentence or bullet point, generate 3 different tailored variations based on the job description. Select the BEST variation out of the 3.
        
        Job Description: {{$jobText}}
        Candidate Resume: {{$resumeText}}
        " + customInstructionBlock + @"
        
        IMPORTANT: You must return strictly valid JSON. 
        The JSON MUST perfectly match this exact structure:
        {
            ""is_instruction_accepted"": true,
            ""coach_feedback"": null,
            ""suggestions"": [
                {
                    ""original_bullet"": ""[Exact original full sentence]"",
                    ""variations"": [
                        { ""focus"": ""[Focus 1]"", ""text"": ""[Tailored variation 1]"" },
                        { ""focus"": ""[Focus 2]"", ""text"": ""[Tailored variation 2]"" },
                        { ""focus"": ""[Focus 3]"", ""text"": ""[Tailored variation 3]"" }
                    ],
                    ""best_variation_index"": 0,
                    ""jarvis_reasoning"": ""[Why this specific index is the best match]""
                }
            ]
        }";

            try
            {
                var arguments = new KernelArguments()
                {
                    { "jobText", request.JobDescription },
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
                    var state = JsonSerializer.Deserialize<TailoredResumeState>(cleanJson, options);

                    // We now return the WHOLE state object, not just the array, so React can read the Gatekeeper feedback!
                    return Ok(state);
                }

                return StatusCode(500, "Agent failed to return valid JSON.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Agent failure: {ex.Message}");
            }
        }

        [HttpPost("generate-cover-letter")]
        public async Task<IActionResult> GenerateCoverLetter([FromBody] AgentTaskRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.JobDescription))
                return BadRequest("Job description text is required.");

            // Fetch the dynamic profile from the database!
            var userProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));

            if (userProfile == null) return NotFound("User profile not found.");

            try
            {
                // Inject the dynamic database context instead of the hardcoded string!
                string candidateProfile = $@"
            Name: {userProfile.FullName}
            Experience: {userProfile.BaseResumeText}
            Core Skills: {string.Join(", ", userProfile.CoreSkills)}";

                string customInstructionBlock = string.IsNullOrWhiteSpace(request.UserInstruction)
                    ? ""
                    : $@"
        USER CUSTOM INSTRUCTION: ""{request.UserInstruction}""
        GATEKEEPER RULE: Evaluate the user's custom instruction against the job description. 
        If it is a bad strategic move (e.g., highlighting irrelevant stacks, being too aggressive, or hurting their chances), you MUST reject it. 
        If rejecting, act as an highly empathetic, polite mentor. Explain gently why it is a bad idea in the `coach_feedback` field and set `is_instruction_accepted` to false. 
        If it is a good strategy, apply it to the cover letter, set `is_instruction_accepted` to true, and leave feedback null.";

                var prompt = $@"
        You are an elite Executive Career Coach and Technical Recruiter.
        Your objective is to write a highly compelling, modern, and concise Cover Letter.

        CANDIDATE PROFILE:
        {candidateProfile}

        TARGET JOB DESCRIPTION:
        {request.JobDescription}

        " + customInstructionBlock + @"

        STRICT INSTRUCTIONS:
        1. Write a 3-paragraph cover letter tailored specifically to the target job description.
        2. DO NOT use generic, weak openings.
        3. Maintain a confident, professional tone. Avoid robotic, corporate jargon.
        
        IMPORTANT: You must return strictly valid JSON matching this structure exactly:
        {
            ""is_instruction_accepted"": true,
            ""coach_feedback"": null,
            ""cover_letter"": ""[The raw text of the cover letter with no placeholder headers]""
        }";

                var result = await _kernel.InvokePromptAsync(prompt);
                var rawResponse = result.ToString();

                var startIndex = rawResponse.IndexOf('{');
                var endIndex = rawResponse.LastIndexOf('}');

                if (startIndex != -1 && endIndex != -1)
                {
                    var cleanJson = rawResponse.Substring(startIndex, endIndex - startIndex + 1);
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var state = JsonSerializer.Deserialize<CoverLetterState>(cleanJson, options);

                    // If they didn't provide an instruction, we force it to true just in case the LLM forgot
                    if (string.IsNullOrWhiteSpace(request.UserInstruction)) state.IsInstructionAccepted = true;

                    return Ok(state);
                }

                return StatusCode(500, "Agent failed to return valid JSON.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Cover Letter Gen Failed: {ex.Message}");
            }
        }


        [HttpPost("save-history")]
        public async Task<IActionResult> SaveToHistory([FromBody] SaveHistoryRequest request)
        {
            // Hardcoded to your specific profile ID for now
            var userId = Guid.Parse("11111111-1111-1111-1111-111111111111");

            try
            {
                EvaluationHistory record;

                if (request.JobId.HasValue && request.JobId != Guid.Empty)
                {
                    // UPDATE: Find the existing record
                    record = await _context.EvaluationHistories.FindAsync(request.JobId.Value);
                    if (record == null) return NotFound("Job record not found.");

                    record.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    // INSERT: Create a new record
                    record = new EvaluationHistory
                    {
                        UserId = userId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.EvaluationHistories.Add(record);
                }

                // Map the data
                record.JobUrl = request.Url;
                record.JobDescription = request.JobDescription;

                // Extract core metadata if the Evaluation object exists
                if (request.Evaluation.HasValue && request.Evaluation.Value.ValueKind != System.Text.Json.JsonValueKind.Null)
                {
                    var evalJson = request.Evaluation.Value.ToString();
                    record.EvaluationJson = evalJson;

                    // Parse out the company, role, and score so we can easily search/sort them in the DB
                    if (request.Evaluation.Value.TryGetProperty("companyName", out var companyProp))
                        record.CompanyName = companyProp.GetString();

                    if (request.Evaluation.Value.TryGetProperty("roleTitle", out var roleProp))
                        record.RoleTitle = roleProp.GetString();

                    if (request.Evaluation.Value.TryGetProperty("matchScore", out var scoreProp))
                        record.MatchScore = (int)Math.Round(scoreProp.GetDouble());
                }

                // Update Cover Letter & Tailored Snippets
                if (!string.IsNullOrWhiteSpace(request.CoverLetter))
                    record.CoverLetterText = request.CoverLetter;

                if (request.TailoredSuggestions.HasValue && request.TailoredSuggestions.Value.ValueKind != System.Text.Json.JsonValueKind.Null)
                    record.TailoredResumeJson = request.TailoredSuggestions.Value.ToString();

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
            // Hardcoded to your specific profile ID for now
            var userId = Guid.Parse("11111111-1111-1111-1111-111111111111");

            try
            {
                // Fetch all records, sorted by the most recently updated first
                var history = await _context.EvaluationHistories
                    .Where(h => h.UserId == userId)
                    .OrderByDescending(h => h.UpdatedAt)
                    .ToListAsync();

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

        // ---> THE SELF-HEALING AI SCRAPER (V4: ENTERPRISE FAIL-FAST) <---
        [HttpPost("scrape-url")]
        public async Task<IActionResult> ScrapeJobUrl([FromBody] string url)
        {
            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out _))
                return BadRequest("Invalid URL format.");

            try
            {
                using var playwright = await Playwright.CreateAsync();

                // We launch a standard headless browser without trying to spoof our identity
                await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = true });
                var page = await browser.NewPageAsync(new BrowserNewPageOptions
                {
                    UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                });

                // Navigate and wait for the DOM
                var response = await page.GotoAsync(url, new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded });
                await page.WaitForTimeoutAsync(3000);

                var initialText = await page.InnerTextAsync("body");

                // --->  WAF DETECTION LOGIC <---
                // If we see Akamai or Cloudflare error signatures, we fail fast and alert the frontend.
                if (response.Status == 403 ||
                    initialText.Contains("Access Denied") ||
                    initialText.Contains("errors.edgesuite.net") ||
                    initialText.Contains("Cloudflare"))
                {
                    return StatusCode(403, "WAF_BLOCKED: Jarvis encountered a military-grade Web Application Firewall. Please paste the job description manually.");
                }

                var observationPrompt = $@"
        You are an autonomous, self-healing web scraper. 
        I have loaded a webpage and extracted the visible text. 
        Look at this text and determine if we are trapped behind a Cookie Consent popup, Privacy notice, or 'Accept Terms' wall.

        PAGE TEXT EXTRACT:
        {initialText.Substring(0, Math.Min(initialText.Length, 1500))}

        TASK:
        If the text heavily features cookie policies, privacy terms, or asking for consent, identify the exact text of the button we need to click to dismiss it (e.g., 'Accept', 'Accept All', 'I Agree', 'Accept Cookies').
        Reply ONLY with the exact button text. Do not use quotes or punctuation.
        If the text looks like a normal job description and is NOT blocked by a popup, reply ONLY with the word: CLEAR.";

                string decision = "CLEAR"; // Default to CLEAR

                try
                {
                    // Attempt to use the LLM to read the cookie wall
                    var decisionResult = await _kernel.InvokePromptAsync(observationPrompt);
                    decision = decisionResult.ToString().Trim().Replace("\"", "").Replace(".", "").Replace("'", "");
                }
                catch (Exception ex) when (ex.Message.Contains("429"))
                {
                    // ---> GRACEFUL DEGRADATION <---
                    // If the AI rate-limits us here, just assume there's no cookie wall and keep moving!
                    Console.WriteLine("🚨 AI Rate Limit Hit on Cookie Check. Bypassing...");
                }

                if (decision != "CLEAR" && !string.IsNullOrWhiteSpace(decision))
                {
                    try
                    {
                        var targetButton = page.GetByText(decision, new PageGetByTextOptions { Exact = false }).First;
                        await targetButton.ClickAsync(new LocatorClickOptions { Timeout = 3000, Force = true });
                        await page.WaitForTimeoutAsync(4000);
                    }
                    catch { }
                }

                var finalCleanText = await page.InnerTextAsync("body");
                var formattedText = System.Text.RegularExpressions.Regex.Replace(finalCleanText, @"\s+", " ").Trim();

                // ---> NEW: 1. Take the Screenshot Receipt <---
                // We take a standard viewport screenshot before closing the browser
                byte[] screenshotBytes = await page.ScreenshotAsync(new PageScreenshotOptions
                {
                    Type = ScreenshotType.Jpeg,
                    Quality = 80 // Compress it slightly so the REST API stays lightning fast
                });
                string base64Image = Convert.ToBase64String(screenshotBytes);

                // ---> NEW: 2. Return BOTH the text and the image <---
                return Ok(new
                {
                    scrapedText = formattedText,
                    screenshotBase64 = base64Image 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Agent Scraper failed: {ex.Message}");
            }
        }

        [HttpPost("generate-interview-questions")]
        public async Task<IActionResult> GenerateInterviewQuestions([FromBody] InterviewGenerationRequest request)
        {
            var userProfile = await _context.UserProfiles
                .FirstOrDefaultAsync(u => u.Id == Guid.Parse("11111111-1111-1111-1111-111111111111"));

            if (userProfile == null) return NotFound("User profile not found.");

            var myResumeContext = $@"
        Experience: {userProfile.BaseResumeText}
        Core Skills: {string.Join(", ", userProfile.CoreSkills)}";

            var promptTemplate = @"
        You are an elite, technical Principal Engineer conducting a rigorous job interview.
        Review the candidate's resume and the target job description.
        
        Job Description: {{$jobText}}
        Candidate Resume: {{$resumeText}}

        TASK: Generate 3 highly specific, challenging interview questions. 
        - DO NOT ask generic behavioral questions (e.g., 'What is your weakness?').
        - DO ask scenario-based technical questions.
        - Probe the intersection of their skills and the job. If the job requires a skill they lack, ask how they would adapt.

        IMPORTANT: Return strictly valid JSON matching this exact structure:
        {
            ""questions"": [
                {
                    ""focus_area"": ""[e.g., System Architecture, Cloud Migration, Database Optimization]"",
                    ""question_text"": ""[The specific interview question]"",
                    ""ideal_concept_to_mention"": ""[What a 10/10 answer should technically include]""
                }
            ]
        }";

            try
            {
                var arguments = new KernelArguments()
                {
                    { "jobText", request.JobDescription },
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
                    var state = JsonSerializer.Deserialize<InterviewQuestionState>(cleanJson, options);
                    return Ok(state);
                }

                return StatusCode(500, "Agent failed to return valid JSON.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Interview Generation Failed: {ex.Message}");
            }
        }

        [HttpPost("evaluate-interview-answer")]
        public async Task<IActionResult> EvaluateInterviewAnswer([FromBody] EvaluateAnswerRequest request)
        {
            var promptTemplate = @"
        You are a strict, elite technical hiring manager and executive career coach. 
        You asked the candidate the following interview question for a specific job.
        
        Job Context: {{$jobText}}
        Question Asked: {{$questionText}}
        Candidate's Answer: {{$userAnswer}}

        TASK: Evaluate the candidate's answer. Be brutally honest, highly technical, and constructive.
        Additionally, identify exactly what technical concepts the candidate is weak on and recommend 2 highly specific learning resources.

        IMPORTANT: Return strictly valid JSON matching this exact structure:
        {
            ""score"": 85, 
            ""feedback"": ""[Constructive feedback on what was good and what was missing]"",
            ""better_answer_example"": ""[A 1-2 sentence example of how an elite candidate would have answered]"",
            ""recommended_resources"": [
                {
                    ""platform"": ""[e.g., YouTube, Microsoft Learn, LeetCode, Official Docs, GeeksforGeeks, Medium]"",
                    ""topic"": ""[Specific concept they missed]"",
                    ""search_query"": ""[The exact search string to find the answer]""
                },
                {
                    ""platform"": ""GeeksforGeeks"",
                    ""topic"": ""[Algorithm or system design concept]"",
                    ""search_query"": ""[The exact search string]""
                }
            ]
        }";

            try
            {
                var arguments = new KernelArguments()
                {
                    { "jobText", request.JobDescription },
                    { "questionText", request.QuestionText },
                    { "userAnswer", request.UserAnswer }
                };

                var result = await _kernel.InvokePromptAsync(promptTemplate, arguments);
                var rawResponse = result.ToString();

                var startIndex = rawResponse.IndexOf('{');
                var endIndex = rawResponse.LastIndexOf('}');

                if (startIndex != -1 && endIndex != -1)
                {
                    var cleanJson = rawResponse.Substring(startIndex, endIndex - startIndex + 1);
                    var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                    var state = JsonSerializer.Deserialize<AnswerEvaluationState>(cleanJson, options);
                    return Ok(state);
                }

                return StatusCode(500, "Agent failed to return valid JSON.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Evaluation Failed: {ex.Message}");
            }
        }

    }

    // ---> ENFORCED DATA CONTRACTS <---
    public class AgentTaskRequest
    {
        public string JobDescription { get; set; } = string.Empty;
        public string? UserInstruction { get; set; } // Optional Custom Prompt
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

    // ---> DATABASE ENTITY (PostgreSQL Table Schema) <---
    public class EvaluationHistory
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; } // Links to your UserProfile
        public string? CompanyName { get; set; }
        public string? RoleTitle { get; set; }
        public string? JobUrl { get; set; }
        public string? JobDescription { get; set; }
        public int MatchScore { get; set; }

        // We store the structured AI outputs as JSON strings
        public string? EvaluationJson { get; set; }
        public string? TailoredResumeJson { get; set; }
        public string? CoverLetterText { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    // ---> REQUEST DTO <---
    public class SaveHistoryRequest
    {
        public Guid? JobId { get; set; }
        public string? Url { get; set; }
        public string? JobDescription { get; set; }
        public System.Text.Json.JsonElement? Evaluation { get; set; }
        public string? CoverLetter { get; set; }
        public System.Text.Json.JsonElement? TailoredSuggestions { get; set; }
    }

    public class UpdateProfileRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string BaseResumeText { get; set; } = string.Empty;
        public string[] CoreSkills { get; set; } = Array.Empty<string>();
        public System.Text.Json.JsonElement? StructuredResumeJson { get; set; }
    }

    // ---> INTERVIEW STRATEGIST DTOs <---
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
        public string Platform { get; set; } = string.Empty; // e.g., "YouTube", "GeeksforGeeks", "Microsoft Learn"

        [JsonPropertyName("topic")]
        public string Topic { get; set; } = string.Empty; // e.g., "Understanding Azure CI/CD Pipelines"

        [JsonPropertyName("search_query")]
        public string SearchQuery { get; set; } = string.Empty; // e.g., "Azure DevOps CI/CD pipeline tutorial"
    }

} 

