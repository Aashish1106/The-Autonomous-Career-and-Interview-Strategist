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
            const response = await fetch("https://localhost:7155/api/JobStrategist/top-matches");
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
            const res = await fetch("https://localhost:7155/api/JobStrategist/history");
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
        <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] py-12 px-4 font-sans text-slate-200 selection:bg-purple-500/30">

            {/* ---> DATABASE TELEMETRY HUD <--- */}
            <div className="absolute top-6 right-6 md:top-8 md:right-8 flex items-center gap-3 bg-slate-900/60 border border-slate-800/80 rounded-full px-4 py-2 shadow-lg backdrop-blur-md z-50">
                <div className="flex items-center justify-center w-3 h-3">
                    <span className={`absolute w-3 h-3 rounded-full opacity-75 animate-ping ${dbStatus === 'connected' ? 'bg-emerald-500' : dbStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></span>
                    <span className={`relative w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-400' : dbStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-500'
                        }`}></span>
                </div>
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-400">
                    Postgres DB: <span className={dbStatus === 'connected' ? 'text-emerald-400' : dbStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'}>
                        {dbStatus === 'connected' ? 'ONLINE' : dbStatus === 'connecting' ? 'SYNCING...' : 'OFFLINE'}
                    </span>
                </span>
            </div>

            <div className="max-w-3xl mx-auto text-center mb-12 animate-in slide-in-from-top-4 fade-in duration-700">
                <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold uppercase tracking-widest shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                    <span className="w-2 h-2 rounded-full bg-purple-500 mr-2 animate-pulse"></span>
                    A JARVIS Agentic Pipeline
                </div>
                <h1 className="text-5xl font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                    Autonomous Career Expert
                </h1>
                <p className="text-slate-400 font-medium text-lg">
                    Semantic evaluation against your cloud-synced Postgres vector profile.
                </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-8">

                {/* THE AGENTIC MATCH CARD HANDLES EVERYTHING HERE */}
                <MatchCard />

                {/* ---> THE TABBED DATA CONTAINER <--- */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl shadow-xl border border-white/5 overflow-hidden mt-8 relative">

                    {/* The Sliding Glowing Underline (Updated for 3 Tabs) */}
                    <div
                        className="absolute top-[55px] left-0 h-[3px] w-1/3 bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-20"
                        style={{
                            transform: activeTab === 'search' ? 'translateX(0%)' : activeTab === 'history' ? 'translateX(100%)' : 'translateX(200%)',
                            backgroundColor: activeTab === 'search' ? '#10b981' : activeTab === 'history' ? '#a855f7' : '#3b82f6',
                            boxShadow: activeTab === 'search' ? '0 0 15px rgba(16,185,129,0.8)' : activeTab === 'history' ? '0 0 15px rgba(168,85,247,0.8)' : '0 0 15px rgba(59,130,246,0.8)'
                        }}
                    />

                    {/* Tab Navigation (Now with 3 Buttons) */}
                    <div className="flex border-b border-slate-800/80 relative z-10 bg-slate-950/40">
                        <button
                            onClick={() => setActiveTab('search')}
                            className={`flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition-colors duration-300 flex items-center justify-center gap-2 ${activeTab === 'search' ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                                }`}
                        >
                            <span className={`transition-all duration-300 ${activeTab === 'search' ? 'scale-110' : 'scale-100 grayscale opacity-70'}`}>🧠</span>
                            Vector RAG Search
                        </button>

                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition-colors duration-300 flex items-center justify-center gap-2 ${activeTab === 'history' ? 'text-purple-400 bg-purple-500/5' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                                }`}
                        >
                            <span className={`transition-all duration-300 ${activeTab === 'history' ? 'scale-110' : 'scale-100 grayscale opacity-70'}`}>🗄️</span>
                            Evaluation History
                        </button>

                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 py-4 text-center font-bold text-sm tracking-wider uppercase transition-colors duration-300 flex items-center justify-center gap-2 ${activeTab === 'settings' ? 'text-blue-400 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                                }`}
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
                                <div className="flex justify-between items-start border-b border-slate-800 pb-6 mb-2">
                                    <div>
                                        <h3 className="text-3xl font-black text-white uppercase tracking-widest mb-2 flex items-center gap-3">
                                            Strategic Action Matrix
                                        </h3>
                                        <div className="flex gap-2 text-xs font-mono">
                                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full">Live Pipeline</span>
                                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full">Auto-Sync Active</span>
                                        </div>
                                    </div>

                                    {/* Future home of the 'Re-Calibrate Scores' button */}
                                    <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm">
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
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur opacity-20 group-hover/btn:opacity-50 transition duration-500"></div>
                                        <button
                                            onClick={handleFindMatches}
                                            disabled={isSearching}
                                            className="relative w-full px-6 py-4 bg-[#0B101D] text-white font-black uppercase tracking-widest rounded-xl border border-emerald-500/30 hover:border-emerald-400 hover:bg-[#0f172a] transition-all duration-300 disabled:opacity-80 active:scale-[0.99] flex items-center justify-center gap-3 shadow-lg"
                                        >
                                            {isSearching ? (
                                                <span className="text-emerald-400 animate-pulse flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                                    CALCULATING VECTOR MATH...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2 text-emerald-400 drop-shadow-md">
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
                                            <div key={match.id} className="group relative overflow-hidden bg-[#0f172a] border border-slate-800/80 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-emerald-500/40 hover:bg-[#131c31] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.05)] cursor-default hover:-translate-x-1">

                                                {/* The Left Neon Border */}
                                                <div className={`absolute top-0 left-0 w-1.5 h-full ${index === 0 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : index === 1 ? 'bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.6)]' : 'bg-slate-600'}`}></div>

                                                <div className="flex items-center gap-4 relative z-10 pl-2">
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-black font-mono text-sm border shadow-inner ${index === 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-800/80 text-slate-400 border-slate-700'}`}>
                                                        #{index + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-white text-lg uppercase tracking-wide truncate max-w-[250px] md:max-w-[300px]" title={match.companyName}>{match.companyName}</h4>
                                                        <span className="text-slate-400 text-sm font-medium block truncate max-w-[250px] md:max-w-[300px]" title={match.roleTitle}>{match.roleTitle}</span>
                                                    </div>
                                                </div>

                                                {/* The Two Distinct Data Pods */}
                                                <div className="flex gap-3 w-full md:w-auto relative z-10 pl-2 md:pl-0 mt-2 md:mt-0">
                                                    {/* LLM Vibes / ACE Score (Gray/Purple Pod) */}
                                                    <div className="bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2 text-center min-w-[100px] shadow-inner">
                                                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">ACE Score</div>
                                                        <div className="text-slate-300 font-black text-xl">{match.llmMatchScore}%</div>
                                                    </div>

                                                    {/* Vector Math (Glowing Green Pod) */}
                                                    <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl px-4 py-2 text-center min-w-[100px] shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]">
                                                        <div className="text-[9px] text-emerald-500/80 font-bold uppercase tracking-widest mb-1">Vector Match</div>
                                                        <div className="text-emerald-400 font-black text-xl drop-shadow-md">{match.vectorMatchScore}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-16 border-2 border-dashed border-slate-800/80 rounded-2xl bg-[#0f172a]/50">
                                        <span className="text-4xl block mb-4 opacity-50">📡</span>
                                        <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Awaiting command to query PostgreSQL</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ---> NEW TAB 3: Admin Settings <--- */}
                        {activeTab === 'settings' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
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