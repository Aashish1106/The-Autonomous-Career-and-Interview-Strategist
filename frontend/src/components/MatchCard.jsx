import React, { useState } from 'react';
import { jsPDF } from "jspdf";
import GenAILoader from './GenAILoader';
import AgentConsole from './AgentConsole';

const MatchCard = ({ job = null }) => {
    // --- STATE MANAGEMENT ---
    const [url, setUrl] = useState('');
    const [jobText, setJobText] = useState('');
    const [screenshot, setScreenshot] = useState(null);
    const [consoleLogs, setConsoleLogs] = useState([]);
    const [consoleStatus, setConsoleStatus] = useState('idle');
    const [toastMessage, setToastMessage] = useState(null);

    // Strategic Override States
    const [userInstruction, setUserInstruction] = useState('');
    const [coachFeedback, setCoachFeedback] = useState(null);

    // Loading States
    const [isFetching, setIsFetching] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [isTailoring, setIsTailoring] = useState(false);
    const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Data States
    const [evaluation, setEvaluation] = useState(null);
    const [coverLetter, setCoverLetter] = useState(null);
    const [tailoredSuggestions, setTailoredSuggestions] = useState(null);
    const [jobId, setJobId] = useState(null);
    const [lastSavedHash, setLastSavedHash] = useState(null);

    // ---> HYBRID MODE INJECTION <---
    // If a 'job' prop is passed (e.g., from the Kanban Board), pre-fill the entire state!
    React.useEffect(() => {
        if (job) {
            setUrl(job.jobUrl || job.Url || '');
            setJobText(job.jobDescription || job.JobDescription || '');
            setJobId(job.id || job.Id);

            // 1. Unpack the original Evaluation JSON from the Database!
            let realGaps = [];
            let realAction = "Review Match";
            let realWorkplace = "HYBRID/UNKNOWN";

            try {
                const evalStr = job.evaluationJson || job.EvaluationJson;
                if (evalStr) {
                    const parsedEval = typeof evalStr === 'string' ? JSON.parse(evalStr) : evalStr;
                    // Map the DB keys back to the UI state
                    realGaps = parsedEval.missing_skills || [];
                    realAction = parsedEval.recommended_action || "Review Match";
                    realWorkplace = parsedEval.is_remote ? "REMOTE" : "ON-SITE";
                }
            } catch (e) {
                console.error("Failed to parse evaluation JSON", e);
            }

            // 2. Set the UI states
            setEvaluation({
                matchScore: job.matchScore || job.MatchScore || 0,
                companyName: job.companyName || job.CompanyName || "Unknown Company",
                roleTitle: job.roleTitle || job.RoleTitle || "Unknown Role",
                gaps: realGaps,
                action: realAction,
                workplaceType: realWorkplace
            });

            // 3. Load the AI Artifacts
            setCoverLetter(job.coverLetterText || job.CoverLetterText || null);

            try {
                const tailoredData = job.tailoredResumeJson || job.TailoredResumeJson;
                if (tailoredData) {
                    setTailoredSuggestions(typeof tailoredData === 'string' ? JSON.parse(tailoredData) : tailoredData);
                }
            } catch (e) {
                console.error("Failed to parse tailored suggestions", e);
            }
        }
    }, [job]);

    // --- HELPER FUNCTIONS ---
    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleSaveToHistory = async () => {
        if (!evaluation) return;
        const currentDataString = JSON.stringify({ evaluation, coverLetter, tailoredSuggestions });
        if (lastSavedHash === currentDataString) {
            showToast("⚠️ Already Saved: No new changes detected");
            return;
        }

        try {
            const payload = { JobId: jobId, Url: url, JobDescription: jobText, Evaluation: evaluation, CoverLetter: coverLetter, TailoredSuggestions: tailoredSuggestions };
            const response = await fetch("https://localhost:7155/api/JobStrategist/save-history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Backend Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            if (data.jobId && !jobId) setJobId(data.jobId);
            setLastSavedHash(currentDataString);
            showToast("💾 Application Snapshot Saved to Vault");

            // ---> BROADCAST REFRESH SIGNAL TO VAULT <---
            window.dispatchEvent(new Event('vaultUpdated'));

        } catch (error) {
            console.error("SAVE ERROR:", error); 
            showToast(`🚨 ${error.message}`);
        }
    };

    const getStrokeColor = (score) => {
        if (score >= 80) return 'stroke-emerald-400';
        if (score >= 60) return 'stroke-yellow-400';
        return 'stroke-pink-500';
    };

    // --- HANDLERS ---
    const handleFetchData = async () => {
        if (!url) return showToast("Please enter a job URL.");
        setIsFetching(true);
        setConsoleStatus('processing');
        setConsoleLogs(["> INITIATING STEALTH BROWSER ENGINE..."]);
        setJobText(''); setScreenshot(null); setEvaluation(null); setCoverLetter(null);
        setTailoredSuggestions(null); setCoachFeedback(null);

        try {
            setTimeout(() => setConsoleLogs(prev => [...prev, "> BYPASSING WAF & EXTRACTING DOM..."]), 800);
            setTimeout(() => setConsoleLogs(prev => [...prev, "> AWAITING SCRAPER PAYLOAD . . ."]), 1600);

            const response = await fetch("https://localhost:7155/api/JobStrategist/scrape-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(url)
            });

            if (!response.ok) {
                const errorText = await response.text();
                // ---> UNIVERSAL 429 HANDLER <---
                if (response.status === 429) {
                    throw new Error("⚠️ ACE Core: AI Token quota exhausted. Please rest and resume tomorrow.");
                }
                throw new Error(errorText || "Unknown backend error");
            }
            const data = await response.json();
            setConsoleStatus('idle');
            setJobText(data.scrapedText);
            setScreenshot(data.screenshotBase64);
        } catch (error) {
            setConsoleStatus('error');
            setConsoleLogs(prev => [...prev, `[ERROR] Scraper API Failed: ${error.message}`]);
            console.error(error);
        } finally {
            setIsFetching(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!coverLetter) return;
        const doc = new jsPDF();
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(today, 20, 20);
        const splitText = doc.splitTextToSize(coverLetter, 170);
        doc.text(splitText, 20, 40);
        const companyNameClean = evaluation?.companyName ? evaluation.companyName.replace(/[^a-zA-Z0-9]/g, '_') : 'Company';
        doc.save(`Aashish_CoverLetter_${companyNameClean}.pdf`);
        showToast("PDF Exported Successfully");
    };

    const handleEvaluate = async () => {
        if (!jobText) return showToast("Please fetch or paste job description text first.");
        setIsEvaluating(true);
        setConsoleStatus('processing');
        setConsoleLogs(["> SPINNING UP SEMANTIC KERNEL..."]);

        try {
            setTimeout(() => setConsoleLogs(prev => [...prev, "> TOKENIZING JOB DESCRIPTION & POSTGRESQL PROFILE..."]), 800);
            setTimeout(() => setConsoleLogs(prev => [...prev, "> AWAITING LLM NEURAL EVALUATION . . ."]), 1600);

            const payload = { jobDescriptionText: jobText, jobUrl: url };
            const response = await fetch("https://localhost:7155/api/JobStrategist/evaluate-job", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Unknown backend error");
            }
            const data = await response.json();
            setConsoleStatus('idle');
            setEvaluation({
                matchScore: data.evaluation?.match_percentage ?? 0,
                gaps: data.evaluation?.missing_skills ?? [],
                action: data.evaluation?.recommended_action ?? "Review Match",
                companyName: data.job_details?.company ?? "Unknown Company",
                roleTitle: data.job_details?.role ?? "Unknown Role",
                workplaceType: data.job_details?.is_remote ? "REMOTE" : "ON-SITE"
            });
        } catch (error) {
            setConsoleStatus('error');
            setConsoleLogs(prev => [...prev, `[ERROR] Evaluation Failed: ${error.message}`]);
            console.error(error);
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleTailorResume = async () => {
        setIsTailoring(true);
        setCoachFeedback(null);
        try {
            const payload = { JobDescription: jobText, UserInstruction: userInstruction };
            const response = await fetch("https://localhost:7155/api/JobStrategist/tailor-resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                // ---> UNIVERSAL 429 HANDLER <---
                if (response.status === 429) {
                    throw new Error("⚠️ ACE Core: AI Token quota exhausted. Please rest and resume tomorrow.");
                }
                throw new Error(`Tailoring API Failed (${response.status}):\n${errorText || "Unknown backend error"}`);
            }
            const data = await response.json();

            // CHECK THE GATEKEEPER
            if (data.is_instruction_accepted === false) {
                setCoachFeedback(data.coach_feedback);
                return;
            }

            setTailoredSuggestions(data.suggestions);

            // ---> NEW: Always show a toast! <---
            if (userInstruction) {
                showToast("✨ Override Applied & Resume Tailored");
            } else {
                showToast("✨ Resume Tailored Successfully");
            }
        } catch (error) {
            alert(`🚨 ${error.message}`);
            console.error(error);
        } finally {
            setIsTailoring(false);
        }
    };

    const handleGenerateLetter = async () => {
        setIsGeneratingLetter(true);
        setCoachFeedback(null);
        try {
            const payload = { JobDescription: jobText, UserInstruction: userInstruction };
            const response = await fetch("https://localhost:7155/api/JobStrategist/generate-cover-letter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                // ---> UNIVERSAL 429 HANDLER <---
                if (response.status === 429) {
                    throw new Error("⚠️ ACE Core: AI Token quota exhausted. Please rest and resume tomorrow.");
                }
                throw new Error(`Cover Letter API Failed (${response.status}):\n${errorText || "Unknown backend error"}`);
            }
            const data = await response.json();

            // CHECK THE GATEKEEPER
            if (data.is_instruction_accepted === false) {
                setCoachFeedback(data.coach_feedback);
                return;
            }

            setCoverLetter(data.cover_letter);

            // ---> NEW: Always show a toast! <---
            if (userInstruction) {
                showToast("📝 Override Applied & Letter Drafted");
            } else {
                showToast("📝 Cover Letter Generated Successfully");
            }
        } catch (error) {
            alert(`🚨 ${error.message}`);
            console.error(error);
        } finally {
            setIsGeneratingLetter(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        setTimeout(() => {
            setJobText(''); setEvaluation(null); setCoverLetter(null); setTailoredSuggestions(null);
            setUrl(''); setUserInstruction(''); setCoachFeedback(null); setJobId(null);
            setLastSavedHash(null); setScreenshot(null); setIsDeleting(false);
        }, 2000);
    };

    // --- RENDER ---
    return (
        /* ---> ADDED h-full to make it fill the modal <--- */
        <div className="relative group w-full max-w-4xl mx-auto h-full flex flex-col">

            {/* The outer glowing ring */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[38px] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse"></div>

            {/* ---> The Main Frame: Now has h-full and overflow-hidden to lock the rounded corners! <--- */}
            <div className="relative bg-slate-900/90 backdrop-blur-2xl rounded-[36px] border border-white/10 shadow-2xl flex flex-col h-full overflow-hidden">

                {/* ---> NEW: THE INNER SCROLLING VIEWPORT <--- */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">

                    {/* ---> ALL YOUR CONTENT GOES INSIDE HERE <--- */}
                    {job && (
                        <div className="mb-6 flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-xl w-fit">
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                            <span className="text-purple-400 text-xs font-bold uppercase tracking-widest font-mono">Vault Snapshot Loaded</span>
                        </div>
                    )}

                {/* STAGE 1: URL Input & Fetching (HIDDEN IF SNAPSHOT) */}
                {!job && (
                    <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-2xl p-2 px-4 focus-within:border-purple-500 transition-colors">
                            <span className="text-purple-400">🔗</span>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://jobs.company.com/..."
                                className="w-full bg-transparent text-slate-300 outline-none text-sm placeholder-slate-600 font-mono"
                            />
                        </div>

                        <div className="relative group/btn mt-4">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-2xl blur opacity-30 group-hover/btn:opacity-60 transition duration-500"></div>
                            <button
                                onClick={handleFetchData}
                                disabled={isFetching || isEvaluating}
                                className="relative w-full py-4 bg-slate-900 text-white font-bold uppercase tracking-widest rounded-2xl border border-white/10 hover:bg-slate-800 hover:border-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] overflow-hidden flex items-center justify-center gap-2"
                            >
                                <span className="group-hover/btn:tracking-wider transition-all duration-300">
                                    {isFetching ? "Fetching..." : "Fetch Data 🌐"}
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {/* STAGE 2: Data Display & Loading */}
                {isFetching || (consoleStatus === 'error' && !jobText && !evaluation) ? (
                    <div className="py-2 animate-in fade-in duration-500">
                        <AgentConsole mode="scraping" logs={consoleLogs} status={consoleStatus} />
                        {consoleStatus === 'error' && !isFetching && (
                            <button onClick={() => setConsoleStatus('idle')} className="mt-4 w-full py-4 bg-red-950/20 border border-red-500/30 hover:bg-red-900/40 rounded-2xl text-red-400 text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(248,113,113,0.1)]">
                                Acknowledge Error & Paste Manually
                            </button>
                        )}
                    </div>
                ) : isDeleting ? (
                    <div className="py-8"><GenAILoader message="Purging from Core Memory..." /></div>
                ) : (
                    <div className="space-y-4 animate-in fade-in duration-500">

                        {/* ---> RESTORED SCREENSHOT RENDER <--- */}
                        {screenshot && !job && (
                            <div className="relative group rounded-2xl overflow-hidden border border-slate-700 shadow-[0_0_15px_rgba(0,0,0,0.5)] mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/20 to-transparent z-10 pointer-events-none"></div>
                                <img src={`data:image/jpeg;base64,${screenshot}`} alt="ACE Target Lock" className="w-full h-48 object-cover object-top opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                    <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest drop-shadow-md">Target Acquired // Visual Receipt</span>
                                </div>
                            </div>
                        )}

                        {/* Always show the JD, but make it read-only if it's a snapshot */}
                        <textarea
                            value={jobText}
                            onChange={(e) => setJobText(e.target.value)}
                            readOnly={!!job}
                            placeholder="Raw job description text will appear here. If blocked by WAF, paste manually..."
                            className={`w-full h-48 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-slate-400 text-sm focus:outline-none focus:border-purple-500 custom-scrollbar font-mono leading-relaxed ${job ? 'opacity-80 cursor-default border-purple-500/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.05)]' : ''}`}
                        />

                        {/* Evaluate Button (HIDDEN IF SNAPSHOT OR EVALUATION EXISTS) */}
                        {!job && !evaluation && (
                            isEvaluating || (consoleStatus === 'error' && jobText) ? (
                                <div className="py-2 mt-4 animate-in fade-in duration-500">
                                    <AgentConsole mode="evaluating" logs={consoleLogs} status={consoleStatus} />
                                    {consoleStatus === 'error' && !isEvaluating && (
                                        <button onClick={() => setConsoleStatus('idle')} className="mt-4 w-full py-4 bg-red-950/20 border border-red-500/30 hover:bg-red-900/40 rounded-2xl text-red-400 text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(248,113,113,0.1)]">
                                            Dismiss Error & Retry Evaluation
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="relative group/btn mt-4">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover/btn:opacity-60 transition duration-500"></div>
                                    <button
                                        onClick={handleEvaluate}
                                        disabled={!jobText}
                                        className={`relative w-full py-4 bg-slate-900 font-bold uppercase tracking-widest rounded-2xl border border-white/10 hover:bg-slate-800 hover:border-pink-500/50 transition-all duration-300 active:scale-[0.98] overflow-hidden flex items-center justify-center gap-2 ${!jobText ? 'text-slate-500 opacity-80 cursor-not-allowed' : 'text-white'}`}
                                    >
                                        <span className="group-hover/btn:tracking-wider transition-all duration-300 flex items-center gap-2">Initialize Evaluation ⚡</span>
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* STAGE 3: Evaluation Results & Action Bar */}
                {evaluation && !isEvaluating && !isFetching && !isDeleting && (
                    <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-700 border-t border-slate-800 pt-10">
                        <div className="flex flex-col items-center justify-center mb-10 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-bold text-slate-300 uppercase tracking-widest mb-6 shadow-sm">
                                <span className="text-blue-400">🏢</span> {evaluation.workplaceType}
                            </div>
                            <h2 className="text-5xl font-black text-white tracking-tight mb-3 uppercase drop-shadow-md">{evaluation.companyName}</h2>
                            <h3 className="text-2xl font-medium text-slate-400">{evaluation.roleTitle}</h3>
                        </div>

                        <div className="flex flex-col items-center justify-center mb-12">
                            <div className="relative w-56 h-56 flex items-center justify-center">
                                <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${evaluation.matchScore >= 80 ? 'bg-emerald-500' : evaluation.matchScore >= 60 ? 'bg-yellow-500' : 'bg-pink-500'}`}></div>
                                <svg className="w-full h-full transform -rotate-90 relative z-10">
                                    <circle cx="112" cy="112" r="100" className="stroke-slate-800/80 fill-none" strokeWidth="14" />
                                    <circle
                                        cx="112" cy="112" r="100"
                                        className={`${getStrokeColor(evaluation.matchScore)} fill-none transition-all duration-1500 ease-out`}
                                        strokeWidth="14" strokeDasharray="628" strokeDashoffset={628 - (628 * evaluation.matchScore) / 100} strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute flex flex-col items-center justify-center text-center z-20">
                                    <span className={`text-6xl font-black tracking-tighter ${evaluation.matchScore >= 80 ? 'text-emerald-400' : evaluation.matchScore >= 60 ? 'text-yellow-400' : 'text-pink-500'}`}>
                                        {evaluation.matchScore}<span className="text-4xl">%</span>
                                    </span>
                                    <span className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-2">Semantic Match</span>
                                </div>
                            </div>
                        </div>

                        {evaluation.gaps && evaluation.gaps.length > 0 && (
                            <div className="mb-12">
                                <h4 className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">Identified Gaps</h4>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {evaluation.gaps.map((gap, index) => (
                                        <span key={index} className="bg-pink-950/40 border border-pink-500/30 text-pink-300 text-sm font-medium px-5 py-2.5 rounded-2xl shadow-sm">{gap}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-8">
                            <div className={`w-full py-5 rounded-2xl flex flex-col items-center justify-center gap-2 border border-dashed relative overflow-hidden ${evaluation.matchScore >= 80 ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.05)]' :
                                evaluation.matchScore >= 60 ? 'bg-yellow-950/20 text-yellow-400 border-yellow-500/50' :
                                    'bg-pink-950/20 text-pink-500 border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.05)]'
                                }`}>
                                <span className="text-[10px] font-black opacity-70 tracking-[0.3em] uppercase">ACE Final Verdict</span>
                                <span className="text-lg font-black uppercase tracking-widest drop-shadow-md">
                                    {evaluation.matchScore >= 80 ? '🟢 High Match: Proceed to Apply' :
                                        evaluation.matchScore >= 60 ? '🟡 Moderate Match: Tailor Heavily' :
                                            '🔴 Low Match: Pass on this Role'}
                                </span>
                                <span className="text-xs font-serif text-slate-400 mt-1 max-w-lg text-center leading-relaxed">
                                    "{evaluation.action}"
                                </span>
                            </div>
                        </div>

                        {/* --- GATEKEEPER UI INTERVENTION --- */}
                        {coachFeedback && (
                            <div className="mb-4 p-5 rounded-2xl bg-amber-950/20 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.05)] animate-in slide-in-from-top-4 fade-in duration-500 flex items-start gap-4">
                                <span className="text-amber-400 text-2xl mt-1 animate-pulse">💡</span>
                                <div>
                                    <h4 className="text-amber-400 font-bold text-[11px] uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                        ACE Strategic Override
                                        <span className="bg-amber-500/20 text-amber-300 text-[9px] px-2 py-0.5 rounded-full border border-amber-500/30">Action Paused</span>
                                    </h4>
                                    <p className="text-amber-200/80 text-sm font-serif leading-relaxed">{coachFeedback}</p>
                                </div>
                            </div>
                        )}

                        <div className="mb-5">
                            <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 hover:border-blue-500/50 rounded-2xl p-3 px-5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all shadow-inner">
                                <span className="text-blue-400/70 text-sm">🎯</span>
                                <input
                                    type="text"
                                    value={userInstruction}
                                    onChange={(e) => {
                                        setUserInstruction(e.target.value);
                                        if (coachFeedback) setCoachFeedback(null);
                                    }}
                                    placeholder="Optional: Provide custom instructions for ACE (e.g., 'Focus heavily on my .NET architecture skills')..."
                                    className="w-full bg-transparent text-slate-300 outline-none text-sm placeholder-slate-600 font-mono"
                                />
                            </div>
                        </div>

                        {/* --- ACTION BUTTONS (VERTICAL LIST WITH GLOW ANIMATIONS) --- */}
                        <div className="flex flex-col gap-4 w-full mb-10">

                            {/* ---> NEW: MOCK INTERVIEW BUTTON <--- */}
                            <div className="relative group/btn w-full">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 to-violet-500 rounded-2xl blur opacity-40 group-hover/btn:opacity-80 transition duration-500"></div>
                                <button
                                    onClick={() => alert("Connecting to Voice AI Simulator...")}
                                    className="relative w-full py-4 bg-[#0f172a] text-indigo-300 font-black uppercase tracking-widest rounded-2xl border border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-950/40 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-lg"
                                >
                                    <span className="group-hover/btn:tracking-wider transition-all duration-300 flex items-center gap-3">
                                        <span className="text-2xl drop-shadow-md animate-pulse">🤖</span> Start Mock Interview
                                    </span>
                                </button>
                            </div>

                            {/* Clear Data Button */}
                            <div className="relative group/btn w-full">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-700 to-slate-600 rounded-2xl blur opacity-20 group-hover/btn:opacity-50 transition duration-500"></div>
                                <button onClick={handleDelete} className="relative w-full py-4 bg-[#0f172a] text-slate-400 font-bold uppercase tracking-widest rounded-2xl border border-slate-700 hover:border-slate-500 hover:text-slate-200 transition-all duration-300 active:scale-[0.98] flex items-center justify-center">
                                    <span className="group-hover/btn:tracking-wider transition-all duration-300">
                                        Clear Screen
                                    </span>
                                </button>
                            </div>

                            {/* Save to History Button */}
                            <div className="relative group/btn w-full">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-30 group-hover/btn:opacity-70 transition duration-500"></div>
                                <button onClick={handleSaveToHistory} className="relative w-full py-4 bg-[#0f172a] text-blue-300 font-bold uppercase tracking-widest rounded-2xl border border-blue-500/30 hover:border-blue-400 hover:bg-blue-950/30 transition-all duration-300 active:scale-[0.98] flex items-center justify-center">
                                    <span className="group-hover/btn:tracking-wider transition-all duration-300 flex items-center gap-2">
                                        <span className="text-lg drop-shadow-md">💾</span> Save Snapshot
                                    </span>
                                </button>
                            </div>

                            {/* Auto-Tailor Button */}
                            {isTailoring ? (
                                <div className="w-full"><GenAILoader message="Optimizing Keywords..." /></div>
                            ) : (
                                <div className="relative group/btn w-full">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-30 group-hover/btn:opacity-70 transition duration-500"></div>
                                    <button onClick={handleTailorResume} className="relative w-full py-4 bg-[#0f172a] text-purple-300 font-bold uppercase tracking-widest rounded-2xl border border-purple-500/30 hover:border-purple-400 hover:bg-purple-950/30 transition-all duration-300 active:scale-[0.98] flex items-center justify-center">
                                        <span className="group-hover/btn:tracking-wider transition-all duration-300 flex items-center gap-2">
                                            <span className="text-lg drop-shadow-md">✨</span> Auto-Tailor Resume
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Generate Letter Button */}
                            {isGeneratingLetter ? (
                                <div className="w-full"><GenAILoader message="Drafting Cover Letter..." /></div>
                            ) : (
                                <div className="relative group/btn w-full">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-2xl blur opacity-30 group-hover/btn:opacity-70 transition duration-500"></div>
                                    <button onClick={handleGenerateLetter} className="relative w-full py-4 bg-[#0f172a] text-emerald-300 font-bold uppercase tracking-widest rounded-2xl border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/30 transition-all duration-300 active:scale-[0.98] flex items-center justify-center">
                                        <span className="group-hover/btn:tracking-wider transition-all duration-300 flex items-center gap-2">
                                            <span className="text-lg drop-shadow-md">📝</span> Generate Letter
                                        </span>
                                    </button>
                                </div>
                            )}

                        </div>

                        {tailoredSuggestions && Array.isArray(tailoredSuggestions) && (
                            <div className="relative z-10 mt-10 animate-in fade-in slide-in-from-top-4 duration-700">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-lg font-black text-white flex items-center gap-3 tracking-wide uppercase drop-shadow-md">
                                        <span className="bg-purple-500/20 p-2 rounded-2xl text-purple-400 border border-purple-500/30">✨</span> AI Editorial Strategy
                                    </h4>
                                </div>
                                <div className="space-y-8">
                                    {tailoredSuggestions.map((suggestion, index) => (
                                        <div key={index} className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                                            <div className="mb-6">
                                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase flex items-center gap-2 mb-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500/70"></span> Original Profile
                                                </span>
                                                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/50 text-slate-400 text-sm leading-relaxed line-through decoration-pink-500/30 font-serif">
                                                    {suggestion.original_bullet}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase flex items-center gap-2">
                                                    <span>🔄</span> Generated Options
                                                </span>
                                                {suggestion.variations && suggestion.variations.map((variation, vIndex) => {
                                                    const isBest = vIndex === suggestion.best_variation_index;

                                                    console.log("SUGGESTION DATA:", suggestion);

                                                    return (
                                                        <div key={vIndex} className={`p-4 rounded-2xl border relative transition-all duration-300 group/copy ${isBest ? 'bg-emerald-950/20 border-emerald-500/50 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'}`}>
                                                            {isBest && (
                                                                <div className="absolute -top-3 -right-2 bg-emerald-500 text-slate-950 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.5)] z-10">ACE Top Pick ⭐</div>
                                                            )}
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className={`text-[10px] font-bold uppercase tracking-wider ${isBest ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                                    Focus: {variation.focus}
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(variation.text);
                                                                        showToast(`Copied: ${variation.focus} Variation`);
                                                                    }}
                                                                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all duration-200 opacity-0 group-hover/copy:opacity-100 ${isBest ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-200'}`}
                                                                    title="Copy this bullet to clipboard"
                                                                >
                                                                    Copy
                                                                </button>
                                                            </div>
                                                            <div className={`text-sm leading-relaxed font-serif ${isBest ? 'text-emerald-100' : 'text-slate-300'}`}>
                                                                {variation.text}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-6 pt-5 border-t border-slate-800/60">
                                                <span className="text-[10px] font-black tracking-widest text-purple-400 uppercase mb-2 flex items-center gap-2">
                                                    <span>🧠</span> Why ACE chose Option {(suggestion.best_variation_index ?? suggestion.bestVariationIndex ?? suggestion.BestVariationIndex ?? 0) + 1}
                                                </span>
                                                <p className="text-slate-300 text-sm leading-relaxed italic border-l-2 border-purple-500/50 pl-4">
                                                    {suggestion.ACE_reasoning || suggestion.aceReasoning || suggestion.AceReasoning || suggestion.reasoning || suggestion.jarvis_reasoning || suggestion.jarvisReasoning || "Optimized mathematically for maximum semantic overlap with the core target requirements."}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {coverLetter && (
                            <div className="relative z-10 mt-8 pt-6 border-t border-slate-800/50 animate-in fade-in slide-in-from-top-4 duration-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <span className="bg-emerald-500/20 p-1.5 rounded-lg text-emerald-400">📝</span> Tailored Cover Letter
                                    </h4>
                                    <div className="flex gap-3">
                                        <button onClick={handleDownloadPDF} className="text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors flex items-center gap-2">
                                            <span>📄</span> Export PDF
                                        </button>
                                        <button onClick={() => { navigator.clipboard.writeText(coverLetter); showToast("Cover Letter Copied to Clipboard"); }} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                                            Copy Text
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl whitespace-pre-wrap text-slate-300 text-sm leading-relaxed font-serif shadow-inner">{coverLetter}</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ---> ACE TOAST NOTIFICATION HUD <--- */}
            {toastMessage && (
                <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-8 fade-in duration-300">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)] text-emerald-400 px-6 py-4 rounded-2xl font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-4">
                        <div className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                        </div>
                        {toastMessage}
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default MatchCard;