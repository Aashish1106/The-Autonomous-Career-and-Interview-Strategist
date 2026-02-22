import React, { useState, useEffect } from 'react';
import { jsPDF } from "jspdf";

const EvaluationHistory = () => {
    const [historyList, setHistoryList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);

    // --- HELPER FUNCTIONS ---
    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const getStrokeColor = (score) => {
        if (score >= 80) return 'stroke-emerald-400';
        if (score >= 60) return 'stroke-yellow-400';
        return 'stroke-pink-500';
    };

    // --- API CALLS ---
    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("https://localhost:7155/api/JobStrategist/history");
            if (!response.ok) throw new Error("Failed to fetch history");
            const data = await response.json();
            setHistoryList(data);
        } catch (error) {
            console.error(error);
            showToast("🚨 Error loading Vault data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation(); // Prevent opening the details view
        if (!window.confirm("Are you sure you want to purge this snapshot from the Vault?")) return;

        try {
            const response = await fetch(`https://localhost:7155/api/JobStrategist/history/${id}`, {
                method: "DELETE"
            });
            if (!response.ok) throw new Error("Failed to delete record");

            setHistoryList(prev => prev.filter(job => job.id !== id));
            showToast("🗑️ Snapshot Purged");
            if (selectedJob?.id === id) setSelectedJob(null);
        } catch (error) {
            console.error(error);
            showToast("🚨 Error deleting record");
        }
    };

    const handleDownloadPDF = () => {
        if (!selectedJob || !selectedJob.coverLetterText) return;
        const doc = new jsPDF();
        doc.setFont("times", "normal");
        doc.setFontSize(11);

        // Use the saved date instead of today's date
        const savedDate = new Date(selectedJob.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(savedDate, 20, 20);

        const splitText = doc.splitTextToSize(selectedJob.coverLetterText, 170);
        doc.text(splitText, 20, 40);

        const companyClean = selectedJob.companyName ? selectedJob.companyName.replace(/[^a-zA-Z0-9]/g, '_') : 'Company';
        doc.save(`Aashish_CoverLetter_${companyClean}.pdf`);
        showToast("PDF Exported Successfully");
    };

    // --- RENDER HELPERS ---
    const renderGrid = () => {
        if (isLoading) return <div className="text-slate-400 font-mono text-center py-20 animate-pulse">Decrypting Vault Records...</div>;
        if (historyList.length === 0) return <div className="text-slate-500 font-mono text-center py-20">The Vault is empty. Go evaluate some jobs!</div>;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {historyList.map(job => (
                    <div
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className="group relative bg-slate-900/50 backdrop-blur-xl border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] overflow-hidden"
                    >
                        <div className={`absolute top-0 left-0 w-full h-1 ${job.matchScore >= 80 ? 'bg-emerald-500' : job.matchScore >= 60 ? 'bg-yellow-500' : 'bg-pink-500'}`}></div>

                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-wider truncate max-w-[200px]" title={job.companyName}>{job.companyName || "Unknown"}</h3>
                                <p className="text-sm font-medium text-slate-400 truncate max-w-[200px]" title={job.roleTitle}>{job.roleTitle || "Role not specified"}</p>
                            </div>
                            <div className={`text-2xl font-black ${job.matchScore >= 80 ? 'text-emerald-400' : job.matchScore >= 60 ? 'text-yellow-400' : 'text-pink-500'}`}>
                                {job.matchScore}%
                            </div>
                        </div>

                        <div className="flex justify-between items-end mt-6">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                                {new Date(job.updatedAt).toLocaleDateString()}
                            </span>
                            <button
                                onClick={(e) => handleDelete(e, job.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all text-xs uppercase tracking-widest font-bold px-2 py-1 rounded hover:bg-red-500/10"
                            >
                                Purge
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderDetails = () => {
        if (!selectedJob) return null;

        // Parse the stored JSON strings safely
        const evalData = selectedJob.evaluationJson ? JSON.parse(selectedJob.evaluationJson) : {};
        const tailoredData = selectedJob.tailoredResumeJson ? JSON.parse(selectedJob.tailoredResumeJson) : null;

        return (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <button
                    onClick={() => setSelectedJob(null)}
                    className="mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
                >
                    <span>←</span> Back to Vault
                </button>

                <div className="bg-slate-900/90 backdrop-blur-2xl rounded-[22px] p-8 border border-white/10 shadow-2xl relative overflow-hidden">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12 border-b border-slate-800 pb-10">
                        <div className="text-center md:text-left">
                            <h2 className="text-4xl font-black text-white tracking-tight mb-2 uppercase drop-shadow-md">{selectedJob.companyName}</h2>
                            <h3 className="text-xl font-medium text-slate-400">{selectedJob.roleTitle}</h3>
                            {selectedJob.jobUrl && selectedJob.jobUrl.trim() !== '' && (
                                <a
                                    href={selectedJob.jobUrl.startsWith('http') ? selectedJob.jobUrl : `https://${selectedJob.jobUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block mt-4 text-xs font-mono text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-colors"
                                >
                                    🔗 View Original Listing
                                </a>
                            )}
                        </div>

                        <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                            <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${selectedJob.matchScore >= 80 ? 'bg-emerald-500' : selectedJob.matchScore >= 60 ? 'bg-yellow-500' : 'bg-pink-500'}`}></div>
                            <svg className="w-full h-full transform -rotate-90 relative z-10">
                                <circle cx="80" cy="80" r="70" className="stroke-slate-800/80 fill-none" strokeWidth="10" />
                                <circle
                                    cx="80" cy="80" r="70"
                                    className={`${getStrokeColor(selectedJob.matchScore)} fill-none transition-all duration-1000 ease-out`}
                                    strokeWidth="10" strokeDasharray="440" strokeDashoffset={440 - (440 * selectedJob.matchScore) / 100} strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center text-center z-20">
                                <span className={`text-4xl font-black tracking-tighter ${selectedJob.matchScore >= 80 ? 'text-emerald-400' : selectedJob.matchScore >= 60 ? 'text-yellow-400' : 'text-pink-500'}`}>
                                    {selectedJob.matchScore}<span className="text-xl">%</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Verdict Banner */}
                    {evalData.action && (
                        <div className={`mb-12 w-full py-5 rounded-xl flex flex-col items-center justify-center gap-2 border border-dashed ${selectedJob.matchScore >= 80 ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/50' :
                            selectedJob.matchScore >= 60 ? 'bg-yellow-950/20 text-yellow-400 border-yellow-500/50' :
                                'bg-pink-950/20 text-pink-500 border-pink-500/50'
                            }`}>
                            <span className="text-[10px] font-black opacity-70 tracking-[0.3em] uppercase">Jarvis Historical Verdict</span>
                            <span className="text-sm font-serif text-slate-300 mt-1 max-w-2xl text-center">"{evalData.action}"</span>
                        </div>
                    )}

                    {/* ---> UPDATED: Tailored Arsenal (Matches MatchCard UI) <--- */}
                    {tailoredData && Array.isArray(tailoredData) && (
                        <div className="mb-12">
                            <h4 className="text-lg font-black text-white flex items-center gap-3 tracking-wide uppercase drop-shadow-md mb-6">
                                <span className="bg-purple-500/20 p-2 rounded-xl text-purple-400 border border-purple-500/30">✨</span> Tailored Arsenal
                            </h4>
                            <div className="space-y-8">
                                {tailoredData.map((suggestion, index) => (
                                    <div key={index} className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                                        <div className="mb-6">
                                            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase flex items-center gap-2 mb-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-pink-500/70"></span> Original Profile
                                            </span>
                                            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/50 text-slate-400 text-sm leading-relaxed line-through decoration-pink-500/30 font-serif">
                                                {suggestion.original_bullet}
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <span className="text-[10px] font-black tracking-widest text-blue-400 uppercase flex items-center gap-2">
                                                <span>🔄</span> Generated Options
                                            </span>
                                            {suggestion.variations && suggestion.variations.map((variation, vIndex) => {
                                                const isBest = vIndex === suggestion.best_variation_index;
                                                return (
                                                    <div key={vIndex} className={`p-4 rounded-xl border relative transition-all duration-300 group/copy ${isBest ? 'bg-emerald-950/20 border-emerald-500/50 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'}`}>

                                                        {isBest && (
                                                            <div className="absolute -top-3 -right-2 bg-emerald-500 text-slate-950 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.5)] z-10">Jarvis Top Pick ⭐</div>
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
                                                                className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all duration-200 opacity-0 group-hover/copy:opacity-100 ${isBest
                                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                                                    : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-200'
                                                                    }`}
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
                                                <span>🧠</span> Why Jarvis chose Option {suggestion.best_variation_index + 1}
                                            </span>
                                            <p className="text-slate-300 text-sm leading-relaxed italic border-l-2 border-purple-500/50 pl-4">{suggestion.jarvis_reasoning}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Cover Letter (Read-Only + Export) */}
                    {selectedJob.coverLetterText && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-lg font-black text-white flex items-center gap-3 tracking-wide uppercase drop-shadow-md">
                                    <span className="bg-blue-500/20 p-2 rounded-xl text-blue-400 border border-blue-500/30">📝</span> Saved Cover Letter
                                </h4>
                                <div className="flex gap-3">
                                    <button onClick={handleDownloadPDF} className="text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors">📄 Export PDF</button>
                                    <button onClick={() => {
                                        navigator.clipboard.writeText(selectedJob.coverLetterText);
                                        showToast("Cover Letter Copied");
                                    }} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">COPY TEXT</button>
                                </div>
                            </div>
                            <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl whitespace-pre-wrap text-slate-300 text-sm leading-relaxed font-serif shadow-inner">
                                {selectedJob.coverLetterText}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="relative w-full max-w-5xl mx-auto mt-8 mb-16 px-4">
            <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                <span className="text-blue-500">🗄️</span> Strategic Vault
            </h1>

            {selectedJob ? renderDetails() : renderGrid()}

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-8 fade-in duration-300">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] text-blue-400 px-6 py-4 rounded-xl font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-4">
                        {toastMessage}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EvaluationHistory;