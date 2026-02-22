import React, { useState } from 'react';

const HistoryGrid = ({ history, onDelete }) => {
    const [shatteringId, setShatteringId] = useState(null);

    const handleShatterDelete = (id) => {
        setShatteringId(id);
        setTimeout(() => {
            onDelete(id);
            setShatteringId(null);
        }, 600);
    };

    if (!history || history.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-1000">
                <div className="text-4xl mb-3 opacity-50">🗄️</div>
                No evaluation history found. Awaiting first input sequence...
            </div>
        );
    }

    return (
        <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {history.map((job) => (
                <div
                    key={job.id}
                    className={`group relative overflow-hidden bg-slate-950/40 backdrop-blur-xl border border-slate-800/80 p-5 rounded-2xl shadow-xl hover:border-purple-500/40 hover:bg-slate-900/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all duration-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${shatteringId === job.id ? 'animate-cyber-shatter pointer-events-none' : ''
                        }`}
                >
                    {/* The beautiful sliding shimmer effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none"></div>

                    {/* Left Side: Job Details */}
                    <div className="flex flex-col gap-1 relative z-10 transition-transform duration-300 group-hover:translate-x-1">
                        <div className="flex items-center gap-3">
                            <h5 className="text-slate-100 font-bold text-base tracking-wide uppercase drop-shadow-sm">{job.companyName}</h5>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase border shadow-[inset_0_0_10px_rgba(0,0,0,0.2)] ${job.matchScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                                    job.matchScore >= 60 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                                        'bg-pink-500/10 text-pink-400 border-pink-500/30'
                                }`}>
                                {job.matchScore}% Match
                            </span>
                        </div>
                        <p className="text-slate-400 text-xs font-mono">{job.roleTitle}</p>
                        <p className="text-slate-600 text-[10px] font-mono mt-1">
                            EVALUATED: {new Date(job.createdAt).toLocaleDateString()}
                        </p>
                    </div>

                    {/* Right Side: Actions */}
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="text-right mr-2 hidden md:block">
                            <div className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Status</div>
                            <div className="text-xs text-purple-400 font-mono drop-shadow-md">{job.status}</div>
                        </div>

                        {/* High-tech delete button */}
                        <button
                            onClick={() => handleShatterDelete(job.id)}
                            className="p-2.5 rounded-xl bg-slate-900/80 text-slate-500 hover:text-pink-400 hover:bg-pink-950/50 border border-slate-700/50 hover:border-pink-500/40 hover:shadow-[0_0_15px_rgba(236,72,153,0.2)] transition-all duration-300 group/btn"
                            title="Purge Record"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover/btn:scale-110 transition-transform duration-300">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default HistoryGrid;