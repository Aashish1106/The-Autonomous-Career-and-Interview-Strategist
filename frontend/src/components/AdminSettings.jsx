import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const AdminSettings = () => {
    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState('identity');
    const [toastMessage, setToastMessage] = useState(null);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [copiedId, setCopiedId] = useState(null);
    const toastTimerRef = useRef(null);

    // ---> NEW: ABORT CONTROLLER REF <---
    const abortControllerRef = useRef(null);

    // --- 1. IDENTITY MATRIX STATE ---
    const initialFormState = {
        fullName: '', profileSummary: '', coreSkills: '',
        workExperience: [], education: [], projects: [], certifications: ''
    };

    const [resumeData, setResumeData] = useState(initialFormState);
    const [originalData, setOriginalData] = useState(initialFormState); // Ground Truth Backup

    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    // --- 2. AUTOMATION HUB STATE ---
    const [botConfig, setBotConfig] = useState({
        linkedInEmail: '', linkedInPassword: '', dailyLimit: 25, headlessMode: true, matchThreshold: 75
    });

    // --- 3. TELEMETRY STATE ---
    const [telemetryData, setTelemetryData] = useState(null);
    const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);

    // --- HELPERS ---
    const showToast = (message) => {
        setToastMessage(message);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
    };

    const handleCopyText = (text, id) => {
        if (!text) return showToast("⚠️ Nothing to copy!");
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        const sectionName = id.includes('-') ? id.split('-')[0] : id;
        showToast(`📋 ${sectionName.toUpperCase()} COPIED`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatJobForCopy = (job) => {
        const bullets = Array.isArray(job.bullets) ? job.bullets.map(b => `• ${b}`).join('\n') : `• ${job.bullets}`;
        return `${job.role} at ${job.company}\n${job.duration}\n${bullets}`;
    };

    const formatProjectForCopy = (proj) => {
        const stack = Array.isArray(proj.technologies) ? proj.technologies.join(', ') : proj.technologies;
        return `${proj.name}\nTechnologies: ${stack}\n${proj.description}`;
    };

    // --- 1. FETCH EXISTING PROFILE ON LOAD (Run Once) ---
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch("https://localhost:7155/api/JobStrategist/profile");
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.structuredResumeJson) {
                        const parsedData = JSON.parse(data.structuredResumeJson);
                        const mergedData = { ...parsedData, fullName: data.fullName || parsedData.fullName };
                        setResumeData(mergedData);
                        setOriginalData(mergedData); // Lock in the Ground Truth
                    }
                }
            } catch (error) {
                console.error("No existing profile found", error);
            } finally {
                setIsLoadingProfile(false);
            }
        };
        fetchProfile();
    }, []); // <--- EMPTY ARRAY: Only runs when the component first loads

    // --- 2. FETCH BOT CONFIG (Run dynamically) ---
    useEffect(() => {
        if (activeTab === 'automation') {
            const fetchBotConfig = async () => {
                try {
                    const response = await fetch("https://localhost:7155/api/JobStrategist/bot-config");
                    if (response.ok) {
                        const data = await response.json();
                        setBotConfig(data);
                    }
                } catch (error) {
                    console.error("Failed to fetch bot config", error);
                }
            };
            fetchBotConfig();
        }
    }, [activeTab]); // <--- DEPENDENCY ARRAY: Runs when the tab changes

    // --- TELEMETRY LOGIC ---
    const fetchTelemetry = async () => {
        setIsRefreshingTelemetry(true);
        try {
            const response = await fetch("https://localhost:7155/api/JobStrategist/telemetry");
            if (response.ok) setTelemetryData(await response.json());
        } catch (error) {
            console.error("Telemetry failed", error);
        } finally {
            setIsRefreshingTelemetry(false);
        }
    };

    useEffect(() => { if (activeTab === 'telemetry') fetchTelemetry(); }, [activeTab]);

    // --- IDENTITY MATRIX FUNCTIONS ---
    const addExperience = () => setResumeData(prev => ({ ...prev, workExperience: [...prev.workExperience, { company: '', role: '', duration: '', bullets: [''] }] }));
    const addProject = () => setResumeData(prev => ({ ...prev, projects: [...prev.projects, { name: '', technologies: '', description: '' }] }));
    const addEducation = () => setResumeData(prev => ({ ...prev, education: [...prev.education, { institution: '', degree: '', duration: '' }] }));

    const updateCollection = (collection, index, field, value) => {
        const updated = [...resumeData[collection]];
        updated[index][field] = value;
        setResumeData(prev => ({ ...prev, [collection]: updated }));
    };

    // ---> NEW: THE KILL SWITCH (ABORT) <---
    const handleAbort = () => {
        if (isUploading && abortControllerRef.current) {
            abortControllerRef.current.abort(); // Severs the HTTP request instantly
        }
        setResumeData(originalData); // Perfectly restores the UI from the DB backup
        setIsEditingProfile(false);
        setIsUploading(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        // Initialize the Abort Controller for this request
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch("https://localhost:7155/api/JobStrategist/parse-pdf", {
                method: "POST",
                body: formData,
                signal: abortControllerRef.current.signal // Attach the kill switch
            });

            // ---> CRITICAL FIX 1: THE CRASH TRAP <---
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText); // Throw it to the catch block below
            }

            const aiData = await response.json();
            const formattedSkills = Array.isArray(aiData.coreSkills) ? aiData.coreSkills.join(', ') : (aiData.coreSkills || '');
            const formattedCerts = Array.isArray(aiData.certifications) ? aiData.certifications.join('\n') : (aiData.certifications || '');

            // ---> CRITICAL FIX 2: PRESERVE DYNAMIC SECTIONS <---
            setResumeData({
                ...aiData, // This ensures "Social Engagements" or any custom keys Gemini finds are saved!
                fullName: aiData.fullName || '',
                profileSummary: aiData.profileSummary || '',
                coreSkills: formattedSkills,
                workExperience: aiData.workExperience || [],
                education: aiData.education || [],
                projects: aiData.projects || [],
                certifications: formattedCerts
            });

            showToast("✅ PDF Extracted (Review Draft)");

        } catch (error) {
            if (error.name === 'AbortError') {
                showToast("🛑 AI Extraction Cancelled");
            } else {
                console.error("Backend PDF Error:", error.message);

                // Show the ACTUAL C# error to the user so we know why it failed
                showToast(`🚨 Extraction Failed: ${error.message.substring(0, 50)}...`);
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveIdentity = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const payload = {
            fullName: resumeData.fullName,
            baseResumeText: JSON.stringify(resumeData),
            coreSkills: typeof resumeData.coreSkills === 'string' ? resumeData.coreSkills.split(',').map(s => s.trim()) : resumeData.coreSkills,
            structuredResumeJson: resumeData
        };

        try {
            await fetch("https://localhost:7155/api/JobStrategist/profile", {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            setOriginalData(resumeData); // Update the Backup with the newly saved truth
            showToast("🔐 Master Context Updated");
            setIsEditingProfile(false);
            window.dispatchEvent(new Event('vaultUpdated'));
        } catch (error) {
            showToast("🚨 Database Sync Failed");
            console.error("Database Sync Failed.", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveBotConfig = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch("https://localhost:7155/api/JobStrategist/bot-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(botConfig)
            });

            if (response.ok) {
                showToast("🤖 Automation Protocols Locked");
            } else {
                showToast("🚨 Failed to save config");
            }
        } catch (error) {
            console.error("Error saving bot config:", error);
            showToast("🚨 Server Connection Error");
        }
    };

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <style>
                {`
                    @keyframes scan { 0%, 100% { top: -10%; opacity: 0; } 20% { opacity: 1; } 80% { top: 110%; opacity: 1; } }
                    @keyframes pulse-ring { 0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); } 70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(168, 85, 247, 0); } 100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); } }
                    @keyframes shimmer { 100% { transform: translateX(100%); } }
                `}
                
            </style>

            <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-4">
                <span className="text-4xl">⚙️</span>
                <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-wider">Command Center</h2>
                    <p className="text-slate-400 font-mono text-xs mt-1">Configure ACE underlying architecture and automation protocols.</p>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex gap-4 mb-8">
                <button onClick={() => setActiveTab('identity')} className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'identity' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'}`}>🧬 Identity Matrix</button>
                <button onClick={() => setActiveTab('automation')} className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'automation' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'}`}>🤖 Automation Hub</button>
                <button onClick={() => setActiveTab('telemetry')} className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${activeTab === 'telemetry' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'}`}>📊 System Telemetry</button>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl rounded-[22px] p-8 border border-slate-800 shadow-2xl relative overflow-hidden">

                {/* ----------------------------------------------------------------- */}
                {/* TAB 1: IDENTITY MATRIX */}
                {/* ----------------------------------------------------------------- */}
                {activeTab === 'identity' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">

                        {isLoadingProfile ? (
                            <div className="text-center py-20 text-slate-400 font-mono animate-pulse">Fetching Master Profile...</div>
                        ) : !isEditingProfile ? (

                            /* ---> READ-ONLY DASHBOARD VIEW <--- */
                            <div className="space-y-10 animate-in slide-in-from-left-4 duration-500">
                                <div className="flex justify-between items-start border-b border-slate-800 pb-6">
                                    <div>
                                        <h3 className="text-3xl font-black text-white uppercase tracking-widest mb-2 flex items-center gap-3">
                                            {resumeData.fullName || 'No Name Provided'}
                                            <button onClick={() => handleCopyText(resumeData.fullName, 'name')} className="text-slate-600 hover:text-emerald-400 transition-colors text-lg" title="Copy Name">{copiedId === 'name' ? '✅' : '📋'}</button>
                                        </h3>
                                        <div className="flex gap-2 text-xs font-mono">
                                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full">Vector Embedded</span>
                                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full">RAG Synced</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsEditingProfile(true)} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-black uppercase text-xs transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:-translate-y-0.5 flex items-center gap-2">
                                        <span>⚙️</span> Edit Neural Identity
                                    </button>
                                </div>

                                <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 group relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2"><span>🎯</span> Profile Summary</h4>
                                        <button onClick={() => handleCopyText(resumeData.profileSummary, 'summary')} className="text-slate-500 hover:text-emerald-400 transition-colors text-sm">{copiedId === 'summary' ? '✅' : '📋'}</button>
                                    </div>
                                    <p className="text-slate-300 text-sm font-serif leading-relaxed">{resumeData.profileSummary || 'No summary provided.'}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><span>💻</span> Core Skills</h4>
                                            <button onClick={() => handleCopyText(resumeData.coreSkills, 'skills')} className="text-slate-500 hover:text-emerald-400 transition-colors text-sm">{copiedId === 'skills' ? '✅' : '📋'}</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {resumeData.coreSkills ? resumeData.coreSkills.split(',').map((skill, idx) => (
                                                <span key={idx} className="bg-slate-800/80 text-emerald-100 px-3 py-1.5 rounded-lg text-xs border border-slate-700/50 shadow-sm">{skill.trim()}</span>
                                            )) : <span className="text-slate-500 text-sm italic">No skills listed.</span>}
                                        </div>
                                    </div>
                                    <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 flex flex-col">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><span>📜</span> Certifications</h4>
                                            <button onClick={() => handleCopyText(resumeData.certifications, 'certs')} className="text-slate-500 hover:text-emerald-400 transition-colors text-sm">{copiedId === 'certs' ? '✅' : '📋'}</button>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {resumeData.certifications ? (
                                                <ul className="space-y-2">
                                                    {resumeData.certifications.split(/[\n•*]/).filter(c => c.trim() !== '').map((cert, idx) => (
                                                        <li key={idx} className="text-slate-300 text-xs font-serif flex items-start gap-2"><span className="text-blue-500 mt-0.5">▹</span> {cert.trim()}</li>
                                                    ))}
                                                </ul>
                                            ) : <span className="text-slate-500 text-sm italic">No certifications listed.</span>}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><span>🏢</span> Professional Arsenal</h4>
                                    <div className="space-y-4">
                                        {resumeData.workExperience?.length > 0 ? resumeData.workExperience.map((job, idx) => (
                                            <div key={idx} className="bg-slate-950/40 p-6 rounded-2xl border border-slate-800 relative overflow-hidden group">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50"></div>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h5 className="text-lg font-bold text-white">{job.role}</h5>
                                                        <div className="text-purple-400 text-sm font-mono">{job.company}</div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg text-xs font-bold">{job.duration}</span>
                                                        <button onClick={() => handleCopyText(formatJobForCopy(job), `job-${idx}`)} className="text-slate-500 hover:text-emerald-400 transition-colors">{copiedId === `job-${idx}` ? '✅' : '📋'}</button>
                                                    </div>
                                                </div>
                                                <ul className="space-y-2 mt-4">
                                                    {job.bullets?.map((bullet, bIdx) => (
                                                        <li key={bIdx} className="text-slate-400 text-sm font-serif leading-relaxed flex items-start gap-3"><span className="text-purple-500 mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></span>{bullet}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )) : <p className="text-slate-500 text-sm italic">No experience records found.</p>}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><span>🚀</span> Strategic Projects</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {resumeData.projects?.length > 0 ? resumeData.projects.map((proj, idx) => {
                                            const techList = Array.isArray(proj.technologies) ? proj.technologies : (proj.technologies ? proj.technologies.split(',') : []);
                                            return (
                                                <div key={idx} className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h5 className="text-md font-bold text-white">{proj.name}</h5>
                                                        <button onClick={() => handleCopyText(formatProjectForCopy(proj), `proj-${idx}`)} className="text-slate-500 hover:text-emerald-400 transition-colors text-sm">{copiedId === `proj-${idx}` ? '✅' : '📋'}</button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                        {techList.map((tech, tIdx) => (
                                                            <span key={tIdx} className="bg-blue-900/30 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-mono">{tech.trim()}</span>
                                                        ))}
                                                    </div>
                                                    <p className="text-slate-400 text-xs font-serif leading-relaxed">{proj.description}</p>
                                                </div>
                                            );
                                        }) : <p className="text-slate-500 text-sm italic">No projects found.</p>}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><span>🎓</span> Academic Arsenal</h4>
                                    <div className="space-y-4">
                                        {resumeData.education?.length > 0 ? resumeData.education.map((edu, idx) => (
                                            <div key={idx} className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 flex justify-between items-center">
                                                <div>
                                                    <h5 className="text-white font-bold text-sm">{edu.degree}</h5>
                                                    <div className="text-emerald-400 text-xs font-mono">{edu.institution}</div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-slate-500 text-xs font-mono">{edu.duration}</span>
                                                    <button onClick={() => handleCopyText(`${edu.degree}\n${edu.institution}\n${edu.duration}`, `edu-${idx}`)} className="text-slate-500 hover:text-emerald-400 transition-colors">{copiedId === `edu-${idx}` ? '✅' : '📋'}</button>
                                                </div>
                                            </div>
                                        )) : <p className="text-slate-500 text-sm italic">No education records found.</p>}
                                    </div>
                                </div>

                                {/* ---> NEW: READ-ONLY DYNAMIC SECTIONS <--- */}
                                {Object.entries(resumeData).map(([key, value]) => {
                                    const standardKeys = ['fullName', 'profileSummary', 'coreSkills', 'certifications', 'workExperience', 'projects', 'education'];
                                    if (standardKeys.includes(key)) return null;
                                    if (!value || (Array.isArray(value) && value.length === 0)) return null;

                                    return (
                                        <div key={key}>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <span>✨</span> {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </h4>
                                            <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800">
                                                {Array.isArray(value) ? (
                                                    <ul className="space-y-2">
                                                        {value.map((item, idx) => (
                                                            <li key={idx} className="text-slate-300 text-xs font-serif flex items-start gap-2"><span className="text-purple-500 mt-0.5">▹</span> {item}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-slate-300 text-sm font-serif leading-relaxed">{String(value)}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                            </div>
                        ) : (

                            /* ---> THE EDIT MODE (Form + Dropzone) <--- */
                            <div className="animate-in slide-in-from-right-4 duration-500">
                                <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Update Neural Identity</h3>
                                        <p className="text-slate-400 text-xs font-mono">Changes here will alter how ACE evaluates all future jobs.</p>
                                    </div>

                                    <button
                                        onClick={handleAbort}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 group"
                                    >
                                        <span className="group-hover:-translate-x-1 transition-transform">{isUploading ? '🛑' : '↩️'}</span>
                                        {isUploading ? 'Kill Scan' : 'Abort Edit'}
                                    </button>
                                </div>

                                <div onClick={() => fileInputRef.current.click()} className="mb-10 border-2 border-dashed border-slate-700 rounded-2xl p-12 text-center hover:bg-slate-800/50 cursor-pointer transition-all group">
                                    <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
                                    {isUploading ? (
                                        <div className="flex flex-col items-center py-6 animate-in fade-in zoom-in-95 duration-500">
                                            <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                                                <div className="absolute inset-0 rounded-full border-t-2 border-b-2 border-purple-500/40 animate-[spin_3s_linear_infinite] shadow-[0_0_15px_rgba(168,85,247,0.2)]"></div>
                                                <div className="absolute inset-2 rounded-full border-l-2 border-r-2 border-blue-400/50 animate-[spin_2s_linear_infinite_reverse] shadow-[0_0_10px_rgba(96,165,250,0.2)]"></div>
                                                <div className="absolute inset-6 rounded-full bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-md border border-white/10 flex items-center justify-center" style={{ animation: 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite' }}>
                                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 absolute animate-ping"></div>
                                                    <span className="text-3xl relative z-10 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">🧠</span>
                                                </div>
                                                <div className="absolute left-[-10%] w-[120%] h-[2px] bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1)] z-20" style={{ animation: 'scan 2.5s ease-in-out infinite' }}></div>
                                            </div>
                                            <h3 className="text-purple-400 font-black uppercase tracking-[0.25em] text-sm animate-pulse drop-shadow-md">Cracking Neural Vault</h3>
                                            <p className="text-slate-500 text-[10px] font-mono mt-3 uppercase tracking-widest">Extracting 768-Dimensional Vectors...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="text-5xl group-hover:-translate-y-2 transition-transform duration-300">📄</div>
                                            <div className="text-slate-300 font-bold">Click or Drag PDF to Auto-Fill Base Identity</div>
                                            <p className="text-slate-500 text-xs">This data is injected into all Cover Letters and Mock Interviews.</p>
                                        </div>
                                    )}
                                </div>

                                <form onSubmit={handleSaveIdentity} className="space-y-12">
                                    <div className="space-y-6 p-6 bg-slate-950/40 rounded-2xl border border-slate-800/60 shadow-inner">
                                        <div><label className="text-[10px] font-black text-white uppercase tracking-widest block mb-2">👤 Full Name</label><input value={resumeData.fullName} onChange={(e) => setResumeData({ ...resumeData, fullName: e.target.value })} disabled={isUploading} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 outline-none focus:border-purple-500 disabled:opacity-50" placeholder="e.g. Tarigoppula Aashish Kumar" /></div>
                                        <div><label className="text-[10px] font-black text-purple-400 uppercase tracking-widest block mb-2">🎯 Profile Summary</label><textarea value={resumeData.profileSummary} onChange={(e) => setResumeData({ ...resumeData, profileSummary: e.target.value })} disabled={isUploading} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 outline-none focus:border-purple-500 disabled:opacity-50" rows="4" /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-2">💻 Core Skills</label><textarea value={resumeData.coreSkills} onChange={(e) => setResumeData({ ...resumeData, coreSkills: e.target.value })} disabled={isUploading} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 outline-none focus:border-emerald-500 disabled:opacity-50" rows="6" placeholder="Comma separated values..." /></div>
                                            <div><label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">📜 Certifications</label><textarea value={resumeData.certifications} onChange={(e) => setResumeData({ ...resumeData, certifications: e.target.value })} disabled={isUploading} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 outline-none focus:border-blue-500 disabled:opacity-50" rows="6" placeholder="Bullet points or new lines..." /></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-8">
                                        {/* Experience */}
                                        <div>
                                            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Professional Arsenal</label>
                                                <button type="button" onClick={addExperience} disabled={isUploading} className="text-[10px] bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full border border-purple-500/20 hover:bg-purple-500/30 transition-all disabled:opacity-50">+ Add Experience</button>
                                            </div>
                                            <div className="space-y-4">
                                                {resumeData.workExperience.map((job, idx) => (
                                                    <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3 relative">
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <input placeholder="Role" value={job.role} disabled={isUploading} onChange={(e) => updateCollection('workExperience', idx, 'role', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white disabled:opacity-50" />
                                                            <input placeholder="Company" value={job.company} disabled={isUploading} onChange={(e) => updateCollection('workExperience', idx, 'company', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-purple-400 disabled:opacity-50" />
                                                            <input placeholder="Duration" value={job.duration} disabled={isUploading} onChange={(e) => updateCollection('workExperience', idx, 'duration', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-400 disabled:opacity-50" />
                                                        </div>
                                                        <textarea placeholder="Bullet points (comma separated or JSON array)" value={Array.isArray(job.bullets) ? job.bullets.join('\n\n') : job.bullets} disabled={isUploading} onChange={(e) => updateCollection('workExperience', idx, 'bullets', e.target.value.split('\n\n'))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-400 custom-scrollbar disabled:opacity-50" rows="4" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Projects */}
                                        <div>
                                            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strategic Projects</label>
                                                <button type="button" onClick={addProject} disabled={isUploading} className="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 hover:bg-blue-500/30 transition-all disabled:opacity-50">+ Add Project</button>
                                            </div>
                                            <div className="space-y-4">
                                                {resumeData.projects.map((proj, idx) => (
                                                    <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
                                                        <input placeholder="Project Name" value={proj.name} disabled={isUploading} onChange={(e) => updateCollection('projects', idx, 'name', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white disabled:opacity-50" />
                                                        <input placeholder="Tech Stack (comma separated)" value={Array.isArray(proj.technologies) ? proj.technologies.join(', ') : proj.technologies} disabled={isUploading} onChange={(e) => updateCollection('projects', idx, 'technologies', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-blue-400 disabled:opacity-50" />
                                                        <textarea placeholder="Description" value={proj.description} disabled={isUploading} onChange={(e) => updateCollection('projects', idx, 'description', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-400 custom-scrollbar disabled:opacity-50" rows="3" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Education */}
                                        <div>
                                            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Arsenal</label>
                                                <button type="button" onClick={addEducation} disabled={isUploading} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 hover:bg-emerald-500/30 transition-all disabled:opacity-50">+ Add Education</button>
                                            </div>
                                            <div className="space-y-4">
                                                {resumeData.education.map((edu, idx) => (
                                                    <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <input placeholder="Institution" value={edu.institution} disabled={isUploading} onChange={(e) => updateCollection('education', idx, 'institution', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white disabled:opacity-50" />
                                                            <input placeholder="Degree" value={edu.degree} disabled={isUploading} onChange={(e) => updateCollection('education', idx, 'degree', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-emerald-400 disabled:opacity-50" />
                                                            <input placeholder="Duration" value={edu.duration} disabled={isUploading} onChange={(e) => updateCollection('education', idx, 'duration', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-500 disabled:opacity-50" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* ---> NEW: DYNAMIC SECTIONS GENERATOR (EDIT MODE) <--- */}
                                        {Object.entries(resumeData).map(([key, value]) => {
                                            const standardKeys = ['fullName', 'profileSummary', 'coreSkills', 'certifications', 'workExperience', 'projects', 'education'];
                                            if (standardKeys.includes(key)) return null;

                                            return (
                                                <div key={key}>
                                                    <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                                        </label>
                                                        <button
                                                            type="button"
                                                            disabled={isUploading}
                                                            onClick={() => {
                                                                const newData = { ...resumeData };
                                                                delete newData[key];
                                                                setResumeData(newData);
                                                            }}
                                                            className="text-[10px] bg-red-500/10 text-red-400 px-3 py-1 rounded-full border border-red-500/20 hover:bg-red-500/30 transition-all disabled:opacity-50"
                                                        >
                                                            🗑️ Remove Section
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        placeholder="Enter items separated by new lines..."
                                                        value={Array.isArray(value) ? value.join('\n') : value}
                                                        disabled={isUploading}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setResumeData({ ...resumeData, [key]: Array.isArray(value) ? val.split('\n') : val });
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 custom-scrollbar disabled:opacity-50"
                                                        rows="4"
                                                    />
                                                </div>
                                            );
                                        })}

                                    </div>

                                    <div className="pt-8 flex justify-between items-center border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={handleAbort}
                                            disabled={isUploading || isSaving}
                                            className="bg-slate-800/60 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/50 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            Cancel Changes
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSaving || isUploading}
                                            className="bg-purple-600 hover:bg-purple-500 text-white px-12 py-4 rounded-xl font-black uppercase text-xs shadow-xl transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                        >
                                            {isSaving ? "Syncing Identity..." : "Save Identity to Vault"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {/* ----------------------------------------------------------------- */}
                {/* TAB 2: AUTOMATION HUB */}
                {/* ----------------------------------------------------------------- */}
                {activeTab === 'automation' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <div className="mb-8 border-l-4 border-blue-500 pl-4">
                            <h3 className="text-xl font-bold text-white">Selenium Auto-Applier Configuration</h3>
                            <p className="text-slate-400 text-sm font-serif">Configure credentials and execution rules for the autonomous application agent.</p>
                        </div>
                        <form onSubmit={handleSaveBotConfig} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 shadow-inner">
                                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-6 flex items-center gap-2"><span>🔑</span> Portal Credentials</h4>
                                    <div className="space-y-4">
                                        <div><label className="text-xs text-slate-400 block mb-1">LinkedIn Email</label><input type="email" value={botConfig.linkedInEmail} onChange={(e) => setBotConfig({ ...botConfig, linkedInEmail: e.target.value })} className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none" placeholder="aashish@example.com" /></div>
                                        <div><label className="text-xs text-slate-400 block mb-1">LinkedIn Password</label><input type="password" value={botConfig.linkedInPassword} onChange={(e) => setBotConfig({ ...botConfig, linkedInPassword: e.target.value })} className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none" placeholder="••••••••••••" /></div>
                                    </div>
                                </div>
                                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 shadow-inner">
                                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-6 flex items-center gap-2"><span>⚡</span> Execution Rules</h4>
                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex justify-between items-center mb-1"><label className="text-xs text-slate-400">Match Threshold Trigger</label><span className="text-emerald-400 font-bold text-sm">{botConfig.matchThreshold}%</span></div>
                                            <input type="range" min="50" max="95" value={botConfig.matchThreshold} onChange={(e) => setBotConfig({ ...botConfig, matchThreshold: parseInt(e.target.value) })} className="w-full accent-emerald-500" />
                                        </div>
                                        <div className="flex items-center justify-between bg-slate-900 border border-slate-700 p-4 rounded-xl">
                                            <div><div className="text-sm font-bold text-slate-200">Stealth Mode (Headless)</div><div className="text-xs text-slate-500">Run browser in background</div></div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={botConfig.headlessMode} onChange={(e) => setBotConfig({ ...botConfig, headlessMode: e.target.checked })} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4 border-t border-slate-800"><button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-3 rounded-xl font-black uppercase text-xs transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:-translate-y-0.5">💾 Save Automation Config</button></div>
                        </form>
                    </div>
                )}

                {/* ----------------------------------------------------------------- */}
                {/* TAB 3: SYSTEM TELEMETRY (NEW REAL-TIME UI) */}
                {/* ----------------------------------------------------------------- */}
                {activeTab === 'telemetry' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span> Live Diagnostics
                                </h3>
                                <p className="text-slate-400 text-xs font-mono mt-1">Real-time database metrics and AI pipeline health.</p>
                            </div>
                            <button onClick={fetchTelemetry} disabled={isRefreshingTelemetry} className="text-xs font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 px-4 py-2 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2">
                                {isRefreshingTelemetry ? "Scanning..." : "🔄 Ping Servers"}
                            </button>
                        </div>

                        {!telemetryData ? (
                            <div className="text-center py-20 text-slate-500 font-mono animate-pulse">Establishing handshake with Postgres...</div>
                        ) : (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl flex items-center gap-4"><div className="text-3xl">🗄️</div><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Database Status</div><div className={`font-mono text-sm font-bold ${telemetryData.status === 'Online' ? 'text-emerald-400' : 'text-red-400'}`}>{telemetryData.status}</div></div></div>
                                    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl flex items-center gap-4"><div className="text-3xl">🧠</div><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vector Engine</div><div className="font-mono text-sm font-bold text-purple-400">{telemetryData.vectorEngine}</div></div></div>
                                    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-xl flex items-center gap-4"><div className="text-3xl">⚡</div><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">LLM API Health</div><div className="font-mono text-sm font-bold text-blue-400">{telemetryData.apiHealth}</div></div></div>
                                </div>

                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6 border-b border-slate-800 pb-2">Volume Metrics</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                                        <div><div className="text-4xl font-black text-white mb-2">{telemetryData.metrics.totalJobsScraped}</div><div className="text-xs font-mono text-slate-400">Total Jobs Scraped</div></div>
                                        <div><div className="text-4xl font-black text-emerald-400 mb-2">{telemetryData.metrics.totalJobsEmbedded}</div><div className="text-xs font-mono text-slate-400">Vectors Embedded</div></div>
                                        <div><div className="text-4xl font-black text-amber-400 mb-2">{telemetryData.metrics.totalVaultRecords}</div><div className="text-xs font-mono text-slate-400">Vault Snapshots</div></div>
                                        <div><div className="text-4xl font-black text-blue-400 mb-2">{telemetryData.metrics.totalInterviews}</div><div className="text-xs font-mono text-slate-400">Mock Interviews</div></div>
                                    </div>
                                </div>

                                {/* ---> NEW: TOKEN RESERVES FUEL BAR <--- */}
                                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-8">
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-1">
                                                <span>🔥</span> Daily API Token Reserves
                                            </h4>
                                            <div className="text-3xl font-black text-amber-400">
                                                {telemetryData.metrics.tokensRemaining?.toLocaleString()}
                                                <span className="text-sm text-slate-500 font-mono font-normal tracking-normal ml-2">
                                                    / {telemetryData.metrics.dailyTokenBudget?.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Quota Reset</div>
                                            <div className="text-xs font-mono text-blue-400">{telemetryData.metrics.resetString}</div>
                                        </div>
                                    </div>

                                    {/* The Progress Bar */}
                                    <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-1000 ease-out relative"
                                            style={{ width: `${Math.max(0, Math.min(100, (telemetryData.metrics.tokensRemaining / telemetryData.metrics.dailyTokenBudget) * 100))}%` }}
                                        >
                                            {/* Shimmer effect */}
                                            <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {toastMessage && createPortal(
                <div className="fixed bottom-8 right-8 z-[9999] bg-slate-900 border-2 border-purple-500 text-purple-400 px-6 py-4 rounded-xl font-black font-mono text-xs uppercase shadow-[0_0_30px_rgba(168,85,247,0.3)] animate-in fade-in slide-in-from-bottom-8 duration-300">
                    {toastMessage}
                </div>,
                document.body
            )}
        </div>
    );
};

export default AdminSettings;