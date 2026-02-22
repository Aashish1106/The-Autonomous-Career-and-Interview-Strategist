import { useState, useEffect } from 'react'
import MatchCard from './components/MatchCard'
import EvaluationHistory from './components/EvaluationHistory';
import AdminSettings from './components/AdminSettings';

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
                    Jarvis Agentic Pipeline
                </div>
                <h1 className="text-5xl font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                    Autonomous Career Strategist
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

                        {/* TAB 1: Evaluation History */}
                        {activeTab === 'history' && (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                                <EvaluationHistory />
                            </div>
                        )}

                        {/* TAB 2: Vector Search */}
                        {activeTab === 'search' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                    <div>
                                        <p className="text-slate-400 text-sm">Mathematically rank your saved jobs against your Postgres profile.</p>
                                    </div>
                                    <div className="relative group/btn w-full md:w-auto mt-2 md:mt-0">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-xl blur opacity-30 group-hover/btn:opacity-60 transition duration-500"></div>
                                        <button
                                            onClick={handleFindMatches}
                                            disabled={isSearching}
                                            className="relative w-full md:w-auto px-6 py-3 bg-slate-900 text-white font-bold rounded-xl border border-white/10 hover:bg-slate-800 hover:border-purple-500/50 transition-all duration-300 disabled:opacity-80 disabled:cursor-not-allowed active:scale-[0.98] overflow-hidden flex items-center justify-center"
                                        >
                                            {isSearching ? (
                                                <span className="flex items-center justify-center gap-3">
                                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-200 animate-pulse">
                                                        Calculating Math...
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="flex items-center justify-center gap-2 group-hover/btn:tracking-wider transition-all duration-300">
                                                    <svg className="w-5 h-5 text-purple-400 group-hover/btn:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                                    Find Best Matches
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Results List */}
                                {topMatches.length > 0 ? (
                                    <div className="space-y-4">
                                        {topMatches.map((match, index) => (
                                            <div key={match.id} className="group relative overflow-hidden bg-slate-950/40 border border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-purple-500/40 hover:bg-slate-900/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)] transition-all duration-300">
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none"></div>
                                                <div className="flex items-center gap-4 relative z-10 transition-transform duration-300 group-hover:translate-x-1">
                                                    <div className="h-10 w-10 rounded-full bg-slate-800/80 text-purple-300 flex items-center justify-center font-bold font-mono text-sm border border-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                                                        #{index + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-100 tracking-wide">{match.companyName}</h4>
                                                        <span className="text-slate-500 text-sm">{match.roleTitle}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 w-full md:w-auto relative z-10">
                                                    <div className="flex-1 md:flex-none bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-center flex flex-col justify-center transition-colors group-hover:bg-emerald-500/20">
                                                        <div className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-widest mb-0.5">Vector Math</div>
                                                        <div className="text-emerald-400 font-black drop-shadow-md">{match.vectorMatchScore}%</div>
                                                    </div>
                                                    <div className="flex-1 md:flex-none bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2 text-center flex flex-col justify-center transition-colors group-hover:bg-purple-500/20">
                                                        <div className="text-[10px] text-purple-400/70 font-bold uppercase tracking-widest mb-0.5">LLM Vibes</div>
                                                        <div className="text-purple-400 font-black drop-shadow-md">{match.llmMatchScore}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-1000">
                                        <div className="text-4xl mb-3 opacity-50">📡</div>
                                        Awaiting command to query PostgreSQL vector space.
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