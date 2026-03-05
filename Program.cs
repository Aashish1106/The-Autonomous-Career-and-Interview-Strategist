using AutoJobStrategist.Api.Data;
using AutoJobStrategist.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;

var builder = WebApplication.CreateBuilder(args);

// ---> ACE AUTOMATION FIX: THE ZERO-PATH OVERRIDE <---
// 1. Force Playwright to store browsers inside the app folder, not hidden Windows folders
Environment.SetEnvironmentVariable("PLAYWRIGHT_BROWSERS_PATH", "0");

// 2. Download the browser on startup if it's missing
Console.WriteLine("Checking ACE Scraper requirements...");
var exitCode = Microsoft.Playwright.Program.Main(new[] { "install", "chromium" });
if (exitCode != 0)
{
    Console.WriteLine("Warning: Playwright install returned an error code.");
}
else
{
    Console.WriteLine("ACE Scraper engine is primed and ready.");
}
// ----------------------------------------------------

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy => policy.AllowAnyOrigin()
                        .AllowAnyHeader()
                        .AllowAnyMethod());
});

// ----------------------------------------------------------------
// GOOGLE GEMINI CONFIGURATION
// ----------------------------------------------------------------
var googleApiKey = builder.Configuration["Google:ApiKey"];

if (string.IsNullOrEmpty(googleApiKey))
{
    throw new Exception("Google API Key is missing! Check appsettings.json.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"),
        o => o.UseVector()));

// Temporarily suppress the SK experimental warning for the Google Embedding connector
#pragma warning disable SKEXP0070 

builder.Services.AddKernel()
    .AddGoogleAIGeminiChatCompletion(
        modelId: "gemini-2.5-flash",
        apiKey: googleApiKey
    );

#pragma warning restore SKEXP0070
// ----------------------------------------------------------------

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.MapControllers();
app.Run();