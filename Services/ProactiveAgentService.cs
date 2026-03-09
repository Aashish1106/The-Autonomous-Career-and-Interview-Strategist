using AutoJobStrategist.Api.Controllers;
using AutoJobStrategist.Api.Data;
using AutoJobStrategist.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AutoJobStrategist.Api.Services
{
    public class ProactiveAgentService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ProactiveAgentService> _logger;

        public ProactiveAgentService(IServiceProvider serviceProvider, ILogger<ProactiveAgentService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🧠 PROACTIVE AGENT ONLINE: Initializing continuous pipeline radar...");

            // The Infinite Agent Loop
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PerformTacticalSweepAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Proactive sweep encountered a critical error.");
                }

                // ---> THE RADAR INTERVAL <---
                // 🧪 TEST MODE: Set to 30 seconds so you can watch it work right now.
                // 🚀 PROD MODE: Change to TimeSpan.FromHours(12) before deploying.
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        private async Task PerformTacticalSweepAsync()
        {
            // Background services are Singletons. We must create a "Scope" to access our Scoped Database context safely.
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var adminId = Guid.Parse("11111111-1111-1111-1111-111111111111");

            // Define what "Stale" means. (Aligning with your React ghosting UI: 14 days)
            var staleCutoff = DateTime.UtcNow.AddDays(-14);

            // 1. Find jobs that are Deployed but haven't been touched in 14 days
            var staleJobs = await db.EvaluationHistories
                .Where(j => j.PipelineStage == "Deployed" && j.UpdatedAt <= staleCutoff)
                .ToListAsync();

            int alertsGenerated = 0;

            foreach (var job in staleJobs)
            {
                // ---> THE ANTI-SPAM GATEWAY <---
                // Check if we already have an unread warning for this exact job so we don't nag the user to death.
                bool alreadyWarned = await db.SystemNotifications
                    .AnyAsync(n => n.RelatedJobId == job.Id && n.Type == "warning" && !n.IsRead);

                if (!alreadyWarned)
                {
                    var notification = new SystemNotification
                    {
                        UserId = adminId,
                        RelatedJobId = job.Id,
                        Title = "⚠️ Stale Application Detected",
                        Message = $"{job.CompanyName ?? "A company"} hasn't responded in 14 days. Shall I draft a follow-up email?",
                        Type = "warning",
                        IsRead = false
                    };

                    db.SystemNotifications.Add(notification);
                    alertsGenerated++;
                }
            }

            if (alertsGenerated > 0)
            {
                await db.SaveChangesAsync();
                _logger.LogInformation($"[PROACTIVE AGENT] Generated {alertsGenerated} stale job warnings.");
            }
        }
    }
}