import React, { useState, useEffect } from 'react';
import { jsPDF } from "jspdf";
import InterviewSimulator from './InterviewSimulator';

const EvaluationHistory = () => {
    const [historyList, setHistoryList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
    const [upgradeData, setUpgradeData] = useState({});
    const [isUpgrading, setIsUpgrading] = useState(false);

    // State for the advanced shatter animation
    const [deletingId, setDeletingId] = useState(null);

    // --- HELPER FUNCTIONS ---

    // This is our single source of truth for what a "Modern" record looks like.
    // If we add new features later (e.g., 'salaryRange'), just add it to this array.
    const EXPECTED_SCHEMA = [
        { key: 'jobDescription', label: 'Job Description', type: 'textarea', description: 'Required for technical interviews.' },
        { key: 'jobUrl', label: 'Original Job URL', type: 'text', description: 'Link to the original posting.' },
        { key: 'companyName', label: 'Company Name', type: 'text', description: 'The hiring company.' },
        { key: 'roleTitle', label: 'Role Title', type: 'text', description: 'The official job title.' }
    ];

    // Calculate which fields are missing from the currently selected job
    const missingFields = selectedJob ? EXPECTED_SCHEMA.filter(field => !selectedJob[field.key] || selectedJob[field.key].trim() === '') : [];

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

        // Background sync listener from MatchCard
        const handleVaultUpdate = () => fetchHistory();
        window.addEventListener('vaultUpdated', handleVaultUpdate);
        return () => window.removeEventListener('vaultUpdated', handleVaultUpdate);
    }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Commence memory purge? This snapshot will be permanently deleted.")) return;

        // Trigger the high-end matrix shatter animation immediately
        setDeletingId(id);

        try {
            const response = await fetch(`https://localhost:7155/api/JobStrategist/history/${id}`, {
                method: "DELETE"
            });
            if (!response.ok) throw new Error("Failed to delete record");

            // Wait 1 full second for the 3D shards to explode and vaporize
            setTimeout(() => {
                setHistoryList(prev => prev.filter(job => job.id !== id));
                setDeletingId(null);
                showToast("🗑️ Memory Purged");
                if (selectedJob?.id === id) setSelectedJob(null);
            }, 1000);

        } catch (error) {
            console.error(error);
            setDeletingId(null); // Revert animation if API fails
            showToast("🚨 Error deleting record");
        }
    };

    const handleUpgradeRecord = async () => {
        // Ensure all dynamically requested fields have been filled out
        const hasEmptyFields = missingFields.some(field => !upgradeData[field.key] || upgradeData[field.key].trim() === '');
        if (hasEmptyFields) {
            showToast("🚨 Please fill out all required missing fields.");
            return;
        }

        setIsUpgrading(true);
        try {
            // Capitalize the first letter of keys to match C# properties (e.g., jobDescription -> JobDescription)
            const payload = {};
            for (const [key, value] of Object.entries(upgradeData)) {
                const csharpKey = key.charAt(0).toUpperCase() + key.slice(1);
                payload[csharpKey] = value;
            }

            const response = await fetch(`https://localhost:7155/api/JobStrategist/history/${selectedJob.id}/upgrade`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to upgrade record");

            // Instantly patch the local state so the UI updates
            setSelectedJob(prev => ({ ...prev, ...upgradeData }));
            setUpgradeData({});
            showToast("✅ Vault Record Synchronized to Modern Schema");

            window.dispatchEvent(new Event('vaultUpdated'));
        } catch (error) {
            console.error(error);
            showToast("🚨 Error upgrading record");
        } finally {
            setIsUpgrading(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!selectedJob || !selectedJob.coverLetterText) return;
        const doc = new jsPDF();
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        const savedDate = new Date(selectedJob.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(savedDate, 20, 20);
        const splitText = doc.splitTextToSize(selectedJob.coverLetterText, 170);
        doc.text(splitText, 20, 40);
        const companyClean = selectedJob.companyName ? selectedJob.companyName.replace(/[^a-zA-Z0-9]/g, '_') : 'Company';
        doc.save(`Aashish_CoverLetter_${companyClean}.pdf`);
        showToast("PDF Exported Successfully");
    };

    // ---> THE PHYSICS ENGINE: CASCADING SHATTER GENERATOR <---
    const renderShards = (matchScore) => {
        const shards = [];
        const cols = 12; // 12 columns across the card
        const rows = 4;  // 4 rows down the card

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Calculate trajectory (explode outwards and slightly upwards, originating near the purge button on the right)
                const dirX = c - cols;
                const dirY = (r - (rows / 2));

                const force = Math.random() * 60 + 40;
                const tx = dirX * (force * 0.3) + (Math.random() - 0.5) * 100;
                const ty = dirY * (force * 0.8) + (Math.random() - 0.5) * 100 - 50; // Bias upwards
                const rot = (Math.random() - 0.5) * 720; // Massive spinning

                // Cascade delay: Shatter wave travels from right (button) to left (neon border)
                const delay = ((cols - c) * 0.025) + (Math.random() * 0.02);

                // Recreate the card's visual identity on the shards
                const isLeftEdge = c === 0;
                let edgeClass = 'bg-[#0f172a] border border-slate-700/50'; // Standard card fragment

                if (isLeftEdge) {
                    // Recreate the exact glowing neon border on the leftmost shards
                    const colorClass = matchScore >= 80 ? 'border-l-emerald-500 shadow-[-5px_0_15px_rgba(16,185,129,0.8)]' : matchScore >= 60 ? 'border-l-yellow-500 shadow-[-5px_0_15px_rgba(234,179,8,0.8)]' : 'border-l-pink-500 shadow-[-5px_0_15px_rgba(236,72,153,0.8)]';
                    edgeClass = `bg-[#0f172a] border-y border-r border-slate-700/50 border-l-[6px] ${colorClass}`;
                }

                shards.push(
                    <div
                        key={`${r}-${c}`}
                        className={`absolute box-border ${edgeClass}`}
                        style={{
                            width: `${100 / cols}%`,
                            height: `${100 / rows}%`,
                            left: `${(c / cols) * 100}%`,
                            top: `${(r / rows) * 100}%`,
                            '--tx': `${tx}px`,
                            '--ty': `${ty}px`,
                            '--r': `${rot}deg`,
                            // Fill-mode 'both' ensures it perfectly covers the card before exploding
                            animation: `premiumShatter 0.7s cubic-bezier(0.1, 1, 0.3, 1) both`,
                            animationDelay: `${delay}s`,
                        }}
                    />
                );
            }
        }
        return shards;
    };

    // --- RENDER HELPERS ---
    const renderList = () => {
        if (isLoading) return <div className="text-slate-400 font-mono text-center py-20 animate-pulse">Decrypting Vault Records...</div>;
        if (historyList.length === 0) return <div className="text-slate-500 font-mono text-center py-20">The Vault is empty. Go evaluate some jobs!</div>;

        return (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {historyList.map(job => {
                    const isDeleting = deletingId === job.id;

                    return (
                        <div
                            key={job.id}
                            onClick={() => !isDeleting && setSelectedJob(job)}
                            className={`group relative rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center ${isDeleting
                                    // Strip the background so ONLY the physics shards are visible during explosion
                                    ? 'bg-transparent border-transparent shadow-none scale-[1.02]'
                                    : 'bg-[#0f172a] border border-slate-800 hover:border-slate-600 p-5 shadow-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:-translate-x-1'
                                }`}
                        >
                            {/* If exploding, render the 48 physics shards. Otherwise, render the standard neon line */}
                            {isDeleting ? (
                                <div className="absolute inset-0 z-50 pointer-events-none">
                                    {renderShards(job.matchScore)}
                                </div>
                            ) : (
                                <div className={`absolute top-0 left-0 w-1.5 h-full transition-opacity duration-300 ${job.matchScore >= 80 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : job.matchScore >= 60 ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]' : 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]'}`}></div>
                            )}

                            {/* The Inner Content - Instantly vanishes when exploding so the shards take over */}
                            <div className={`flex flex-col sm:flex-row w-full transition-opacity duration-75 ${isDeleting ? 'opacity-0' : 'opacity-100'}`}>
                                <div className="flex-1 pl-3 mb-4 sm:mb-0">
                                    <div className="flex flex-wrap items-center gap-3 mb-1">
                                        <h3 className="text-xl font-black text-white uppercase tracking-wider truncate max-w-[250px] md:max-w-[350px]" title={job.companyName}>
                                            {job.companyName || "Unknown"}
                                        </h3>
                                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800">
                                            {new Date(job.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-400 truncate max-w-[250px] md:max-w-[400px]" title={job.roleTitle}>
                                        {job.roleTitle || "Role not specified"}
                                    </p>
                                </div>

                                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end pl-3 sm:pl-0">
                                    <button
                                        onClick={(e) => handleDelete(e, job.id)}
                                        disabled={isDeleting}
                                        className="sm:opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded border border-transparent hover:border-red-500/30 hover:bg-red-500/10 z-10 relative"
                                    >
                                        Purge
                                    </button>
                                    <div className={`text-4xl font-black tracking-tighter w-24 text-right ${job.matchScore >= 80 ? 'text-emerald-500' : job.matchScore >= 60 ? 'text-yellow-500' : 'text-pink-500'}`}>
                                        {job.matchScore}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderDetails = () => {
        if (!selectedJob) return null;

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
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12 border-b border-slate-800 pb-10">
                        <div className="text-center md:text-left">
                            <h2 className="text-4xl font-black text-white tracking-tight mb-2 uppercase drop-shadow-md">{selectedJob.companyName}</h2>
                            <h3 className="text-xl font-medium text-slate-400">{selectedJob.roleTitle}</h3>

                            <div className="flex flex-wrap items-center gap-4 mt-6">
                                {(selectedJob.jobUrl || selectedJob.JobUrl) && (
                                    <a
                                        href={(selectedJob.jobUrl || selectedJob.JobUrl).startsWith('http') ? (selectedJob.jobUrl || selectedJob.JobUrl) : `https://${(selectedJob.jobUrl || selectedJob.JobUrl)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-xs font-mono text-blue-400 hover:text-blue-300 bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20 transition-colors"
                                    >
                                        🔗 View Original Listing
                                    </a>
                                )}

                                {/* Disable the button if it's a legacy record missing the description */}
                                <button
                                    onClick={() => setIsSimulatorOpen(true)}
                                    // ---> FIX: Lock the button if ANY schema fields are missing <---
                                    disabled={missingFields.length > 0}
                                    className="inline-flex items-center gap-2 bg-purple-600/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/40 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                    title={missingFields.length > 0 ? "Synchronize legacy record to unlock" : "Start Mock Interview"}
                                >
                                    <span>🎯</span> Commence Mock Interview
                                </button>
                            </div>
                        </div>

                        {/* ---> NEW: DYNAMIC SCHEMA UPGRADE PANEL <--- */}
                        {missingFields.length > 0 && (
                            <div className="mt-8 mb-12 bg-amber-950/20 border border-amber-500/50 rounded-2xl p-6 shadow-inner relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                                <h4 className="text-amber-400 font-black uppercase tracking-widest text-sm mb-2 flex items-center gap-2">
                                    <span>⚠️</span> Legacy Schema Detected
                                </h4>
                                <p className="text-slate-300 text-sm font-serif mb-6">
                                    This archive is missing {missingFields.length} data point{missingFields.length > 1 ? 's' : ''} required by the modern ACE architecture. Please backfill the missing information below to unlock all features.
                                </p>

                                <div className="space-y-4 mb-6">
                                    {missingFields.map(field => (
                                        <div key={field.key} className="flex flex-col gap-1">
                                            <label className="text-xs font-black text-amber-500/80 uppercase tracking-widest flex justify-between">
                                                {field.label}
                                                <span className="text-slate-500 text-[9px]">{field.description}</span>
                                            </label>
                                            {field.type === 'textarea' ? (
                                                <textarea
                                                    value={upgradeData[field.key] || ''}
                                                    onChange={(e) => setUpgradeData(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                    placeholder={`Enter ${field.label}...`}
                                                    className="w-full h-32 bg-slate-950/50 border border-slate-700 focus:border-amber-500/50 rounded-xl p-4 text-slate-300 text-sm font-serif outline-none resize-none custom-scrollbar"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={upgradeData[field.key] || ''}
                                                    onChange={(e) => setUpgradeData(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                    placeholder={`Enter ${field.label}...`}
                                                    className="w-full bg-slate-950/50 border border-slate-700 focus:border-amber-500/50 rounded-xl px-4 py-3 text-slate-300 text-sm font-serif outline-none"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={handleUpgradeRecord}
                                        disabled={isUpgrading}
                                        className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isUpgrading ? "Synchronizing Data..." : "💾 Synchronize Record"}
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* ----------------------------------------------- */}

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

                    {evalData.action && (
                        <div className={`mb-12 w-full py-5 rounded-xl flex flex-col items-center justify-center gap-2 border border-dashed ${selectedJob.matchScore >= 80 ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/50' :
                            selectedJob.matchScore >= 60 ? 'bg-yellow-950/20 text-yellow-400 border-yellow-500/50' :
                                'bg-pink-950/20 text-pink-500 border-pink-500/50'
                            }`}>
                            <span className="text-[10px] font-black opacity-70 tracking-[0.3em] uppercase">ACE Historical Verdict</span>
                            <span className="text-sm font-serif text-slate-300 mt-1 max-w-2xl text-center">"{evalData.action}"</span>
                        </div>
                    )}

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
                                                <span>🧠</span> Why ACE chose Option {suggestion.best_variation_index + 1}
                                            </span>
                                            <p className="text-slate-300 text-sm leading-relaxed italic border-l-2 border-purple-500/50 pl-4">{suggestion.ACE_reasoning}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedJob.coverLetterText && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-lg font-black text-white flex items-center gap-3 tracking-wide uppercase drop-shadow-md">
                                    <span className="bg-blue-500/20 p-2 rounded-xl text-blue-400 border border-blue-500/30">📝</span> Saved Cover Letter
                                </h4>
                                <div className="flex gap-3">
                                    <button onClick={handleDownloadPDF} className="text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors">📄 Export PDF</button>
                                    <button onClick={() => { navigator.clipboard.writeText(selectedJob.coverLetterText); showToast("Cover Letter Copied"); }} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">COPY TEXT</button>
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
            {/* The CSS required to run the premium shatter engine */}
            <style>
                {`
                    @keyframes premiumShatter {
                        0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); filter: brightness(1); }
                        15% { opacity: 1; transform: translate(calc(var(--tx) * 0.1), calc(var(--ty) * 0.1)) scale(1.1); filter: brightness(1.5) drop-shadow(0 0 10px rgba(255,255,255,0.3)); }
                        100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--r)) scale(0); filter: brightness(0); }
                    }
                `}
            </style>

            <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                <span className="text-blue-500">🗄️</span> Strategic Vault
            </h1>

            {selectedJob ? renderDetails() : renderList()}

            {isSimulatorOpen && selectedJob && (
                <InterviewSimulator
                    job={selectedJob} // <--- Pass the whole job object, not just the description
                    onClose={() => setIsSimulatorOpen(false)}
                />
            )}

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