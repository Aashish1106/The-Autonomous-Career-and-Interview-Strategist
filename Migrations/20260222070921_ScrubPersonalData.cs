using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AutoJobStrategist.Api.Migrations
{
    /// <inheritdoc />
    public partial class ScrubPersonalData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "UserProfiles",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "BaseResumeText", "CoreSkills", "FullName" },
                values: new object[] { "Awaiting deployment initialization. Please paste your complete resume via the Admin Settings dashboard to initialize the agentic vector space.", new[] { "Setup Required" }, "Admin User" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "UserProfiles",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                columns: new[] { "BaseResumeText", "CoreSkills", "FullName" },
                values: new object[] { "Professional Summary:\r\nSenior Software Engineer with 3+ years of experience developing scalable web applications using .NET Core, Angular, and Azure cloud services. Proven track record of leading modernization projects that improved system performance by 33% and reduced operational costs.\r\n\r\nExperience - Infosys Limited (Senior Systems Engineer):\r\n• Enterprise Platform Delivery: Built and deployed full-stack web applications on Azure using ASP.NET MVC, C#, TypeScript, Node.js, Angular, React, JavaScript, HTML5 and CSS3, solving complex Sitecore CMS and MS SQL integration issues and establishing CI/CD pipelines in Azure DevOps to boost user satisfaction and platform performance.\r\n• Legacy System Modernization: Directed the effort to move a legacy ASP.NET application over to a modern .NET Core and React architecture, fixing back-end bottlenecks to improve maintainability and scalability and achieving a 33%increase in performance.\r\n• Database & Query Optimization: Optimized MySQL performance by analyzing slow queries and refining the schema, adding strategic indexing that cut page load times by 27% and improving reliability under high traffic.\r\n• Cloud Infrastructure & AI Integration: Designed a scalable, fault-tolerant architecture using Kubernetes for dynamic resource management and set up automated deployment pipelines through Jenkins and Azure DevOps, while integrating GitHub Copilot into the workflow to speed up development and ensuring all AI-assisted code met internal security and Responsible AI guidelines.\r\n• Technical Strategy & Collaboration: Acted as the main point of contact between business teams and developers, turning high-level goals into clear technical plans and delivering cost-effective solutions that contributed to a 21% increase in project profit.\r\n• Documentation & Mentorship: Created clear functional specs, integration guides, troubleshooting steps and API references that accelerated onboarding for new team members and improved code maintainability and team collaboration.\r\n\r\nExperience - Defence Research and Development Organisation (Research Intern):\r\nDeveloped algorithms for RADAR and high-speed imaging systems, achieving 95% accuracy in object acceleration detection. Implemented machine learning models improving detection accuracy by 40%.\r\n\r\nExperience - Ciphense Inc. (AI/ML Intern):\r\nEngineered a speaker recognition system using TensorFlow and Keras (92% accuracy) and a face recognition pipeline with OpenCV processing 500+ images per second.\r\n\r\nProjects:\r\nHoliday Packages: Built with Angular, TypeScript, ASP.NET Core MVC, and Node.js to dynamize booking processes.\r\nSpeech Recognition: High-performance system built in Python using NumPy and TensorFlow/Keras, alongside a bidirectional speech translation system using Google Cloud APIs.\r\n\r\nEducation:\r\nB.Tech in Electronics and Telecommunication Engineering, Indira Gandhi Institute of Technology (CGPA: 8.86).\r\n\r\nKey Certifications:\r\nAZ-400 (Microsoft Certified DevOps Engineer Expert), AZ-500 (Microsoft Certified Azure Security Engineer), AI-102 (Microsoft Certified Azure AI Engineer Associate), AZ-204 (Microsoft Certified Azure Developer Associate), AZ-104(Microsoft Certified Azure Administrator Associate), AZ-305(Microsoft Certified Azure Solutions Architect), GH-300 (GitHub Copilot), Infosys Certified Generative AI Professional, Infosys Certified Ethical Hacker.", new[] { "ASP.NET Core (Web API, MVC)", ".NET Core", "C#", "Angular", "React.js", "Node.js", "TypeScript", "JavaScript", "HTML5", "CSS3", "Python", "Java", "Azure", "AWS", "Docker", "Kubernetes", "Jenkins", "Azure DevOps", "CI/CD Pipelines", "SQL Server", "MySQL", "MongoDB", "Entity Framework Core", "NoSQL", "Microservices Architecture", "Full-stack Web Development", "Generative AI", "Responsible AI", "GitHub Copilot", "Machine Learning (TensorFlow, Keras, OpenCV)", "Cybersecurity Best Practices", "Agile/Scrum", "Test-Driven Development" }, "Aashish" });
        }
    }
}
