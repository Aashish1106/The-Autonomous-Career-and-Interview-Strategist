import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import MatchCard from './components/MatchCard'
import EvaluationHistory from './components/EvaluationHistory';
import AdminSettings from './components/AdminSettings';
import KanbanBoard from './components/KanbanBoard';

function App() {
    const [activeTab, setActiveTab] = useState('history'); // 'history', 'search', or 'settings'
    const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting', 'connected', 'error'
    const [toastMessage, setToastMessage] = useState(null);
    // ---> ADDED: Recalibration State <---
    const [isRecalibrating, setIsRecalibrating] = useState(false);

    // ---> NEW: NOTIFICATION STATE <---
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([
        { id: 1, type: 'interview', title: 'Interview Tomorrow', message: 'Societe Generale - Technical Round at 10:00 AM.', time: '10 mins ago', read: false },
        { id: 2, type: 'system', title: 'ACE Agent Report', message: 'Scraped and queued 4 high-match jobs while you were away.', time: '2 hours ago', read: false },
        { id: 3, type: 'action', title: 'Stale Application', message: 'Pluralsight application deployed 14 days ago. Time to follow up.', time: '1 day ago', read: true }
    ]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAllAsRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
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

    const handleRecalibrate = async () => {
        setIsRecalibrating(true);
        try {
            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/recalibrate", {
                method: "POST"
            });

            if (!response.ok) {
                // ---> Actually read the error from C# <---
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const data = await response.json();
            showToast(data.message);
        } catch (error) {
            console.error("Recalibration failed:", error);
            showToast(`🚨 ${error.message}`);
        } finally {
            setIsRecalibrating(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-200 via-purple-100 to-fuchsia-100 py-12 px-4 font-sans text-slate-800 selection:bg-violet-500/20">

            {/* ---> DATABASE TELEMETRY HUD (RESPONSIVE) <--- */}
            {/* ---> GLOBAL TELEMETRY & NOTIFICATION HUD <--- */}
            <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-3 md:gap-4 z-[300]">

                {/* 1. The Notification Bell */}
                <div className="relative">
                    <button
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className={`relative p-2.5 md:p-3 rounded-full bg-white/80 border transition-all shadow-sm backdrop-blur-md flex items-center justify-center hover:scale-105 active:scale-95 ${isNotifOpen ? 'border-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'border-white hover:border-violet-200'}`}
                    >
                        <span className="text-sm md:text-base grayscale opacity-80">🔔</span>
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-rose-500 text-[9px] md:text-[10px] font-black text-white shadow-md ring-2 ring-white animate-in zoom-in">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {/* The Dropdown Panel */}
                    {isNotifOpen && (
                        <div className="absolute top-full right-0 mt-3 w-80 md:w-96 bg-white/95 backdrop-blur-2xl border border-violet-100 shadow-[0_20px_50px_-10px_rgba(139,92,246,0.2)] rounded-3xl overflow-hidden animate-in slide-in-from-top-4 fade-in duration-200 origin-top-right">
                            <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                                    <span>📡</span> Command Feed
                                </h3>
                                {unreadCount > 0 && (
                                    <button onClick={markAllAsRead} className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-violet-600 hover:text-violet-800 transition-colors">
                                        Mark Read
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col">
                                {notifications.length > 0 ? notifications.map((notif) => (
                                    <div key={notif.id} className={`p-4 md:p-5 border-b border-slate-50 flex gap-3 md:gap-4 transition-colors hover:bg-slate-50 cursor-default ${!notif.read ? 'bg-violet-50/30' : 'opacity-70'}`}>
                                        <div className="mt-0.5 text-lg md:text-xl shrink-0">
                                            {notif.type === 'interview' ? '📅' : notif.type === 'system' ? '🤖' : '⚠️'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className={`text-xs md:text-sm font-bold ${!notif.read ? 'text-slate-800' : 'text-slate-600'}`}>{notif.title}</h4>
                                                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{notif.time}</span>
                                            </div>
                                            <p className="text-xs md:text-sm font-serif text-slate-500 leading-relaxed">{notif.message}</p>
                                        </div>
                                        {!notif.read && (
                                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-violet-500 shrink-0 mt-2 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></div>
                                        )}
                                    </div>
                                )) : (
                                    <div className="p-8 text-center text-slate-400 font-mono text-xs uppercase tracking-widest">
                                        No new events detected.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Postgres DB Status (Original) */}
                <div className="flex items-center gap-2 md:gap-3 bg-white/80 border border-white rounded-full px-3 py-2 md:px-4 md:py-2.5 shadow-sm backdrop-blur-md">
                    <div className="flex items-center justify-center w-2 h-2 md:w-2.5 md:h-2.5">
                        <span className={`absolute w-2 h-2 md:w-2.5 md:h-2.5 rounded-full opacity-75 animate-ping ${dbStatus === 'connected' ? 'bg-emerald-400' : dbStatus === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                        <span className={`relative w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : dbStatus === 'connecting' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                    </div>
                    <span className="text-[9px] md:text-[10px] font-mono font-bold tracking-widest uppercase text-slate-500">
                        <span className="hidden md:inline">Postgres DB: </span>
                        <span className={dbStatus === 'connected' ? 'text-emerald-600' : dbStatus === 'connecting' ? 'text-amber-600' : 'text-rose-600'}>
                            {dbStatus === 'connected' ? 'ONLINE' : dbStatus === 'connecting' ? 'SYNCING...' : 'OFFLINE'}
                        </span>
                    </span>
                </div>

            </div>

            <div className="max-w-3xl mx-auto text-center mt-8 md:mt-0 mb-8 md:mb-12 animate-in slide-in-from-top-4 fade-in duration-700">
                <div className="inline-flex items-center justify-center px-3 py-1 md:px-4 md:py-1.5 mb-4 md:mb-6 rounded-full bg-white border border-violet-200 text-violet-700 text-xs md:text-sm font-semibold uppercase tracking-widest shadow-sm">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
                    Jarvis Agentic Ecosystem
                </div>
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

                {/* ---> THE TABBED DATA CONTAINER <--- */}
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden mt-8 relative">

                    {/* Tab Navigation Container - 100% Unbreakable on Mobile and Desktop */}
                    <div className="flex overflow-x-auto whitespace-nowrap scrollbar-hide border-b border-slate-200 bg-white/40 w-full custom-scrollbar">

                        
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`relative flex-1 min-w-[160px] py-4 px-2 text-center font-bold text-xs md:text-sm tracking-wider uppercase transition-colors duration-200 flex items-center justify-center gap-2 ${activeTab === 'history' ? 'text-violet-700 bg-violet-50/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                        >
                            <span className={`transition-all duration-300 hidden sm:inline-block ${activeTab === 'history' ? 'scale-110' : 'scale-100 grayscale opacity-70'}`}>🗄️</span>
                            <span>Evaluation History</span>
                            {/* The Bulletproof Indicator */}
                            {activeTab === 'history' && (
                                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.6)]"></div>
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`relative flex-1 min-w-[160px] py-4 px-2 text-center font-bold text-xs md:text-sm tracking-wider uppercase transition-colors duration-200 flex items-center justify-center gap-2 ${activeTab === 'settings' ? 'text-blue-700 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                        >
                            <span className={`transition-all duration-300 hidden sm:inline-block ${activeTab === 'settings' ? 'scale-110' : 'scale-100 grayscale opacity-70'}`}>⚙️</span>
                            <span>Admin Data</span>
                            {/* The Bulletproof Indicator */}
                            {activeTab === 'settings' && (
                                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]"></div>
                            )}
                        </button>
                    </div>

                    {/* Tab Content Area */}
                    <div className="p-4 md:p-6 min-h-[300px]">

                        {/* ----------------------------------------------------------------- */}
                        {/* TAB 1: EVALUATION HISTORY / STRATEGIC ACTION MATRIX */}
                        {/* ----------------------------------------------------------------- */}
                        {activeTab === 'history' && (
                            <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-violet-100 pb-6 mb-6 gap-4">
                                    <div>
                                        <h3 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-3">
                                            Action Matrix
                                        </h3>
                                        <div className="flex flex-wrap gap-2 text-[10px] md:text-xs font-mono">
                                            <span className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-full">Live Pipeline</span>
                                            <span className="bg-violet-50 text-violet-600 border border-violet-200 px-3 py-1 rounded-full">Auto-Sync Active</span>
                                        </div>
                                    </div>

                                    {/* ---> UPDATED: Animated Recalibrate Button <--- */}
                                    <button
                                        onClick={handleRecalibrate}
                                        disabled={isRecalibrating}
                                        className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-5 py-2.5 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all shadow-sm disabled:opacity-70 flex items-center gap-2 w-full md:w-auto justify-center whitespace-nowrap"
                                    >
                                        {isRecalibrating ? (
                                            <>
                                                <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></span>
                                                Re-embedding...
                                            </>
                                        ) : (
                                            "Recalibrate Vectors"
                                        )}
                                    </button>
                                </div>

                                {/* ---> INJECT THE KANBAN BOARD HERE <--- */}
                                <div className="flex-1 overflow-hidden">
                                    <KanbanBoard />
                                </div>
                            </div>
                        )}          

                        {/* ---> TAB 2: Admin Settings <--- */}
                        {activeTab === 'settings' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                <AdminSettings />
                            </div>
                        )}

                        {/* ---> UPGRADED TOAST USING PORTAL <--- */}
                        {toastMessage && createPortal(
                            <div className="fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-8 fade-in duration-300">
                                <div className="bg-slate-900/90 backdrop-blur-xl border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] text-blue-400 px-6 py-4 rounded-xl font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-4">
                                    {toastMessage}
                                </div>
                            </div>,
                            document.body
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}

export default App