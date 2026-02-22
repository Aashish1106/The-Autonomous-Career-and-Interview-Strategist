using AutoJobStrategist.Api.Data;
using AutoJobStrategist.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy.WithOrigins("http://localhost:5173")
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

// We only keep the Chat Completion in SK. Embeddings will be handled natively.
builder.Services.AddKernel()
    .AddGoogleAIGeminiChatCompletion(
        modelId: "gemini-2.5-flash",
        apiKey: googleApiKey
    );
// ----------------------------------------------------------------

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowReactApp");
app.MapControllers();
app.Run();