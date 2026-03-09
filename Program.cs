using AutoJobStrategist.Api.Data;
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

// ---> 1. ADD SIGNALR & BACKGROUND AGENT <---
builder.Services.AddSignalR();
builder.Services.AddHostedService<AutoJobStrategist.Api.Services.ProactiveAgentService>();

// ---> 2. SIGNALR-COMPLIANT CORS POLICY <---
// SignalR WebSockets STRICTLY FORBID AllowAnyOrigin(). You must specify the exact URLs and AllowCredentials.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy => policy.WithOrigins("https://ace-jarvisai.vercel.app", "http://localhost:5173", "http://localhost:3000")
                        .AllowAnyMethod()
                        .AllowAnyHeader()
                        .AllowCredentials());
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

// ---> 3. AZURE DB AUTO-SYNC <---
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        db.Database.Migrate();
        Console.WriteLine("✅ Azure Database schema synchronized successfully.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"🚨 Migration Failed: {ex.Message}");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// CORS must be here, before MapControllers and MapHub
app.UseCors("AllowAll");
app.MapControllers();

// ---> 4. MAP THE SIGNALR HUB <---
app.MapHub<AutoJobStrategist.Api.Hubs.NotificationHub>("/hubs/notifications");

// ---> 5. CLOUD VERSION TRACKER <---
app.MapGet("/api/ping", () => "JARVIS V2 - SIGNALR IS ACTIVE");

app.Run();