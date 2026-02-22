# 🛡️ The Autonomous Career & Interview Strategist 

An enterprise-grade, AI-driven application designed to autonomously parse resumes, scrape job descriptions, evaluate semantic fit using vector mathematics, and dynamically tailor application materials. 

Built with a "Two-Brain System" (PostgreSQL `pgvector` for mathematical distance + Microsoft Semantic Kernel for agentic reasoning), this tool acts as an elite, autonomous career strategist.

---

## ✨ Core Features

* **📄 ATS Identity Ingestion:** Drop a PDF resume into the application. The AI automatically cracks the PDF, extracts raw text, and structures it into a strict JSON schema (Profile, Experience, Projects, Certifications) mapped to React state.
* **🕸️ Self-Healing AI Web Scraper:** Paste a job URL. The built-in Playwright engine navigates to the page, and if it hits a cookie wall or privacy popup, the AI visually reads the DOM, identifies the "Accept" button, clicks it, and extracts the raw job description.
* **🧠 Two-Brain RAG Evaluation Engine:**
   * *Brain 1 (Vector Math):* Calculates the Cosine Distance between the Gemini 768-dimensional embedding of your resume and the target job description via **PostgreSQL pgvector**.
   * *Brain 2 (Agentic Recruiter):* Uses **Semantic Kernel** to act as a human recruiter, identifying skill gaps and providing a strategic verdict (e.g., "High Match", "Tailor Heavily").
* **🎯 Automated Resume Tailoring:** AI dynamically rewrites specific resume bullets to perfectly align with the target job. Includes a "Gatekeeper" rule to reject instructions that encourage lying or bad strategies.
* **📝 Cover Letter Generation:** Generates concise, highly tailored, non-robotic cover letters based on the vector intersection of your profile and the job description.
* **🗄️ Strategic Vault (Leaderboard):** Saves snapshots of evaluations, cover letters, and tailored bullets into a Postgres database, allowing you to mathematically rank your highest-probability job prospects.

---

## 🛠️ Technology Stack

**Frontend:**
* React.js (Vite)
* Tailwind CSS (Animations & Glassmorphism UI)
* jsPDF (PDF Exporting)

**Backend:**
* C# .NET 8 Web API
* Microsoft Semantic Kernel (Agentic AI Orchestration)
* Entity Framework Core
* Playwright (Headless Browser Scraping)
* UglyToad.PdfPig (PDF Parsing)

**Database & AI:**
* PostgreSQL (Neon Serverless)
* `pgvector` (Vector Embeddings)
* Google Gemini API (Embedding & Generative Models)

---

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed on your machine:
1. **[Node.js](https://nodejs.org/)** (v18 or higher)
2. **[.NET 8 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)**
3. **Git**

---

## 🔑 Step 1: Obtain Cloud API Keys

This application requires two free cloud services to operate. 

### A. Get a Neon PostgreSQL Database (with pgvector)
1. Go to [Neon.tech](https://neon.tech/) and create a free account.
2. Create a new project (Select Postgres version 15 or higher).
3. On your project dashboard, find the **Connection Details** widget.
4. Copy the connection string. It will look something like this:
   `postgres://[user]:[password]@[host]/[dbname]?sslmode=require`
5. **CRITICAL C# FORMATTING:** To use this with Entity Framework, reformat it into standard Key-Value pairs and add the Trust Certificate flag:
   `Host=ep-your-host-name.aws.neon.tech; Database=neondb; Username=your_user; Password=your_password; SSL Mode=VerifyFull; Trust Server Certificate=true;`

### B. Get a Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **"Get API key"** in the left sidebar.
4. Create an API key in a new project and copy the string.

---

## 🚀 Step 2: Backend Setup (C# .NET API)

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git)
   cd YOUR_REPOSITORY
   cd AutoJobStrategist.Api
   ```

2. **Securely store your API keys using .NET User Secrets:**
   *Do NOT hardcode your keys into `appsettings.json`.* Initialize the secret manager:
   ```bash
   dotnet user-secrets init
   ```
   Add your Neon Database String:
   ```bash
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "YOUR_NEON_DB_STRING_HERE"
   ```
   Add your Google Gemini API Key:
   ```bash
   dotnet user-secrets set "Google:ApiKey" "YOUR_GEMINI_KEY_HERE"
   ```

3. **Install Playwright Browsers (For the Scraper):**
   ```bash
   dotnet build
   pwsh bin/Debug/net8.0/playwright.ps1 install
   ```

4. **Run Entity Framework Migrations:**
   This will build the necessary tables and enable the `vector` extension in your Neon database.
   ```bash
   dotnet ef database update
   ```

5. **Start the API Server:**
   ```bash
   dotnet run
   ```
   *The backend will typically run on `https://localhost:7155`.*

---

## 💻 Step 3: Frontend Setup (React)

1. **Open a new terminal window** and navigate to the React client folder:
   ```bash
   cd YOUR_REPOSITORY
   cd AutoJobStrategist.Client # (Replace with your actual React folder name)
   ```

2. **Install NPM Packages:**
   ```bash
   npm install
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   *The frontend will typically run on `http://localhost:5173`.*

---

## 🎯 How to Use Jarvis

1. **Initialize Identity:** Open the UI and navigate to the **Admin Settings** tab. Drag and drop your PDF resume. Wait for the AI to parse and structure your identity, then click **"Save to Vault"** to vectorize your profile into PostgreSQL.
2. **Target Lock:** Go to the main dashboard. Paste a job URL from LinkedIn or Indeed into the URL bar and click **"Fetch Data"**. The self-healing scraper will bypass popups and grab the text.
3. **Evaluate Fit:** Click **"Initialize Evaluation"**. Jarvis will run the Two-Brain system and return a Vector Match Score (%) and a strategic verdict.
4. **Tailor Arsenal:** Click **"Auto-Tailor"** to generate 3 custom variations of your resume bullets based on the specific job requirements.
5. **Save Snapshot:** Click **"Save Snapshot"** to store this specific job evaluation in your database.
6. **Review Vault:** Navigate to the **Strategic Vault** tab to see a leaderboard of all jobs you've evaluated, ranked mathematically by how well they fit your specific skillset.

---

## 🔒 Security Note

This repository utilizes `.gitignore` to prevent the accidental pushing of `.env` files, `appsettings.json` secrets, and compiled `.dll` binaries. Always use `.NET User Secrets` or Environment Variables for your keys.

---

*Built for the future of autonomous career strategy.*
