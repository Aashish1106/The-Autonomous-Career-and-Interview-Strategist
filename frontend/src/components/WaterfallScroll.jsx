import React from 'react';

const WaterfallScroll = ({ children, className = "" }) => {
    return (
        <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-[inherit]">

            {/* The Top 3D Cliff Shadow */}
            <div className="absolute top-0 left-0 right-0 h-6 shadow-[inset_0_12px_12px_-12px_rgba(15,23,42,0.15)] z-20 pointer-events-none rounded-t-[inherit]"></div>

            {/* The Scrolling Content */}
            <div
                className={`h-full overflow-y-auto custom-scrollbar relative z-10 ${className}`}
                style={{
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 12px), transparent 100%)',
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 12px), transparent 100%)'
                }}
            >
                {children}
            </div>

            {/* The Bottom 3D Cliff Shadow */}
            <div className="absolute bottom-0 left-0 right-0 h-8 shadow-[inset_0_-16px_16px_-16px_rgba(15,23,42,0.15)] bg-gradient-to-t from-white/30 to-transparent z-20 pointer-events-none rounded-b-[inherit]"></div>
        </div>
    );
};

export default WaterfallScroll;