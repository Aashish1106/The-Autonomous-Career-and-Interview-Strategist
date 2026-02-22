import React from 'react';

const GenAILoader = ({ message }) => {
    return (
        <div className="w-full flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-500">

            {/* Dual-Spinning Arc Reactor Core */}
            <div className="relative flex justify-center items-center h-16 w-16 mb-6">
                {/* Outer Fast Ring */}
                <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-emerald-400/80 animate-[spin_1s_linear_infinite] shadow-[0_0_15px_rgba(16,185,129,0.4)]"></div>

                {/* Inner Slow Reverse Ring */}
                <div className="absolute inset-2 rounded-full border-b-2 border-l-2 border-purple-500/80 animate-[spin_2s_reverse_linear_infinite] shadow-[0_0_15px_rgba(168,85,247,0.4)]"></div>

                {/* Blinding Pulsing Center */}
                <div className="h-4 w-4 bg-white rounded-full animate-pulse shadow-[0_0_20px_rgba(255,255,255,1)]"></div>
            </div>

            {/* Glowing Telemetry Text */}
            <p className="text-[10px] sm:text-xs font-black tracking-[0.3em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-purple-400 animate-pulse drop-shadow-md text-center px-4">
                {message || "ESTABLISHING NEURAL LINK..."}
            </p>
        </div>
    );
};

export default GenAILoader;