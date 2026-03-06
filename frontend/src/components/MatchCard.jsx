import React, { useState } from 'react';
import { jsPDF } from "jspdf";
import GenAILoader from './GenAILoader';
import AgentConsole from './AgentConsole';
import InterviewSimulator from './InterviewSimulator';
import WaterfallScroll from './WaterfallScroll';

const MatchCard = ({ job = null, onClose }) => {
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
            const cleanContent = content.replace(/\*\*/g, '');
            const splitText = doc.splitTextToSize(cleanContent, 180);

            splitText.forEach(line => {
                checkPageBreak(10);
                doc.text(line, margin, yPos);
                yPos += 6;
            });
            yPos += 5;
        };

        if (coverLetter) printSection("Cover Letter", coverLetter);

        if (tailoredSuggestions) {
            const formattedSuggestions = typeof tailoredSuggestions === 'string'
                ? tailoredSuggestions
                : JSON.stringify(tailoredSuggestions, null, 2);
            printSection("Tailored Resume Bullets", formattedSuggestions);
        }

        if (customAnswers.length > 0) {
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
            if (onClose) onClose();
        }, 1500);
    };

    // --- RENDER ---
    return (
        <div className="relative group w-full max-w-4xl mx-auto h-full flex flex-col">

            {/* The outer glowing ring */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-300 rounded-[38px] blur opacity-30 animate-pulse pointer-events-none"></div>

            {/* ---> The Main Frame <--- */}
            <div className="relative bg-slate-50/90 backdrop-blur-3xl rounded-[36px] border border-white/80 shadow-[0_20px_50px_-10px_rgba(139,92,246,0.15)] flex flex-col h-full overflow-hidden">

                {/* ---> THE HEADER & CLOSE BUTTON (Always visible at the top) <--- */}
                <div className="px-8 pt-8 pb-4 flex justify-between items-start z-30 relative shrink-0">
                    {job ? (
                        <div className="flex items-center gap-3 bg-violet-100/50 border border-violet-200/50 px-5 py-2.5 rounded-xl shadow-sm backdrop-blur-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]"></span>
                            <span className="text-violet-800 text-xs font-black uppercase tracking-widest font-mono">Vault Snapshot Loaded</span>
                            {url && (
                                <a href={url} target="_blank" rel="noopener noreferrer" className="ml-2 text-[10px] font-black uppercase tracking-widest text-violet-600 hover:text-white bg-white hover:bg-violet-600 border border-violet-200 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm">
                                    <span>🔗</span> View Post
                                </a>
                            )}
                        </div>
                    ) : (
                        <div className="text-xl font-black tracking-widest uppercase text-slate-300 flex items-center gap-2">
                            <span className="text-violet-400">⚡</span> ACE Matrix
                        </div>
                    )}

                    {onClose && (
                        <button onClick={onClose} className="p-2.5 bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-500 hover:border-rose-200 rounded-2xl transition-all shadow-sm active:scale-95">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    )}
                </div>

                {/* ---> THE WATERFALL SCROLL WRAPPER <--- */}
                <WaterfallScroll className="px-8 pb-8 pt-2">

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
                                    className="w-full bg-transparent text-slate-800 outline-none text-sm placeholder-slate-400 font-mono py-1"
                                />
                            </div>

                            <button onClick={handleFetchData} disabled={isFetching || isEvaluating} className="relative w-full py-4 bg-violet-600 text-white font-bold uppercase tracking-widest rounded-2xl border border-violet-500 hover:bg-violet-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-md flex items-center justify-center gap-2">
                                <span>{isFetching ? "Fetching..." : "Fetch Job Data 🌐"}</span>
                            </button>
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
                                <div className="relative group rounded-2xl overflow-hidden border border-violet-100 shadow-md mb-4">
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-slate-900/10 to-transparent z-10 pointer-events-none"></div>
                                    <img src={`data:image/jpeg;base64,${screenshot}`} alt="ACE Target Lock" className="w-full h-48 object-cover object-top opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                        <span className="text-xs font-mono text-emerald-100 font-bold uppercase tracking-widest drop-shadow-md">Target Acquired</span>
                                    </div>
                                </div>
                            )}

                            {/* JD TEXTAREA */}
                            <textarea
                                value={jobText}
                                onChange={(e) => setJobText(e.target.value)}
                                readOnly={!!job}
                                placeholder="Raw job description text will appear here..."
                                className={`w-full h-40 bg-white border border-slate-200 rounded-2xl p-5 text-slate-600 text-xs focus:outline-none focus:border-violet-400 custom-scrollbar font-mono leading-relaxed mt-2 ${job ? 'cursor-default shadow-sm' : 'shadow-inner'}`}
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
                                    <button onClick={handleEvaluate} disabled={!jobText} className={`mt-4 w-full py-4 font-bold uppercase tracking-widest rounded-2xl border transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 ${!jobText ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-fuchsia-600 border-fuchsia-500 text-white hover:bg-fuchsia-700 shadow-md'}`}>
                                        <span>Initialize Evaluation ⚡</span>
                                    </button>
                                )
                            )}
                        </div>
                    )}

                    {/* STAGE 3: Evaluation Results & Action Bar */}
                    {evaluation && !isEvaluating && !isFetching && !isDeleting && (
                        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 border-t border-slate-200 pt-8">

                            {/* MATCH SCORE & TITLE */}
                            <div className="flex flex-col items-center justify-center mb-8 text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 shadow-sm">
                                    <span className="text-violet-500">🏢</span> {evaluation.workplaceType}
                                </div>
                                <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-2 uppercase">{evaluation.companyName}</h2>
                                <h3 className="text-lg font-bold text-violet-600 mb-8">{evaluation.roleTitle}</h3>

                                <div className="relative w-48 h-48 flex items-center justify-center">
                                    <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${evaluation.matchScore >= 80 ? 'bg-emerald-400' : evaluation.matchScore >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}></div>
                                    <svg className="w-full h-full transform -rotate-90 relative z-10">
                                        <circle cx="96" cy="96" r="84" className="stroke-white fill-none" strokeWidth="12" />
                                        <circle
                                            cx="96" cy="96" r="84"
                                            className={`${getStrokeColor(evaluation.matchScore)} fill-none transition-all duration-1500 ease-out`}
                                            strokeWidth="12" strokeDasharray="527" strokeDashoffset={527 - (527 * evaluation.matchScore) / 100} strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center justify-center text-center z-20">
                                        <span className={`text-5xl font-black tracking-tighter ${evaluation.matchScore >= 80 ? 'text-emerald-500' : evaluation.matchScore >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                                            {evaluation.matchScore}<span className="text-2xl">%</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Match</span>
                                    </div>
                                </div>
                            </div>

                            {/* --- THE STRATEGIC OVERRIDE BAR (Merged Input + Ask ACE) --- */}
                            <div className="mb-6 mt-8">
                                <div className="flex flex-col sm:flex-row gap-3 bg-white border border-violet-200 hover:border-violet-300 rounded-2xl p-2 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-50 transition-all shadow-sm">
                                    <div className="flex items-center gap-3 flex-1 px-3">
                                        <span className="text-violet-400 text-sm">🎯</span>
                                        <input
                                            type="text"
                                            value={userInstruction}
                                            onChange={(e) => {
                                                setUserInstruction(e.target.value);
                                                if (coachFeedback) setCoachFeedback(null);
                                            }}
                                            onKeyDown={(e) => e.key === 'Enter' && userInstruction && handleAskACE()}
                                            placeholder="Command ACE: 'Tailor for AWS' or 'Why am I a fit?'..."
                                            className="w-full bg-transparent text-slate-700 outline-none text-sm placeholder-slate-400 font-mono py-2"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAskACE}
                                        disabled={isAsking || !userInstruction}
                                        className="py-3 px-6 bg-indigo-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-indigo-700 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        {isAsking ? "Thinking..." : "🧠 Ask ACE"}
                                    </button>
                                </div>
                            </div>

                            {/* --- PRIMARY CORE TOOLS --- */}
                            <div className="grid grid-cols-2 gap-4 w-full mb-4">
                                <button onClick={handleTailorResume} disabled={isTailoring} className="py-4 bg-white text-fuchsia-600 font-black uppercase tracking-widest rounded-2xl border border-fuchsia-200 hover:bg-fuchsia-50 hover:border-fuchsia-300 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-sm gap-2 text-xs">
                                    {isTailoring ? "Processing..." : "✨ Auto-Tailor Resume"}
                                </button>

                                <button onClick={handleGenerateLetter} disabled={isGeneratingLetter} className="py-4 bg-white text-teal-600 font-black uppercase tracking-widest rounded-2xl border border-teal-200 hover:bg-teal-50 hover:border-teal-300 transition-all duration-300 active:scale-[0.98] flex items-center justify-center shadow-sm gap-2 text-xs">
                                    {isGeneratingLetter ? "Drafting..." : "📝 Generate Cover Letter"}
                                </button>
                            </div>

                            {/* --- SECONDARY UTILITY TOOLS --- */}
                            <div className={`grid ${job ? 'grid-cols-2' : 'grid-cols-3'} gap-3 w-full mb-10`}>
                                <button onClick={() => setShowSimulator(true)} className="py-3 bg-violet-50 text-violet-700 font-bold uppercase tracking-widest text-[9px] rounded-xl border border-violet-100 hover:bg-violet-100 hover:border-violet-200 transition-all duration-300 active:scale-[0.98] flex flex-col sm:flex-row items-center justify-center shadow-sm gap-2">
                                    <span className="text-lg">🤖</span> Mock Interview
                                </button>

                                <button onClick={handleSaveToHistory} className="py-3 bg-blue-50 text-blue-700 font-bold uppercase tracking-widest text-[9px] rounded-xl border border-blue-100 hover:bg-blue-100 hover:border-blue-200 transition-all duration-300 active:scale-[0.98] flex flex-col sm:flex-row items-center justify-center shadow-sm gap-2">
                                    <span className="text-lg">💾</span> Save in Vault
                                </button>

                                {!job && (
                                    <button onClick={handleDelete} className="py-3 bg-rose-50 text-rose-600 font-bold uppercase tracking-widest text-[9px] rounded-xl border border-rose-100 hover:bg-rose-100 hover:border-rose-200 transition-all duration-300 active:scale-[0.98] flex flex-col sm:flex-row items-center justify-center shadow-sm gap-2">
                                        <span className="text-lg">🧹</span> Clear Screen
                                    </button>
                                )}
                            </div>

                            {/* ---> TOKEN EXHAUSTION FALLBACK <--- */}
                            {manualPromptFallback && (
                                <div className="mb-8 p-6 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm animate-in slide-in-from-top-4 fade-in duration-500">
                                    <h4 className="text-amber-800 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                                        ⚠️ API Quota Reached: Manual Override
                                    </h4>
                                    <textarea readOnly value={manualPromptFallback} className="w-full h-32 bg-white border border-amber-200 rounded-xl p-3 text-sm text-slate-600 font-mono mb-3" />
                                    <button onClick={() => { navigator.clipboard.writeText(manualPromptFallback); showToast("Fallback Prompt Copied"); }} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest">
                                        Copy Prompt
                                    </button>
                                </div>
                            )}

                            {/* ---> ARTIFACTS SECTION HEADER & EXPORT UTILITY <--- */}
                            {(customAnswers.length > 0 || tailoredSuggestions || coverLetter) && (
                                <div className="flex justify-between items-end mb-6 pb-3 border-b border-slate-200 mt-12">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Generated Intelligence</h3>
                                    <button onClick={handleExportPDF} className="text-[10px] font-bold text-slate-600 hover:text-slate-900 uppercase tracking-widest bg-white px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-2 shadow-sm active:scale-95">
                                        <span>📄</span> Export Kit to PDF
                                    </button>
                                </div>
                            )}

                            {/* CUSTOM ANSWERS DISPLAY */}
                            {customAnswers.length > 0 && (
                                <div className="space-y-4 mb-8">
                                    {customAnswers.map((qa, idx) => (
                                        <div key={idx} className="bg-white border border-indigo-100 p-6 rounded-2xl shadow-sm relative group/qa transition-all duration-300">

                                            <div className="flex justify-between items-start mb-3 border-b border-indigo-50 pb-2">
                                                <p className="text-indigo-800 font-bold text-xs uppercase tracking-widest pr-4 leading-relaxed">
                                                    Q: {qa.question}
                                                </p>

                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(qa.answer);
                                                        showToast("Answer Copied");
                                                    }}
                                                    className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border bg-white text-slate-500 border-slate-200 hover:bg-slate-100 opacity-0 group-hover/qa:opacity-100 transition-all duration-200 shrink-0"
                                                    title="Copy Answer"
                                                >
                                                    Copy
                                                </button>
                                            </div>

                                            <p className="text-slate-600 text-sm font-serif leading-relaxed whitespace-pre-wrap">{qa.answer}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* TAILORED SUGGESTIONS */}
                            {tailoredSuggestions && Array.isArray(tailoredSuggestions) && (
                                <div className="space-y-6 mb-8">
                                    {tailoredSuggestions.map((suggestion, index) => (
                                        <div key={index} className="bg-white border border-violet-100 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                                            <div className="mb-4">
                                                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase flex items-center gap-2 mb-2">
                                                    <span className="w-1 h-1 rounded-full bg-rose-400"></span> Original Bullet
                                                </span>
                                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 text-sm line-through decoration-rose-200 font-serif">
                                                    {suggestion.original_bullet}
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <span className="text-[9px] font-black tracking-widest text-violet-500 uppercase flex items-center gap-2">
                                                    <span>🔄</span> Generated Options
                                                </span>
                                                {suggestion.variations && suggestion.variations.map((variation, vIndex) => {
                                                    const isBest = vIndex === suggestion.best_variation_index;
                                                    return (
                                                        <div key={vIndex} className={`p-4 rounded-xl border relative transition-all duration-300 group/copy ${isBest ? 'bg-emerald-50 border-emerald-200 shadow-inner' : 'bg-white border-slate-200'}`}>
                                                            {isBest && (
                                                                <div className="absolute -top-2.5 -right-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">Top Pick</div>
                                                            )}
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className={`text-[9px] font-bold uppercase tracking-wider ${isBest ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                                    Focus: {variation.focus}
                                                                </div>
                                                                <button onClick={() => { navigator.clipboard.writeText(variation.text); showToast("Copied"); }} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border bg-white text-slate-500 border-slate-200 hover:bg-slate-100 opacity-0 group-hover/copy:opacity-100 transition-all">Copy</button>
                                                            </div>
                                                            <div className={`text-sm leading-relaxed font-serif ${isBest ? 'text-emerald-900' : 'text-slate-700'}`}>
                                                                {variation.text}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* COVER LETTER */}
                            {coverLetter && (
                                <div className="bg-white border border-teal-100 p-6 rounded-2xl shadow-sm mb-8 relative group/letter transition-all duration-300">
                                    <div className="flex justify-between items-center mb-4 border-b border-teal-50 pb-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-600 flex items-center gap-2">
                                            <span>📝</span> Tailored Cover Letter
                                        </h4>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(coverLetter); showToast("Copied to Clipboard"); }}
                                            className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border bg-white text-slate-500 border-slate-200 hover:bg-slate-100 opacity-0 group-hover/letter:opacity-100 transition-all duration-200"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <div className="whitespace-pre-wrap text-slate-700 text-sm leading-relaxed font-serif">{coverLetter}</div>
                                </div>
                            )}

                        </div>
                    )}
                </WaterfallScroll>
            </div>

            {/* TOAST HUD */}
            {toastMessage && (
                <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-8 fade-in duration-300">
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl text-emerald-400 px-6 py-4 rounded-2xl font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-4">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
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