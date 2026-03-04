import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MatchCard from './MatchCard';
import InterviewSimulator from './InterviewSimulator'; 

const BASE_STAGES = ["Queued", "Manual", "Deployed", "Interviewing", "Graveyard"];

export default function KanbanBoard() {
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);

    // ---> NEW: SHATTER & SIMULATOR STATE <---
    const [deletingId, setDeletingId] = useState(null);
    const [simulatorJob, setSimulatorJob] = useState(null);

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

        // Listen for updates from MatchCard or Simulator
        const handleVaultUpdate = () => fetchJobs();
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

    // ---> NEW: THE PURGE PROTOCOL <---
    const handleDelete = async (e, id) => {
        e.stopPropagation();
        setActiveMenuId(null);

        // Native confirm acts as our safety lock
        if (!window.confirm("Commence memory purge? This snapshot will be permanently deleted.")) return;

        setDeletingId(id); // Trigger shatter animation

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

    // ---> NEW: THE SHATTER PHYSICS ENGINE <---
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

    // ---> NEW: DYNAMIC RADAR VISIBILITY <---
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const hasRadarJobs = safeJobs.some(j => (j.pipelineStage || "Radar") === "Radar");
    const DISPLAY_STAGES = hasRadarJobs ? [...BASE_STAGES, "Radar"] : BASE_STAGES;

    if (isLoading) return <div className="text-slate-400 animate-pulse text-center mt-20 font-mono">Loading Tactical Pipeline...</div>;

    return (
        <div className="flex h-full overflow-x-auto pb-8 custom-scrollbar gap-6 items-start mt-6 relative">
            <style>
                {`
                    @keyframes premiumShatter {
                        0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); filter: brightness(1); }
                        15% { opacity: 1; transform: translate(calc(var(--tx) * 0.1), calc(var(--ty) * 0.1)) scale(1.1); filter: brightness(1.2); }
                        100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--r)) scale(0); filter: brightness(0); }
                    }
                `}
            </style>

            <DragDropContext onDragEnd={onDragEnd}>
                {DISPLAY_STAGES.map((stage) => {
                    
                    const columnJobs = safeJobs.filter(j => (j.pipelineStage || "Radar") === stage);

                    return (
                        <div key={stage} className="min-w-[320px] w-[320px] flex flex-col bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm">
                            <div className="p-4 border-b border-violet-100/50 flex justify-between items-center bg-white/60 rounded-t-2xl shadow-sm">
                                <h3 className="text-violet-900 font-black uppercase text-[10px] tracking-widest">{stage}</h3>
                                <span className="bg-violet-100 text-violet-700 text-[10px] px-2 py-0.5 rounded-full font-mono">{columnJobs.length}</span>
                            </div>

                            <Droppable droppableId={stage}>
                                {(provided, snapshot) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps} className={`p-4 flex-1 min-h-[500px] transition-colors duration-300 ${snapshot.isDraggingOver ? 'bg-violet-50/50 rounded-b-2xl' : ''}`}>
                                        {columnJobs.map((job, index) => {
                                            const safeId = String(job.id || job.Id || `fallback-${index}`);
                                            const isDeleting = deletingId === safeId;

                                            return (
                                                <Draggable key={safeId} draggableId={safeId} index={index}>
                                                    {(provided, snapshot) => {

                                                        const getDraggableStyle = (style, snapshot) => {
                                                            if (!style) return {};
                                                            if (snapshot.isDropAnimating) return { ...style, transitionDuration: '0.2s', transitionTimingFunction: 'cubic-bezier(0.2, 1, 0.1, 1)' };
                                                            if (snapshot.isDragging) return { ...style, transform: style.transform ? `${style.transform} scale(1.04) rotate(2deg)` : style.transform, transition: 'none', zIndex: 9999 };
                                                            return style;
                                                        };

                                                        return (
                                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                                                style={getDraggableStyle(provided.draggableProps.style, snapshot)}
                                                                className={`relative mb-4 rounded-xl select-none transition-[border-color,box-shadow,background-color] duration-200 ease-out ${activeMenuId === safeId ? 'z-50' : 'z-10'}
                                                                    ${isDeleting ? 'bg-transparent border-transparent shadow-none' :
                                                                        snapshot.isDragging ? 'border-violet-400 bg-white shadow-xl cursor-grabbing' : 'bg-white/90 backdrop-blur-sm border border-violet-100 hover:border-violet-300 hover:shadow-md cursor-grab p-4'}`}
                                                            >
                                                                {isDeleting ? (
                                                                    <div className="absolute inset-0 z-50 pointer-events-none w-full h-24">
                                                                        {renderShards(job.matchScore || job.MatchScore)}
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <div className={`px-2 py-1 rounded border text-[10px] font-black font-mono ${getScoreColor(job.matchScore || job.MatchScore)}`}>{job.matchScore || job.MatchScore}% MATCH</div>
                                                                            <div className="relative">
                                                                                <button onClick={(e) => toggleMenu(e, safeId)} className="text-slate-400 hover:text-violet-600 transition-colors p-1 relative z-10">•••</button>

                                                                                {/* ---> UPGRADED DROPDOWN MENU <--- */}
                                                                                {activeMenuId === safeId && (
                                                                                    <div className="absolute top-8 right-0 w-48 bg-white border border-violet-100 rounded-lg shadow-xl py-1 z-[100] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
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
                        </div>
                    );
                })}
            </DragDropContext>

            {/* ---> MATCHCARD MODAL <--- */}
            {selectedJob && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-8 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-5xl h-full max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute -top-4 -right-4 md:-right-12 z-[250]">
                            <button onClick={() => setSelectedJob(null)} className="bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-violet-100 hover:border-rose-200 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all">✕</button>
                        </div>
                        <MatchCard job={selectedJob} />
                    </div>
                </div>
            )}

            {/* ---> INTERVIEW SIMULATOR MODAL <--- */}
            {simulatorJob && (
                <InterviewSimulator
                    job={simulatorJob}
                    onClose={() => setSimulatorJob(null)}
                />
            )}

            {/* ---> KANBAN TOAST NOTIFICATION HUD <--- */}
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