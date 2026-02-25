import React, { useEffect, useRef } from 'react';

const AgentConsole = ({ logs, mode, status }) => {
    const bottomRef = useRef(null);

    // Auto-scroll to the bottom of the terminal
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    return (
        <div className="w-full h-48 bg-black/80 backdrop-blur-md border border-slate-800 rounded-xl p-4 font-mono text-xs md:text-sm overflow-hidden flex flex-col shadow-[inset_0_0_20px_rgba(0,0,0,1)] relative">
            {/* Fake Terminal Header */}
            <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2 opacity-50">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <span className="ml-2 text-[10px] text-slate-500 tracking-widest uppercase">ACE.exe // {mode}</span>
            </div>

            {/* The Text Stream */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                {logs.map((log, index) => {
                    // Detect if this specific log is an error payload
                    const isError = log.includes("[ERROR]") || log.includes("🚨");

                    return (
                        <div
                            key={index}
                            className={`animate-in fade-in slide-in-from-bottom-1 duration-300 ${isError ? 'text-red-400 font-bold drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]' :
                                    index === logs.length - 1 && status === 'processing' ? 'text-emerald-400 font-bold drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]' :
                                        'text-emerald-700'
                                }`}
                        >
                            {log}
                        </div>
                    );
                })}

                {/* Blinking Cursor - Only pulses when actively waiting for C# */}
                {/* OPTION 3: Arc Reactor Loader */}
                {status === 'processing' && (
                    <div className="flex items-center gap-3 mt-2 pl-1" ref={bottomRef}>
                        <div className="relative flex justify-center items-center h-4 w-4">
                            {/* Outer fast spin */}
                            <div className="absolute inset-0 rounded-full border-t-2 border-emerald-400 animate-spin shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
                            {/* Inner slow reverse spin */}
                            <div className="absolute inset-0 rounded-full border-r-2 border-emerald-400/50 animate-[spin_1.5s_reverse_infinite]"></div>
                            {/* Pulsing Core */}
                            <div className="h-1.5 w-1.5 bg-emerald-300 rounded-full animate-pulse shadow-[0_0_5px_rgba(52,211,153,1)]"></div>
                        </div>
                        <span className="text-emerald-400/80 text-[10px] font-black tracking-widest uppercase animate-pulse">
                            Awaiting Neural Link
                        </span>
                    </div>
                )}
                {status !== 'processing' && <div ref={bottomRef}></div>}
            </div>

            {/* Scanline effect overlay */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20"></div>
        </div>
    );
};

export default AgentConsole;