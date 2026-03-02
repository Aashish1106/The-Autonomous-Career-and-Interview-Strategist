import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MatchCard from './MatchCard'; // ---> IMPORT YOUR MASTERPIECE <---

const STAGES = ["Radar", "Queued", "Manual", "Deployed", "Interviewing", "Graveyard"];

export default function KanbanBoard() {
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);

    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchJobs();
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

    const toggleMenu = (e, id) => {
        e.stopPropagation();
        setActiveMenuId(activeMenuId === id ? null : id);
    };

    const openJobDetails = (e, job) => {
        e.stopPropagation();
        setActiveMenuId(null);
        setSelectedJob(job);
    };

    const getScoreColor = (score) => {
        if (score >= 85) return 'text-emerald-700 bg-emerald-100 border-emerald-300';
        if (score >= 70) return 'text-amber-700 bg-amber-100 border-amber-300';
        return 'text-rose-700 bg-rose-100 border-rose-300';
    };

    if (isLoading) return <div className="text-slate-400 animate-pulse text-center mt-20 font-mono">Loading Tactical Pipeline...</div>;

    return (
        <div className="flex h-full overflow-x-auto pb-8 custom-scrollbar gap-6 items-start mt-6 relative">
            <DragDropContext onDragEnd={onDragEnd}>
                {STAGES.map((stage) => {
                    const safeJobs = Array.isArray(jobs) ? jobs : [];
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
                                            return (
                                                <Draggable key={safeId} draggableId={safeId} index={index}>
                                                    {(provided, snapshot) => {

                                                        // ---> THE BUTTER-SMOOTH PHYSICS ENGINE <---
                                                        const getDraggableStyle = (style, snapshot) => {
                                                            if (!style) return {};

                                                            // 1. The Drop Phase: Snappy and satisfying
                                                            if (snapshot.isDropAnimating) {
                                                                return {
                                                                    ...style,
                                                                    transitionDuration: '0.2s',
                                                                    transitionTimingFunction: 'cubic-bezier(0.2, 1, 0.1, 1)'
                                                                };
                                                            }

                                                            // 2. The Drag Phase: 1:1 mouse tracking with scale/tilt
                                                            if (snapshot.isDragging) {
                                                                return {
                                                                    ...style,
                                                                    // Append tilt/scale safely to the library's translate coordinates
                                                                    transform: style.transform ? `${style.transform} scale(1.04) rotate(2deg)` : style.transform,
                                                                    // FORCE zero transition so it doesn't lag behind the mouse
                                                                    transition: 'none',
                                                                    boxShadow: '0 20px 25px -5px rgba(139, 92, 246, 0.25), 0 10px 10px -5px rgba(139, 92, 246, 0.1)',
                                                                    zIndex: 9999
                                                                };
                                                            }

                                                            // 3. Resting Phase
                                                            return style;
                                                        };

                                                        return (
                                                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                                                style={getDraggableStyle(provided.draggableProps.style, snapshot)}
                                                                // Removed `transition-all` and Tailwind scale/rotate. 
                                                                // Only animating colors/shadows now to prevent stutter.
                                                                className={`relative mb-4 bg-white/90 backdrop-blur-sm border rounded-xl p-4 select-none
                                                                    transition-[border-color,box-shadow,background-color] duration-200 ease-out
                                                                    ${snapshot.isDragging
                                                                        ? 'border-violet-400 bg-white cursor-grabbing'
                                                                        : 'border-violet-100 hover:border-violet-300 hover:shadow-md cursor-grab'
                                                                    }`}>
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className={`px-2 py-1 rounded border text-[10px] font-black font-mono ${getScoreColor(job.matchScore || job.MatchScore)}`}>{job.matchScore || job.MatchScore}% MATCH</div>
                                                                    <button onClick={(e) => toggleMenu(e, safeId)} className="text-slate-400 hover:text-violet-600 transition-colors p-1 relative z-10">•••</button>
                                                                </div>
                                                                <h4 className="text-slate-800 font-bold text-sm leading-tight mb-1 pr-4">{job.roleTitle || job.RoleTitle}</h4>
                                                                <p className="text-violet-600 text-xs font-mono">{job.companyName || job.CompanyName}</p>

                                                                {activeMenuId === safeId && (
                                                                    <div className="absolute top-10 right-2 w-48 bg-white border border-violet-100 rounded-lg shadow-xl py-1 z-[100] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                                                                        <button onClick={(e) => openJobDetails(e, job)} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-3 transition-colors">
                                                                            <span className="text-violet-500">🔍</span> Open MatchCard
                                                                        </button>
                                                                        {job.jobUrl && (
                                                                            <button onClick={() => window.open(job.jobUrl, '_blank')} className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-3 transition-colors">
                                                                                <span className="text-slate-400">🔗</span> View Original Post
                                                                            </button>
                                                                        )}
                                                                    </div>
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

            {/* ----------------------------------------------------------------- */}
            {/* ---> THE MODAL WRAPPER FOR MATCHCARD <--- */}
            {/* ----------------------------------------------------------------- */}
            {selectedJob && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-8 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
                    <div
                        className="w-full max-w-5xl h-full max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* A sleek close button floating outside the card */}
                        <div className="absolute -top-4 -right-4 md:-right-12 z-[250]">
                            <button
                                onClick={() => setSelectedJob(null)}
                                className="bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-violet-100 hover:border-rose-200 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all"
                                title="Close MatchCard"
                            >
                                ✕
                            </button>
                        </div>

                        {/* ---> INJECT MATCHCARD HERE <--- */}
                        <MatchCard job={selectedJob} />

                    </div>
                </div>
            )}
        </div>
    );
}