import React, { useState } from 'react';
import { jsPDF } from "jspdf";
import GenAILoader from './GenAILoader';
import AgentConsole from './AgentConsole';
import InterviewSimulator from './InterviewSimulator';

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
    const [manualPromptFallback, setManualPromptFallback] = useState(null);

    // Loading States
    const [isFetching, setIsFetching] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [isTailoring, setIsTailoring] = useState(false);
    const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showSimulator, setShowSimulator] = useState(false);
    const [isAsking, setIsAsking] = useState(false);

    // Data States
    const [evaluation, setEvaluation] = useState(null);
    const [coverLetter, setCoverLetter] = useState(null);
    const [tailoredSuggestions, setTailoredSuggestions] = useState(null);
    const [jobId, setJobId] = useState(null);
    const [lastSavedHash, setLastSavedHash] = useState(null);
    const [customAnswers, setCustomAnswers] = useState([]);

    // ---> HYBRID MODE INJECTION <---
    React.useEffect(() => {
        if (job) {
            setUrl(job.jobUrl || job.Url || '');
            setJobText(job.jobDescription || job.JobDescription || '');
            setJobId(job.id || job.Id);

            let realGaps = [];
            let realAction = "Review Match";
            let realWorkplace = "HYBRID/UNKNOWN";

            try {
                const evalStr = job.evaluationJson || job.EvaluationJson;
                if (evalStr) {
                    const parsedEval = typeof evalStr === 'string' ? JSON.parse(evalStr) : evalStr;
                    realGaps = parsedEval.missing_skills || [];
                    realAction = parsedEval.recommended_action || "Review Match";
                    realWorkplace = parsedEval.is_remote ? "REMOTE" : "ON-SITE";
                }
            } catch (e) {
                console.error("Failed to parse evaluation JSON", e);
            }

            setEvaluation({
                matchScore: job.matchScore || job.MatchScore || 0,
                companyName: job.companyName || job.CompanyName || "Unknown Company",
                roleTitle: job.roleTitle || job.RoleTitle || "Unknown Role",
                gaps: realGaps,
                action: realAction,
                workplaceType: realWorkplace
            });

            setCoverLetter(job.coverLetterText || job.CoverLetterText || null);

            try {
                const tailoredData = job.tailoredResumeJson || job.TailoredResumeJson;
                if (tailoredData) {
                    setTailoredSuggestions(typeof tailoredData === 'string' ? JSON.parse(tailoredData) : tailoredData);
                }

                const answersData = job.customAnswersJson || job.CustomAnswersJson;
                if (answersData) setCustomAnswers(typeof answersData === 'string' ? JSON.parse(answersData) : answersData);
            } catch (e) {
                console.error("Failed to parse tailored suggestions", e);
            }
        }
    }, [job]);

    // --- HELPER FUNCTIONS ---
    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 4000);
    };

    const handleSaveToHistory = async () => {
        if (!evaluation) return;
        const currentDataString = JSON.stringify({ evaluation, coverLetter, tailoredSuggestions, customAnswers });
        if (lastSavedHash === currentDataString) return showToast("⚠️ Already Saved: No new changes detected");

        try {
            const derivedStage = job?.pipelineStage || job?.PipelineStage || (screenshot ? "Queued" : "Manual");
            const payload = {
                JobId: jobId, Url: url, JobDescription: jobText,
                Evaluation: evaluation, CoverLetter: coverLetter,
                TailoredSuggestions: tailoredSuggestions,
                CustomAnswers: customAnswers,
                PipelineStage: derivedStage
            };

            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/save-history", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Backend Error`);
            const data = await response.json();
            if (data.jobId && !jobId) setJobId(data.jobId);
            setLastSavedHash(currentDataString);
            showToast("💾 Application Snapshot Saved to Vault");
            window.dispatchEvent(new Event('vaultUpdated'));
        } catch (error) {
            showToast(`🚨 Save failed`);
            console.error("Failed in saving Snapshot to Vault", error);
        }
    };

    const getStrokeColor = (score) => {
        if (score >= 80) return 'stroke-emerald-400';
        if (score >= 60) return 'stroke-yellow-400';
        return 'stroke-pink-500';
    };

    const generateFallbackPrompt = (intent) => {
        return `I am applying for the ${evaluation?.roleTitle || "role"} at ${evaluation?.companyName || "this company"}.\n\nHere is the Job Description:\n${jobText}\n\nMy Instruction/Question: ${userInstruction || intent}\n\nPlease analyze this using my standard professional context.`;
    };

    // --- HANDLERS ---
    const handleFetchData = async () => {
        if (!url) return showToast("Please enter a job URL.");
        setIsFetching(true);
        setConsoleStatus('processing');
        setConsoleLogs(["> INITIATING STEALTH BROWSER ENGINE..."]);
        setJobText(''); setScreenshot(null); setEvaluation(null); setCoverLetter(null);
        setTailoredSuggestions(null); setCoachFeedback(null); setCustomAnswers([]);

        try {
            setTimeout(() => setConsoleLogs(prev => [...prev, "> BYPASSING WAF & EXTRACTING DOM..."]), 800);
            setTimeout(() => setConsoleLogs(prev => [...prev, "> AWAITING SCRAPER PAYLOAD . . ."]), 1600);

            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/scrape-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(url)
            });

            if (!response.ok) {
                const errorText = await response.text();
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

    const handleEvaluate = async () => {
        if (!jobText) return showToast("Please fetch or paste job description text first.");
        setIsEvaluating(true);
        setConsoleStatus('processing');
        setConsoleLogs(["> SPINNING UP SEMANTIC KERNEL..."]);

        try {
            setTimeout(() => setConsoleLogs(prev => [...prev, "> TOKENIZING JOB DESCRIPTION & POSTGRESQL PROFILE..."]), 800);
            setTimeout(() => setConsoleLogs(prev => [...prev, "> AWAITING LLM NEURAL EVALUATION . . ."]), 1600);

            const payload = { jobDescriptionText: jobText, jobUrl: url };
            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/evaluate-job", {
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
            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/tailor-resume", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 429) {
                    throw new Error("⚠️ ACE Core: AI Token quota exhausted. Please rest and resume tomorrow.");
                }
                throw new Error(`Tailoring API Failed (${response.status}):\n${errorText || "Unknown backend error"}`);
            }
            const data = await response.json();

            if (data.is_instruction_accepted === false) {
                setCoachFeedback(data.coach_feedback);
                return;
            }

            setTailoredSuggestions(data.suggestions);

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
            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/generate-cover-letter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 429) {
                    throw new Error("⚠️ ACE Core: AI Token quota exhausted. Please rest and resume tomorrow.");
                }
                throw new Error(`Cover Letter API Failed (${response.status}):\n${errorText || "Unknown backend error"}`);
            }
            const data = await response.json();

            if (data.is_instruction_accepted === false) {
                setCoachFeedback(data.coach_feedback);
                return;
            }

            setCoverLetter(data.cover_letter);

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

    const handleAskACE = async () => {
        if (!userInstruction) return showToast("Please type a question or instruction first.");
        setIsAsking(true);
        setCoachFeedback(null);
        setManualPromptFallback(null);

        try {
            const payload = { JobDescription: jobText, Question: userInstruction };
            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/ask-question", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 429) {
                    setManualPromptFallback(generateFallbackPrompt("Please answer this strategic question based on my resume and the job description."));
                    throw new Error("⚠️ Token quota exhausted. Use the fallback prompt below.");
                }
                throw new Error("Backend error");
            }

            const data = await response.json();
            setCustomAnswers(prev => [{ question: userInstruction, answer: data.answer }, ...prev]);
            setUserInstruction('');
            showToast("🧠 Custom Strategy Generated");
        } catch (error) {
            showToast(`🚨 ${error.message}`);
        } finally {
            setIsAsking(false);
        }
    };

    const handleExportPDF = () => {
        if (!coverLetter && !tailoredSuggestions && customAnswers.length === 0) {
            return showToast("⚠️ Nothing to export! Generate artifacts first.");
        }

        const doc = new jsPDF();
        const margin = 15;
        let yPos = 20;
        const pageHeight = doc.internal.pageSize.height;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text(`Application Kit: ${evaluation?.companyName || "Target Role"}`, margin, yPos);
        yPos += 15;

        const checkPageBreak = (addedHeight) => {
            if (yPos + addedHeight >= pageHeight - 15) {
                doc.addPage();
                yPos = 20;
            }
        };

        const printSection = (title, content) => {
            checkPageBreak(30);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(title, margin, yPos);
            yPos += 8;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            // Quick regex to strip markdown bolding **
            const cleanContent = content.replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(cleanContent, 180);

            splitText.forEach(line => {
                checkPageBreak(10);
                doc.text(line, margin, yPos);
                yPos += 6;
            });
            yPos += 5; // Bottom padding
        };

        if (coverLetter) printSection("Cover Letter", coverLetter);

        if (tailoredSuggestions) {
            const formattedSuggestions = typeof tailoredSuggestions === 'string'
                ? tailoredSuggestions
                : JSON.stringify(tailoredSuggestions, null, 2);
            printSection("Tailored Resume Bullets", formattedSuggestions);
        }

        if (customAnswers.length > 0) {
            // FIXED: Removed the unused 'idx' argument
            customAnswers.forEach((qa) => {
                printSection(`Q: ${qa.question}`, qa.answer);
            });
        }

        const safeCompanyName = (evaluation?.companyName || "Job").replace(/[^a-zA-Z0-9]/g, "_");
        doc.save(`ACE_Application_Kit_${safeCompanyName}.pdf`);
        showToast("📄 Custom Application Kit Downloaded!");
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        setTimeout(() => {
            setJobText(''); setEvaluation(null); setCoverLetter(null); setTailoredSuggestions(null);
            setCustomAnswers([]); setUrl(''); setUserInstruction(''); setCoachFeedback(null);
            setJobId(null); setLastSavedHash(null); setScreenshot(null); setManualPromptFallback(null);
            setIsDeleting(false);
        }, 2000);
    };

    // --- RENDER ---
    return (
        <div className="relative group w-full max-w-4xl mx-auto h-full flex flex-col">

            {/* The outer glowing ring */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-300 rounded-[38px] blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200 animate-pulse"></div>

            {/* ---> The Main Frame <--- */}
            <div className="relative bg-white/85 backdrop-blur-2xl rounded-[36px] border border-white/60 shadow-[0_20px_50px_-10px_rgba(139,92,246,0.15)] flex flex-col h-full overflow-hidden">

                {/* ---> THE INNER SCROLLING VIEWPORT <--- */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">

                    {/* ---> VAULT HEADER WITH "VIEW ORIGINAL" BUTTON <--- */}
                    {job && (
                        <div className="mb-6 flex items-center justify-between bg-violet-50 border border-violet-100 px-5 py-3 rounded-xl shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]"></span>
                                <span className="text-violet-800 text-xs font-black uppercase tracking-widest font-mono">Vault Snapshot Loaded</span>
                            </div>
                            {url && (
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-violet-600 hover:text-white bg-white hover:bg-violet-600 border border-violet-200 px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm">
                                    <span>🔗</span> View Job Post
                                </a>
                            )}
                        </div>
                    )}

                    {/* STAGE 1: URL Input & Fetching */}
                    {!job && (
                        <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-3 bg-white border border-violet-200 rounded-2xl p-2 px-4 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all shadow-sm">
                                <span className="text-violet-400">🔗</span>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://jobs.company.com/..."
                                    className="w-full bg-transparent text-slate-800 outline-none text-sm placeholder-slate-400 font-mono"
                                />
                            </div>

                            <div className="relative group/btn mt-4">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 rounded-2xl blur opacity-30 group-hover/btn:opacity-60 transition duration-500"></div>
                                <button
                                    onClick={handleFetchData}
                                    disabled={isFetching || isEvaluating}
                                    className="relative w-full py-4 bg-violet-600 text-white font-bold uppercase tracking-widest rounded-2xl border border-violet-500 hover:bg-violet-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
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
                                <button onClick={() => setConsoleStatus('idle')} className="mt-4 w-full py-4 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-2xl text-rose-600 text-xs font-bold tracking-widest uppercase transition-all shadow-sm">
                                    Acknowledge Error & Paste Manually
                                </button>
                            )}
                        </div>
                    ) : isDeleting ? (
                        <div className="py-8"><GenAILoader message="Purging from Core Memory..." /></div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-500">

                            {/* SCREENSHOT RENDER */}
                            {screenshot && !job && (
                                <div className="relative group rounded-2xl overflow-hidden border border-violet-100 shadow-md mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-slate-900/10 to-transparent z-10 pointer-events-none"></div>
                                    <img src={`data:image/jpeg;base64,${screenshot}`} alt="ACE Target Lock" className="w-full h-48 object-cover object-top opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                        <span className="text-xs font-mono text-emerald-100 font-bold uppercase tracking-widest drop-shadow-md">Target Acquired // Visual Receipt</span>
                                    </div>
                                </div>
                            )}

                            {/* JD TEXTAREA */}
                            <textarea
                                value={jobText}
                                onChange={(e) => setJobText(e.target.value)}
                                readOnly={!!job}
                                placeholder="Raw job description text will appear here. If blocked by WAF, paste manually..."
                                className={`w-full h-48 bg-violet-50/50 border border-violet-200 rounded-xl p-4 text-slate-700 text-sm focus:outline-none focus:border-violet-400 custom-scrollbar font-mono leading-relaxed mt-4 ${job ? 'opacity-90 cursor-default shadow-inner' : 'shadow-sm'}`}
                            />

                            {/* Evaluate Button */}
                            {!job && !evaluation && (
                                isEvaluating || (consoleStatus === 'error' && jobText) ? (
                                    <div className="py-2 mt-4 animate-in fade-in duration-500">
                                        <AgentConsole mode="evaluating" logs={consoleLogs} status={consoleStatus} />
                                        {consoleStatus === 'error' && !isEvaluating && (
                                            <button onClick={() => setConsoleStatus('idle')} className="mt-4 w-full py-4 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-2xl text-rose-600 text-xs font-bold tracking-widest uppercase transition-all shadow-sm">
                                                Dismiss Error & Retry Evaluation
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative group/btn mt-4">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-fuchsia-400 via-purple-400 to-pink-400 rounded-2xl blur opacity-30 group-hover/btn:opacity-60 transition duration-500"></div>
                                        <button
                                            onClick={handleEvaluate}
                                            disabled={!jobText}
                                            className={`relative w-full py-4 font-bold uppercase tracking-widest rounded-2xl border transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 ${!jobText ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-fuchsia-600 border-fuchsia-500 text-white hover:bg-fuchsia-700 shadow-md'}`}
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
                        <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-700 border-t border-violet-100 pt-10">
                            <div className="flex flex-col items-center justify-center mb-10 text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-violet-200 text-xs font-bold text-violet-700 uppercase tracking-widest mb-6 shadow-sm">
                                    <span className="text-violet-500">🏢</span> {evaluation.workplaceType}
                                </div>
                                <h2 className="text-5xl font-black text-slate-800 tracking-tight mb-3 uppercase drop-shadow-sm">{evaluation.companyName}</h2>
                                <h3 className="text-2xl font-medium text-violet-600">{evaluation.roleTitle}</h3>
                            </div>

                            <div className="flex flex-col items-center justify-center mb-12">
                                <div className="relative w-56 h-56 flex items-center justify-center">
                                    <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${evaluation.matchScore >= 80 ? 'bg-emerald-400' : evaluation.matchScore >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}></div>
                                    <svg className="w-full h-full transform -rotate-90 relative z-10">
                                        <circle cx="112" cy="112" r="100" className="stroke-slate-100 fill-none" strokeWidth="14" />
                                        <circle
                                            cx="112" cy="112" r="100"
                                            className={`${getStrokeColor(evaluation.matchScore)} fill-none transition-all duration-1500 ease-out`}
                                            strokeWidth="14" strokeDasharray="628" strokeDashoffset={628 - (628 * evaluation.matchScore) / 100} strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center justify-center text-center z-20">
                                        <span className={`text-6xl font-black tracking-tighter ${evaluation.matchScore >= 80 ? 'text-emerald-500' : evaluation.matchScore >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                                            {evaluation.matchScore}<span className="text-4xl">%</span>
                                        </span>
                                        <span className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-2">Semantic Match</span>
                                    </div>
                                </div>
                            </div>

                            {evaluation.gaps && evaluation.gaps.length > 0 && (
                                <div className="mb-12">
                                    <h4 className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Identified Gaps</h4>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        {evaluation.gaps.map((gap, index) => (
                                            <span key={index} className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium px-5 py-2.5 rounded-2xl shadow-sm">{gap}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mb-8">
                                <div className={`w-full py-5 rounded-2xl flex flex-col items-center justify-center gap-2 border border-dashed relative overflow-hidden ${evaluation.matchScore >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                                    evaluation.matchScore >= 60 ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                        'bg-rose-50 text-rose-700 border-rose-300'
                                    }`}>
                                    <span className="text-[10px] font-black opacity-70 tracking-[0.3em] uppercase">ACE Final Verdict</span>
                                    <span className="text-lg font-black uppercase tracking-widest">
                                        {evaluation.matchScore >= 80 ? '🟢 High Match: Proceed to Apply' :
                                            evaluation.matchScore >= 60 ? '🟡 Moderate Match: Tailor Heavily' :
                                                '🔴 Low Match: Pass on this Role'}
                                    </span>
                                    <span className="text-xs font-serif mt-1 max-w-lg text-center leading-relaxed">
                                        "{evaluation.action}"
                                    </span>
                                </div>
                            </div>

                            {/* --- GATEKEEPER UI INTERVENTION --- */}
                            {coachFeedback && (
                                <div className="mb-4 p-5 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm animate-in slide-in-from-top-4 fade-in duration-500 flex items-start gap-4">
                                    <span className="text-amber-500 text-2xl mt-1 animate-pulse">💡</span>
                                    <div>
                                        <h4 className="text-amber-700 font-bold text-[11px] uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                            ACE Strategic Override
                                            <span className="bg-amber-100 text-amber-800 text-[9px] px-2 py-0.5 rounded-full border border-amber-200">Action Paused</span>
                                        </h4>
                                        <p className="text-amber-800 text-sm font-serif leading-relaxed">{coachFeedback}</p>
                                    </div>
                                </div>
                            )}

                            {/* --- THE STRATEGIC OVERRIDE BAR --- */}
                            <div className="mb-5 mt-8">
                                <div className="flex items-center gap-3 bg-white border border-violet-200 hover:border-violet-300 rounded-2xl p-3 px-5 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all shadow-sm">
                                    <span className="text-violet-400 text-sm">🎯</span>
                                    <input
                                        type="text"
                                        value={userInstruction}
                                        onChange={(e) => {
                                            setUserInstruction(e.target.value);
                                            if (coachFeedback) setCoachFeedback(null);
                                        }}
                                        placeholder="Command ACE: 'Tailor resume for AWS' OR 'Why am I a fit for this role?'..."
                                        className="w-full bg-transparent text-slate-700 outline-none text-sm placeholder-slate-400 font-mono"
                                    />
                                </div>
                            </div>

                            {/* --- ACTION BUTTONS GRID --- */}
                            <div className="grid grid-cols-2 gap-4 w-full mb-10">
                                <button onClick={() => setShowSimulator(true)} className="col-span-2 relative w-full py-4 bg-violet-600 text-white font-black uppercase tracking-widest rounded-2xl border border-violet-500 hover:bg-violet-700 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-md gap-3">
                                    <span className="text-2xl drop-shadow-sm animate-pulse">🤖</span> Start Mock Interview
                                </button>

                                <button onClick={handleTailorResume} disabled={isTailoring} className="py-4 bg-white text-fuchsia-600 font-bold uppercase tracking-widest rounded-2xl border border-fuchsia-200 hover:bg-fuchsia-50 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-sm gap-2">
                                    {isTailoring ? "..." : "✨ Tailor Resume"}
                                </button>

                                <button onClick={handleGenerateLetter} disabled={isGeneratingLetter} className="py-4 bg-white text-teal-600 font-bold uppercase tracking-widest rounded-2xl border border-teal-200 hover:bg-teal-50 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-sm gap-2">
                                    {isGeneratingLetter ? "..." : "📝 Write Letter"}
                                </button>

                                <button onClick={handleAskACE} disabled={isAsking || !userInstruction} className="col-span-2 py-4 bg-indigo-50 text-indigo-700 font-bold uppercase tracking-widest rounded-2xl border border-indigo-200 hover:bg-indigo-100 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isAsking ? "Processing..." : "🧠 Ask ACE / Generate Q&A"}
                                </button>

                                <button onClick={handleExportPDF} className="py-4 bg-slate-800 text-white font-bold uppercase tracking-widest rounded-2xl hover:bg-slate-900 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-sm gap-2">
                                    📄 Export PDF Kit
                                </button>

                                <button onClick={handleSaveToHistory} className="py-4 bg-blue-50 text-blue-700 font-bold uppercase tracking-widest rounded-2xl border border-blue-200 hover:bg-blue-100 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-sm gap-2">
                                    💾 Save Snapshot
                                </button>

                                {/* ---> RESTORED: CLEAR SCREEN BUTTON <--- */}
                                <button onClick={handleDelete} className="col-span-2 py-4 bg-rose-50 text-rose-600 font-bold uppercase tracking-widest rounded-2xl border border-rose-200 hover:bg-rose-100 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-sm gap-2">
                                    🧹 Clear Matrix Data
                                </button>
                            </div>

                            {/* ---> TOKEN EXHAUSTION FALLBACK <--- */}
                            {manualPromptFallback && (
                                <div className="mb-8 p-6 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm animate-in slide-in-from-top-4 fade-in duration-500">
                                    <h4 className="text-amber-800 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                                        ⚠️ Google API Quota Reached: Manual Override
                                    </h4>
                                    <p className="text-amber-700 text-sm mb-4">Paste this prompt directly into Google Gemini to continue your session:</p>
                                    <textarea readOnly value={manualPromptFallback} className="w-full h-32 bg-white border border-amber-200 rounded-xl p-3 text-sm text-slate-600 font-mono mb-3" />
                                    <button onClick={() => { navigator.clipboard.writeText(manualPromptFallback); showToast("Fallback Prompt Copied"); }} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest">
                                        Copy Prompt
                                    </button>
                                </div>
                            )}

                            {/* ---> CUSTOM ANSWERS DISPLAY <--- */}
                            {customAnswers.length > 0 && (
                                <div className="space-y-6 mb-8">
                                    <h4 className="text-lg font-black text-slate-800 flex items-center gap-3 tracking-wide uppercase border-b border-slate-100 pb-2">
                                        <span className="bg-indigo-100 p-2 rounded-2xl text-indigo-600">🧠</span> Strategic Intelligence
                                    </h4>
                                    {customAnswers.map((qa, idx) => (
                                        <div key={idx} className="bg-white border border-indigo-100 p-6 rounded-2xl shadow-sm relative group">
                                            <p className="text-indigo-800 font-bold text-sm mb-3">Q: {qa.question}</p>
                                            <p className="text-slate-600 text-sm font-serif leading-relaxed whitespace-pre-wrap">{qa.answer}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* TAILORED SUGGESTIONS */}
                            {tailoredSuggestions && Array.isArray(tailoredSuggestions) && (
                                <div className="relative z-10 mt-10 animate-in fade-in slide-in-from-top-4 duration-700">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-lg font-black text-slate-800 flex items-center gap-3 tracking-wide uppercase">
                                            <span className="bg-violet-100 p-2 rounded-2xl text-violet-600 border border-violet-200">✨</span> AI Editorial Strategy
                                        </h4>
                                    </div>
                                    <div className="space-y-8">
                                        {tailoredSuggestions.map((suggestion, index) => (
                                            <div key={index} className="bg-white border border-violet-100 p-6 rounded-2xl shadow-md relative overflow-hidden group">
                                                <div className="mb-6">
                                                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase flex items-center gap-2 mb-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Original Profile
                                                    </span>
                                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 text-sm leading-relaxed line-through decoration-rose-300 font-serif">
                                                        {suggestion.original_bullet}
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <span className="text-[10px] font-black tracking-widest text-violet-500 uppercase flex items-center gap-2">
                                                        <span>🔄</span> Generated Options
                                                    </span>
                                                    {suggestion.variations && suggestion.variations.map((variation, vIndex) => {
                                                        const isBest = vIndex === suggestion.best_variation_index;
                                                        return (
                                                            <div key={vIndex} className={`p-4 rounded-2xl border relative transition-all duration-300 group/copy ${isBest ? 'bg-emerald-50 border-emerald-200 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                                                {isBest && (
                                                                    <div className="absolute -top-3 -right-2 bg-emerald-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm z-10">ACE Top Pick ⭐</div>
                                                                )}
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isBest ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                                        Focus: {variation.focus}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(variation.text);
                                                                            showToast(`Copied: ${variation.focus} Variation`);
                                                                        }}
                                                                        className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all duration-200 opacity-0 group-hover/copy:opacity-100 ${isBest ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                                                        title="Copy this bullet to clipboard"
                                                                    >
                                                                        Copy
                                                                    </button>
                                                                </div>
                                                                <div className={`text-sm leading-relaxed font-serif ${isBest ? 'text-emerald-900' : 'text-slate-700'}`}>
                                                                    {variation.text}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-6 pt-5 border-t border-violet-100">
                                                    <span className="text-[10px] font-black tracking-widest text-violet-500 uppercase mb-2 flex items-center gap-2">
                                                        <span>🧠</span> Why ACE chose Option {(suggestion.best_variation_index ?? suggestion.bestVariationIndex ?? suggestion.BestVariationIndex ?? 0) + 1}
                                                    </span>
                                                    <p className="text-slate-600 text-sm leading-relaxed italic border-l-2 border-violet-300 pl-4">
                                                        {suggestion.ACE_reasoning || suggestion.aceReasoning || suggestion.AceReasoning || suggestion.reasoning || suggestion.jarvis_reasoning || suggestion.jarvisReasoning || "Optimized mathematically for maximum semantic overlap with the core target requirements."}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* COVER LETTER */}
                            {coverLetter && (
                                <div className="relative z-10 mt-8 pt-6 border-t border-violet-100 animate-in fade-in slide-in-from-top-4 duration-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <span className="bg-teal-100 p-1.5 rounded-lg text-teal-600">📝</span> Tailored Cover Letter
                                        </h4>
                                        <div className="flex gap-3">
                                            <button onClick={() => { navigator.clipboard.writeText(coverLetter); showToast("Cover Letter Copied to Clipboard"); }} className="text-xs font-bold text-teal-600 hover:text-teal-700 uppercase tracking-widest bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors">
                                                Copy Text
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-violet-200 p-6 rounded-2xl whitespace-pre-wrap text-slate-700 text-sm leading-relaxed font-serif shadow-sm">{coverLetter}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* TOAST HUD */}
            {toastMessage && (
                <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-8 fade-in duration-300">
                    <div className="bg-white/90 backdrop-blur-xl border border-emerald-200 shadow-lg text-emerald-700 px-6 py-4 rounded-2xl font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-4">
                        <div className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-sm"></span>
                        </div>
                        {toastMessage}
                    </div>
                </div>
            )}

            {/* SIMULATOR */}
            {showSimulator && (
                <InterviewSimulator job={job || evaluation} onClose={() => setShowSimulator(false)} />
            )}
        </div>
    );
};

export default MatchCard;