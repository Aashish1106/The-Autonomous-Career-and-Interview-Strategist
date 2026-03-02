import { useState, useEffect } from 'react'
import MatchCard from './components/MatchCard'
import EvaluationHistory from './components/EvaluationHistory';
import AdminSettings from './components/AdminSettings';
import KanbanBoard from './components/KanbanBoard';

function App() {
    const [topMatches, setTopMatches] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState('history'); // 'history', 'search', or 'settings'
    const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting', 'connected', 'error'

    const handleFindMatches = async () => {
        setIsSearching(true);
        try {
            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/top-matches");
            if (!response.ok) {
                const errorText = await response.text();
                alert(`🚨 Vector Search Failed:\n\n${errorText}`);
                return;
            }
            const data = await response.json();
            setTopMatches(data);
        } catch (error) {
            console.error("Fetch error:", error);
            alert("A network error occurred while running the vector search.");
        } finally {
            setIsSearching(false);
        }
    };

    const fetchHistory = async () => {
        try {
            setDbStatus('connecting'); // Ping the DB
            const res = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/history");
            if (res.ok) {
                // We just want to know the DB is alive to turn the HUD green!
                setDbStatus('connected'); // Green Light!
            } else {
                setDbStatus('error'); // Red Light!
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
            setDbStatus('error'); // Red Light!
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-200 via-purple-100 to-fuchsia-100 py-12 px-4 font-sans text-slate-800 selection:bg-violet-500/20">

            {/* ---> DATABASE TELEMETRY HUD (RESPONSIVE) <--- */}
            {/* Changed top-6 to top-4 md:top-8 to keep it out of the way on small screens */}
            <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-2 md:gap-3 bg-white/80 border border-white rounded-full px-3 py-1.5 md:px-4 md:py-2 shadow-sm backdrop-blur-md z-50">
                <div className="flex items-center justify-center w-2 h-2 md:w-3 md:h-3">
                    <span className={`absolute w-2 h-2 md:w-3 md:h-3 rounded-full opacity-75 animate-ping ${dbStatus === 'connected' ? 'bg-emerald-400' : dbStatus === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                    <span className={`relative w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : dbStatus === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                </div>
                {/* Hidden the "Postgres DB:" text on mobile to save space, showing only status */}
                <span className="text-[9px] md:text-[10px] font-mono font-bold tracking-widest uppercase text-slate-500">
                    <span className="hidden md:inline">Postgres DB: </span>
                    <span className={dbStatus === 'connected' ? 'text-emerald-600' : dbStatus === 'connecting' ? 'text-amber-600' : 'text-rose-600'}>
                        {dbStatus === 'connected' ? 'ONLINE' : dbStatus === 'connecting' ? 'SYNCING...' : 'OFFLINE'}
                    </span>
                </span>
            </div>

            {/* Adjusted margin-top so it doesn't overlap with the absolute HUD on mobile */}
            <div className="max-w-3xl mx-auto text-center mt-8 md:mt-0 mb-8 md:mb-12 animate-in slide-in-from-top-4 fade-in duration-700">
                <div className="inline-flex items-center justify-center px-3 py-1 md:px-4 md:py-1.5 mb-4 md:mb-6 rounded-full bg-white border border-violet-200 text-violet-700 text-xs md:text-sm font-semibold uppercase tracking-widest shadow-sm">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
                    A JARVIS Agentic Pipeline
                </div>
                {/* Responsive text sizing: 4xl on mobile, 5xl on medium screens, 6xl on large */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-3 md:mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-800 to-teal-700 drop-shadow-sm leading-tight">
                    Autonomous Career Expert
                </h1>
                <p className="text-slate-600 font-medium text-base md:text-lg px-2">
                    Semantic evaluation against your cloud-synced Postgres vector profile.
                </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-8">

                {/* THE AGENTIC MATCH CARD HANDLES EVERYTHING HERE */}
                <MatchCard />

                {/* ---> THE TABBED DATA CONTAINER (FROSTED LIGHT MODE) <--- */}
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden mt-8 relative">

                    {/* The Sliding Glowing Underline - Fixed for Mobile Scrolling */}
                    <div
                        // Changed width from w-1/3 to w-[160px] to perfectly match the button min-width!
                        // Added hidden md:block so we just remove the line on super small screens where it conflicts with scrolling
                        className="absolute top-[55px] left-0 h-[3px] w-[160px] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-20 hidden sm:block"
                        style={{
                            transform: activeTab === 'search' ? 'translateX(0px)' : activeTab === 'history' ? 'translateX(160px)' : 'translateX(320px)',
                            backgroundColor: activeTab === 'search' ? '#10b981' : activeTab === 'history' ? '#a855f7' : '#3b82f6',
                            boxShadow: activeTab === 'search' ? '0 0 15px rgba(16,185,129,0.4)' : activeTab === 'history' ? '0 0 15px rgba(168,85,247,0.4)' : '0 0 15px rgba(59,130,246,0.4)'
                        }}
                    />

                    {/* Tab Navigation */}
                    <div className="flex overflow-x-auto whitespace-nowrap scrollbar-hide border-b border-violet-100 relative z-10 bg-white/40 custom-scrollbar">
                        <button
                            onClick={() => setActiveTab('search')}
                            // Added shrink-0 and min-w-[160px] to ensure they never squish on mobile
                            className={`shrink-0 min-w-[160px] flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition-colors duration-300 flex items-center justify-center gap-2 ${activeTab === 'search' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}
                        >
                            <span className={`transition-all duration-300 ${activeTab === 'search' ? 'scale-110' : 'scale-100 grayscale opacity-70'}`}>🧠</span>
                            Vector RAG Search
                        </button>

                        <button
                            onClick={() => setActiveTab('history')}
                            className={`shrink-0 min-w-[160px] flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition-colors duration-300 flex items-center justify-center gap-2 ${activeTab === 'history' ? 'text-violet-700 bg-violet-50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}
                        >
                            <span className={`transition-all duration-300 ${activeTab === 'history' ? 'scale-110' : 'scale-100 grayscale opacity-70'}`}>🗄️</span>
                            Evaluation History
                        </button>

                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`shrink-0 min-w-[160px] flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition-colors duration-300 flex items-center justify-center gap-2 ${activeTab === 'settings' ? 'text-blue-700 bg-blue-50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}
                        >
                            <span className={`transition-all duration-300 ${activeTab === 'settings' ? 'scale-110' : 'scale-100 grayscale opacity-70'}`}>⚙️</span>
                            Admin Data
                        </button>
                    </div>

                    {/* Tab Content Area */}
                    <div className="p-6 min-h-[300px]">

                        {/* ----------------------------------------------------------------- */}
                        {/* TAB 1: EVALUATION HISTORY / STRATEGIC ACTION MATRIX */}
                        {/* ----------------------------------------------------------------- */}
                        {activeTab === 'history' && (
                            <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                                <div className="flex justify-between items-start border-b border-violet-100 pb-6 mb-2">
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-3">
                                            Strategic Action Matrix
                                        </h3>
                                        <div className="flex gap-2 text-xs font-mono">
                                            <span className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-full">Live Pipeline</span>
                                            <span className="bg-violet-50 text-violet-600 border border-violet-200 px-3 py-1 rounded-full">Auto-Sync Active</span>
                                        </div>
                                    </div>

                                    <button className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm">
                                        Recalibrate Vectors
                                    </button>
                                </div>

                                {/* ---> INJECT THE KANBAN BOARD HERE <--- */}
                                <div className="flex-1 overflow-hidden">
                                    <KanbanBoard />
                                </div>
                            </div>
                        )}

                        {/* TAB 2: Vector Search */}
                        {activeTab === 'search' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="mb-8">
                                    <div className="relative group/btn w-full">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-300 to-teal-300 rounded-xl blur opacity-30 group-hover/btn:opacity-60 transition duration-500"></div>
                                        <button
                                            onClick={handleFindMatches}
                                            disabled={isSearching}
                                            className="relative w-full px-6 py-4 bg-white text-emerald-700 font-black uppercase tracking-widest rounded-xl border border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all duration-300 disabled:opacity-80 active:scale-[0.99] flex items-center justify-center gap-3 shadow-sm"
                                        >
                                            {isSearching ? (
                                                <span className="text-emerald-600 animate-pulse flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                                    CALCULATING VECTOR MATH...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2 text-emerald-600">
                                                    <span className="text-lg">🔍</span> FIND BEST MATCHES
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-slate-500 text-xs font-mono uppercase tracking-widest text-center mt-4">
                                        Mathematically rank your saved jobs against your 768-D Postgres profile.
                                    </p>
                                </div>

                                {topMatches.length > 0 ? (
                                    <div className="flex flex-col gap-4">
                                        {topMatches.map((match, index) => (
                                            <div key={match.id} className="group relative overflow-hidden bg-white border border-slate-100 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all duration-300 shadow-sm hover:shadow-md cursor-default hover:-translate-x-1">

                                                {/* The Left Indicator Border */}
                                                <div className={`absolute top-0 left-0 w-1.5 h-full ${index === 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : index === 1 ? 'bg-teal-400' : 'bg-slate-300'}`}></div>

                                                <div className="flex items-center gap-4 relative z-10 pl-2">
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-black font-mono text-sm border ${index === 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                        #{index + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-slate-800 text-lg uppercase tracking-wide truncate max-w-[250px] md:max-w-[300px]" title={match.companyName}>{match.companyName}</h4>
                                                        <span className="text-slate-500 text-sm font-medium block truncate max-w-[250px] md:max-w-[300px]" title={match.roleTitle}>{match.roleTitle}</span>
                                                    </div>
                                                </div>

                                                {/* The Two Distinct Data Pods */}
                                                <div className="flex gap-2 md:gap-3 w-full md:w-auto relative z-10 pl-2 md:pl-0 mt-3 md:mt-0">
                                                    {/* LLM Vibes / ACE Score (Gray Pod) */}
                                                    {/* Added flex-1 so they take up exactly 50% of the screen each on mobile */}
                                                    <div className="flex-1 md:flex-none bg-slate-50 border border-slate-200 rounded-xl px-2 md:px-4 py-2 text-center min-w-[100px]">
                                                        <div className="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">ACE Score</div>
                                                        <div className="text-slate-700 font-black text-lg md:text-xl">{match.llmMatchScore}%</div>
                                                    </div>

                                                    {/* Vector Math (Green Pod) */}
                                                    <div className="flex-1 md:flex-none bg-emerald-50 border border-emerald-200 rounded-xl px-2 md:px-4 py-2 text-center min-w-[100px]">
                                                        <div className="text-[8px] md:text-[9px] text-emerald-600 font-bold uppercase tracking-widest mb-1">Vector Match</div>
                                                        <div className="text-emerald-700 font-black text-lg md:text-xl">{match.vectorMatchScore}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-16 border-2 border-dashed border-violet-200 rounded-2xl bg-white/50">
                                        <span className="text-4xl block mb-4 opacity-50">📡</span>
                                        <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Awaiting command to query PostgreSQL</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ---> NEW TAB 3: Admin Settings <--- */}
                        {activeTab === 'settings' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                {/* Note: You will likely need to update AdminSettings.jsx with light mode classes too! */}
                                <AdminSettings />
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}

export default App