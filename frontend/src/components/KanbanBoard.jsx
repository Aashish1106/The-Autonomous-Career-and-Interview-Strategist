import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MatchCard from './MatchCard';
import InterviewSimulator from './InterviewSimulator';
import WaterfallScroll from './WaterfallScroll';

const CORE_STAGES = ["Queued", "Deployed", "Interviewing", "Graveyard"];

export default function KanbanBoard() {
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);

    const [deletingId, setDeletingId] = useState(null);
    const [simulatorJob, setSimulatorJob] = useState(null);

    // ---> SORTING & FILTER STATE <---
    const [sortBy, setSortBy] = useState('newest');
    const [searchTerm, setSearchTerm] = useState('');
    const [toastMessage, setToastMessage] = useState(null);
    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchJobs();

        const handleVaultUpdate = () => {
            console.log("Vault update detected! Refetching jobs...");
            fetchJobs();
        };
        window.addEventListener('vaultUpdated', handleVaultUpdate);
        return () => window.removeEventListener('vaultUpdated', handleVaultUpdate);
    }, []);

    const fetchJobs = async () => {
        try {
            const res = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/evaluations");
            if (res.ok) {
                const data = await res.json();
                setJobs(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Failed to load pipeline:", error);
            setJobs([]);
        } finally {
            setIsLoading(false);
        }
    };

    const onDragEnd = async (result) => {
        setActiveMenuId(null);
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const updatedJobs = Array.from(jobs);
        const draggedJobIndex = updatedJobs.findIndex(j => String(j.id || j.Id) === String(draggableId));

        if (draggedJobIndex > -1) {
            const draggedJob = updatedJobs[draggedJobIndex];
            draggedJob.pipelineStage = destination.droppableId;
            setJobs(updatedJobs);

            try {
                await fetch(`https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/evaluation/${draggableId}/stage`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newStage: destination.droppableId })
                });
            } catch (error) {
                console.error("Failed to sync stage:", error);
            }
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        setActiveMenuId(null);

        if (!window.confirm("Commence memory purge? This snapshot will be permanently deleted.")) return;

        setDeletingId(id);

        try {
            const response = await fetch(`https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/history/${id}`, {
                method: "DELETE"
            });
            if (!response.ok) throw new Error("Failed to delete record");

            setTimeout(() => {
                setJobs(prev => prev.filter(job => job.id !== id && job.Id !== id));
                setDeletingId(null);
                showToast("🗑️ Memory Purged");
            }, 1000);

        } catch (error) {
            console.error(error);
            setDeletingId(null);
            showToast("🚨 Error deleting record");
        }
    };

    const renderShards = (matchScore) => {
        const shards = [];
        const cols = 8;
        const rows = 4;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const dirX = c - (cols / 2);
                const dirY = (r - (rows / 2));
                const force = Math.random() * 60 + 40;
                const tx = dirX * (force * 0.4) + (Math.random() - 0.5) * 50;
                const ty = dirY * (force * 0.8) + (Math.random() - 0.5) * 50;
                const rot = (Math.random() - 0.5) * 720;
                const delay = (Math.random() * 0.1);

                const colorClass = matchScore >= 85 ? 'border-emerald-400 bg-emerald-100' : matchScore >= 70 ? 'border-amber-400 bg-amber-100' : 'border-rose-400 bg-rose-100';

                shards.push(
                    <div
                        key={`${r}-${c}`}
                        className={`absolute box-border border shadow-sm ${colorClass}`}
                        style={{
                            width: `${100 / cols}%`,
                            height: `${100 / rows}%`,
                            left: `${(c / cols) * 100}%`,
                            top: `${(r / rows) * 100}%`,
                            '--tx': `${tx}px`,
                            '--ty': `${ty}px`,
                            '--r': `${rot}deg`,
                            animation: `premiumShatter 0.7s cubic-bezier(0.1, 1, 0.3, 1) both`,
                            animationDelay: `${delay}s`,
                        }}
                    />
                );
            }
        }
        return shards;
    };

    const toggleMenu = (e, id) => {
        e.stopPropagation();
        setActiveMenuId(activeMenuId === id ? null : id);
    };

    const openJobDetails = (e, job) => {
        e.stopPropagation();
        setActiveMenuId(null);
        setSelectedJob(job);
    };

    const launchSimulator = (e, job) => {
        e.stopPropagation();
        setActiveMenuId(null);
        setSimulatorJob(job);
    };

    const getScoreColor = (score) => {
        if (score >= 85) return 'text-emerald-700 bg-emerald-100 border-emerald-300';
        if (score >= 70) return 'text-amber-700 bg-amber-100 border-amber-300';
        return 'text-rose-700 bg-rose-100 border-rose-300';
    };

    // ---> JIRA-STYLE OMNI-SEARCH ENGINE <---
    const applyFiltersAndSort = (jobsList) => {
        let processed = [...jobsList];

        if (searchTerm.trim() !== '') {
            const terms = searchTerm.toLowerCase().split(/\s+/);

            terms.forEach(term => {
                const scoreMatch = term.match(/^(score|match):>(\d+)$/);
                if (scoreMatch) {
                    const threshold = parseInt(scoreMatch[2], 10);
                    processed = processed.filter(j => (j.matchScore || j.MatchScore || 0) >= threshold);
                    return;
                }

                const timeMatch = term.match(/^(days|time):<(\d+)$/);
                if (timeMatch) {
                    const days = parseInt(timeMatch[2], 10);
                    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
                    processed = processed.filter(j => {
                        const timeAdded = new Date(j.createdAt || j.CreatedAt || j.savedAt || j.timestamp || 0).getTime();
                        return timeAdded === 0 ? true : timeAdded >= cutoff;
                    });
                    return;
                }

                processed = processed.filter(j => {
                    const evalData = j.evaluationJson || j.EvaluationJson || "";
                    const evalString = typeof evalData === 'string' ? evalData : JSON.stringify(evalData);

                    const deepText = `
                        ${j.companyName || j.CompanyName || ''} 
                        ${j.roleTitle || j.RoleTitle || ''} 
                        ${j.jobDescription || j.JobDescription || ''} 
                        ${evalString}
                    `.toLowerCase();

                    return deepText.includes(term);
                });
            });
        }
        return getSortedJobs(processed);
    };

    // ---> TEMPORAL DECAY ENGINE (WITH GHOSTING) <---
    // ---> TEMPORAL DECAY ENGINE (WITH GHOSTING) <---
    const getTemporalDecay = (job, stage) => {
        // We don't want decay effects in the Graveyard or Radar
        if (stage === 'Graveyard' || stage === 'Radar') return null;

        // Extract the most recent timestamp available from your Postgres database
        const timeStamp = new Date(job.updatedAt || job.UpdatedAt || job.createdAt || job.CreatedAt || job.savedAt || job.timestamp || 0).getTime();

        // If an old legacy job has no time data, assume it's fresh to prevent math errors
        if (timeStamp === 0) return null;

        // Calculate the exact number of days old
        const daysOld = Math.floor((Date.now() - timeStamp) / (1000 * 60 * 60 * 24));

        // Tier 3: Ghosted (Max Decay - 40% opacity, heavily desaturated, slight blur)
        if (daysOld >= 21) return {
            level: 'stale',
            text: `Ghosted (${daysOld}d)`,
            fadeClass: 'opacity-40 grayscale-[80%] blur-[0.5px]'
        };

        // Tier 2: Stale (Medium Decay - 65% opacity, slightly desaturated)
        if (daysOld >= 14) return {
            level: 'stale',
            text: `Stale (${daysOld}d)`,
            fadeClass: 'opacity-[0.65] grayscale-[40%]'
        };

        // Tier 1: Aging (Beginning to fade - 85% opacity)
        if (daysOld >= 7) return {
            level: 'warning',
            text: `Aging (${daysOld}d)`,
            fadeClass: 'opacity-85'
        };

        return null; // Fresh
    };

    const getSortedJobs = (jobsList) => {
        return [...jobsList].sort((a, b) => {
            const scoreA = a.matchScore || a.MatchScore || 0;
            const scoreB = b.matchScore || b.MatchScore || 0;
            const nameA = (a.companyName || a.CompanyName || "").toLowerCase();
            const nameB = (b.companyName || b.CompanyName || "").toLowerCase();

            const timeA = new Date(a.createdAt || a.CreatedAt || a.savedAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.createdAt || b.CreatedAt || b.savedAt || b.timestamp || 0).getTime();

            const indexA = jobs.indexOf(a);
            const indexB = jobs.indexOf(b);

            switch (sortBy) {
                case 'score-high': return scoreB - scoreA;
                case 'score-low': return scoreA - scoreB;
                case 'company-a-z': return nameA.localeCompare(nameB);
                case 'oldest': return (timeA > 0 && timeB > 0) ? (timeA - timeB) : (indexA - indexB);
                case 'newest':
                default: return (timeA > 0 && timeB > 0) ? (timeB - timeA) : (indexB - indexA);
            }
        });
    };

    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const hasManualJobs = safeJobs.some(j => j.pipelineStage === "Manual");
    const hasRadarJobs = safeJobs.some(j => (j.pipelineStage || "Radar") === "Radar");

    const DISPLAY_STAGES = [
        ...(hasManualJobs ? ["Manual"] : []),
        ...CORE_STAGES,
        ...(hasRadarJobs ? ["Radar"] : [])
    ];

    if (isLoading) return <div className="text-slate-400 animate-pulse text-center mt-20 font-mono">Loading Tactical Pipeline...</div>;

    return (
        <div className="flex flex-col h-full mt-2 relative">
            <style>
                {`
                    @keyframes premiumShatter {
                        0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); filter: brightness(1); }
                        15% { opacity: 1; transform: translate(calc(var(--tx) * 0.1), calc(var(--ty) * 0.1)) scale(1.1); filter: brightness(1.2); }
                        100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--r)) scale(0); filter: brightness(0); }
                    }
                `}
            </style>

            {/* ---> THE DYNAMIC COMMAND DECK <--- */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 px-2 gap-4 relative z-20">
                <div className="w-full lg:flex-1 lg:max-w-3xl">
                    <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl border border-white/80 px-5 py-3.5 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-violet-400 focus-within:border-violet-100 transition-all group">
                        <span className="text-slate-400 group-focus-within:text-violet-500 transition-colors text-lg">⌘</span>
                        <input
                            type="text"
                            placeholder='Type anything... Try: "remote", "typescript", "match:>85", "days:<30"'
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 w-full placeholder-slate-400 font-mono"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-rose-500 transition-colors bg-slate-100 hover:bg-rose-50 rounded-lg p-1.5 px-3 text-[10px] font-black uppercase tracking-widest">
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 px-2 text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                        <span><strong className="text-violet-600">Deep Search:</strong> Tech Stack, Locations, AI Json</span>
                        <span><strong className="text-emerald-600">Operators:</strong> match:&gt;90, days:&lt;7</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white/80 px-5 py-3.5 rounded-2xl shadow-sm shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-500 flex items-center gap-2">
                        <span className="text-sm">📶</span> Sort
                    </span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer hover:text-violet-700 transition-colors"
                    >
                        <option value="newest">📅 Newest Added</option>
                        <option value="oldest">⏳ Oldest Added</option>
                        <option value="score-high">🔥 Highest ACE Score</option>
                        <option value="score-low">🧊 Lowest ACE Score</option>
                        <option value="company-a-z">🏢 Company (A-Z)</option>
                    </select>
                </div>
            </div>

            {/* ---> THE KANBAN COLUMNS <--- */}
            <div className="flex h-full overflow-x-auto pb-8 custom-scrollbar gap-6 items-start">
                <DragDropContext onDragEnd={onDragEnd}>
                    {DISPLAY_STAGES.map((stage) => {
                        const columnJobsRaw = safeJobs.filter(j => (j.pipelineStage || "Radar") === stage);
                        const columnJobs = applyFiltersAndSort(columnJobsRaw);

                        return (
                            <div key={stage} className="min-w-[320px] w-[320px] flex flex-col bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm h-[calc(100vh-18rem)]">
                                <div className="p-4 border-b border-violet-100/50 flex justify-between items-center bg-white/60 rounded-t-2xl shadow-sm shrink-0 relative z-30">
                                    <h3 className="text-violet-900 font-black uppercase text-[10px] tracking-widest">{stage}</h3>
                                    <span className="bg-violet-100 text-violet-700 text-[10px] px-2 py-0.5 rounded-full font-mono">{columnJobs.length}</span>
                                </div>

                                <WaterfallScroll className="flex-1 transition-colors duration-300">
                                    <Droppable droppableId={stage}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={`p-4 min-h-full flex flex-col ${snapshot.isDraggingOver ? 'bg-violet-50/50' : ''}`}
                                            >
                                                {columnJobs.map((job, index) => {
                                                    const safeId = String(job.id || job.Id || `fallback-${index}`);
                                                    const isDeleting = deletingId === safeId;

                                                    return (
                                                        <Draggable key={safeId} draggableId={safeId} index={index}>
                                                            {(provided, snapshot) => {
                                                                const getDraggableStyle = (style, snapshot) => {
                                                                    if (!style) return {};
                                                                    if (snapshot.isDropAnimating) return { ...style, transitionDuration: '0.2s', transitionTimingFunction: 'cubic-bezier(0.2, 1, 0.1, 1)' };
                                                                    if (snapshot.isDragging) return { ...style, transform: style.transform ? `${style.transform} scale(1.03) rotate(1deg)` : style.transform, transition: 'none', zIndex: 9999 };
                                                                    return style;
                                                                };

                                                                // ---> CALCULATE DECAY FOR THIS SPECIFIC CARD <---
                                                                const decay = getTemporalDecay(job, stage);

                                                                // Base styling depending on drag/delete/decay states
                                                                const baseCardStyle = isDeleting ? 'bg-transparent border-transparent shadow-none p-0'
                                                                    : snapshot.isDragging ? 'border-violet-400 bg-white shadow-2xl cursor-grabbing ring-2 ring-violet-500/20 opacity-100 grayscale-0 blur-none'
                                                                        : decay?.level === 'stale' ? 'bg-rose-50/40 backdrop-blur-sm border-rose-300 shadow-[inset_0_0_15px_rgba(244,63,94,0.05)]'
                                                                            : decay?.level === 'warning' ? 'bg-amber-50/40 backdrop-blur-sm border-amber-300 shadow-[inset_0_0_15px_rgba(245,158,11,0.05)]'
                                                                                : 'bg-white/90 backdrop-blur-sm border-violet-100';

                                                                // Extract the visual fade effect for Ghosting
                                                                const visualDecayClass = decay?.fadeClass || 'opacity-100 grayscale-0 blur-none';

                                                                return (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        style={getDraggableStyle(provided.draggableProps.style, snapshot)}
                                                                        className={`relative mb-4 rounded-xl select-none transition-all duration-300 ease-out p-4 ${activeMenuId === safeId ? 'z-50' : 'z-10'} 
                                                                            ${baseCardStyle} 
                                                                            ${visualDecayClass} hover:opacity-100 hover:grayscale-0 hover:blur-none hover:border-violet-400 hover:shadow-md cursor-grab`}
                                                                    >
                                                                        {isDeleting ? (
                                                                            <div className="absolute inset-0 z-50 pointer-events-none w-full h-24">
                                                                                {renderShards(job.matchScore || job.MatchScore)}
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <div className="flex justify-between items-start mb-3">

                                                                                    {/* MATCH SCORE & DECAY BADGE CONTAINER */}
                                                                                    <div className="flex items-center gap-2 flex-wrap mb-1">

                                                                                        <div className={`px-2 py-0.5 rounded-md border shadow-sm text-[10px] font-black font-mono tracking-wide ${getScoreColor(job.matchScore || job.MatchScore)}`}>
                                                                                            {job.matchScore || job.MatchScore}% MATCH
                                                                                        </div>

                                                                                        {/* ---> THE NEW EXPANDING DECAY PILL <--- */}
                                                                                        {decay && (
                                                                                            <div className={`group flex items-center gap-1.5 px-2 py-0.5 rounded-full border shadow-sm text-[10px] font-bold font-mono tracking-wide cursor-help transition-all duration-300 ease-out overflow-hidden ${decay.level === 'stale'
                                                                                                    ? 'bg-white border-rose-200 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                                                                                                    : 'bg-white border-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                                                                                                }`}>
                                                                                                {/* The Status Indicator Dot */}
                                                                                                <span className={`text-[9px] shrink-0 ${decay.level === 'stale' ? 'text-rose-500 animate-pulse' : 'text-amber-400'}`}>
                                                                                                    ●
                                                                                                </span>
                                                                                                {/* The Text (Hidden by default, expands on hover/tap) */}
                                                                                                <span className={`max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 transition-all duration-300 ease-out whitespace-nowrap ${decay.level === 'stale' ? 'text-rose-600' : 'text-amber-600'}`}>
                                                                                                    {decay.text.toUpperCase()}
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="relative">
                                                                                        <button onClick={(e) => toggleMenu(e, safeId)} className="text-slate-400 hover:text-violet-600 transition-colors p-1 relative z-10">•••</button>

                                                                                        {activeMenuId === safeId && (
                                                                                            <div className="absolute top-8 right-0 w-48 bg-white border border-violet-100 rounded-lg shadow-xl py-1 z-[100] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">

                                                                                                {/* MOBILE FALLBACK: Show exact decay here */}
                                                                                                {decay && (
                                                                                                    <div className={`px-4 py-2 border-b border-slate-50 text-[10px] font-black tracking-widest uppercase flex items-center gap-2 ${decay.level === 'stale' ? 'text-rose-600 bg-rose-50/50' : 'text-amber-600 bg-amber-50/50'}`}>
                                                                                                        <span className={decay.level === 'stale' ? 'animate-pulse' : ''}>●</span> {decay.text}
                                                                                                    </div>
                                                                                                )}

                                                                                                <button onClick={(e) => openJobDetails(e, job)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-3 transition-colors">
                                                                                                    <span className="text-violet-500 text-lg">🔍</span> View MatchCard
                                                                                                </button>
                                                                                                <button onClick={(e) => launchSimulator(e, job)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-3 transition-colors border-t border-slate-50">
                                                                                                    <span className="text-emerald-500 text-lg">🎯</span> Mock Interview
                                                                                                </button>
                                                                                                {job.jobUrl && (
                                                                                                    <button onClick={() => window.open(job.jobUrl, '_blank')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors border-t border-slate-50">
                                                                                                        <span className="text-blue-400 text-lg">🔗</span> Original Post
                                                                                                    </button>
                                                                                                )}
                                                                                                <button onClick={(e) => handleDelete(e, safeId)} className="w-full text-left px-4 py-2.5 text-xs font-black tracking-widest uppercase text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors border-t border-slate-100">
                                                                                                    <span className="text-rose-500 text-lg">🗑️</span> Purge Record
                                                                                                </button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <h4 className="text-slate-800 font-bold text-sm leading-tight mb-1 pr-4 truncate">{job.roleTitle || job.RoleTitle}</h4>
                                                                                <p className="text-violet-600 text-xs font-mono truncate">{job.companyName || job.CompanyName}</p>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }}
                                                        </Draggable>
                                                    );
                                                })}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </WaterfallScroll>
                            </div>
                        );
                    })}
                </DragDropContext>
            </div>

            {selectedJob && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-8 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-5xl h-full max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <MatchCard job={selectedJob} onClose={() => setSelectedJob(null)} />
                    </div>
                </div>
            )}

            {simulatorJob && (
                <InterviewSimulator
                    job={simulatorJob}
                    onClose={() => setSimulatorJob(null)}
                />
            )}

            {toastMessage && createPortal(
                <div className="fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-8 fade-in duration-300">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.2)] text-violet-400 px-6 py-4 rounded-xl font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-4">
                        {toastMessage}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}