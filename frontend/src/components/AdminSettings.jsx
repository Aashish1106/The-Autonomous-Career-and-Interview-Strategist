import React, { useState, useRef } from 'react';

const AdminSettings = () => {
    const initialFormState = {
        fullName: 'Aashish Kumar',
        profileSummary: '',
        coreSkills: '',
        workExperience: [],
        education: [],
        projects: [],
        certifications: ''
    };

    const [resumeData, setResumeData] = useState(initialFormState);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const fileInputRef = useRef(null);

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 4000);
    };

    // ---> DYNAMIC ENTRY SPAWNERS <---
    const addExperience = () => {
        setResumeData(prev => ({
            ...prev,
            workExperience: [...prev.workExperience, { company: '', role: '', duration: '', bullets: [''] }]
        }));
    };

    const addProject = () => {
        setResumeData(prev => ({
            ...prev,
            projects: [...prev.projects, { name: '', technologies: '', description: '' }]
        }));
    };

    const addEducation = () => {
        setResumeData(prev => ({
            ...prev,
            education: [...prev.education, { institution: '', degree: '', duration: '' }]
        }));
    };

    // ---> DYNAMIC FIELD UPDATERS <---
    const updateCollection = (collection, index, field, value) => {
        const updated = [...resumeData[collection]];
        updated[index][field] = value;
        setResumeData(prev => ({ ...prev, [collection]: updated }));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("https://localhost:7155/api/JobStrategist/parse-pdf", {
                method: "POST",
                body: formData
            });
            const aiData = await response.json();
            setResumeData({
                fullName: 'Aashish Kumar',
                profileSummary: aiData.profileSummary || '',
                coreSkills: aiData.coreSkills ? aiData.coreSkills.join(', ') : '',
                workExperience: aiData.workExperience || [],
                education: aiData.education || [],
                projects: aiData.projects || [],
                certifications: aiData.certifications ? aiData.certifications.join(', ') : ''
            });
            showToast("✅ PDF Extracted Successfully");
        } catch (error) {
            console.error("PDF Extraction failed:", error);
            showToast("🚨 PDF Extraction Failed");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const payload = {
            fullName: resumeData.fullName,
            baseResumeText: JSON.stringify(resumeData),
            coreSkills: resumeData.coreSkills.split(',').map(s => s.trim()),
            structuredResumeJson: resumeData
        };

        try {
            await fetch("https://localhost:7155/api/JobStrategist/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            showToast("🔐 Vault Updated");
        } catch (error) {
            console.error("Database sync failed:", error);
            showToast("🚨 Database Sync Failed");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <style>
                {`
                    @keyframes hammerStrike { 0%, 100% { transform: rotate(30deg); } 15% { transform: rotate(-50deg); } 25% { transform: rotate(30deg); } }
                    @keyframes nutShake { 0%, 100% { transform: translate(0, 0); } 15% { transform: translate(-4px, 2px) rotate(-5deg); } 18% { transform: translate(4px, -2px) rotate(5deg); } 25% { transform: translate(0, 0); } }
                `}
            </style>

            <div className="bg-slate-900/50 backdrop-blur-xl rounded-[22px] p-8 border border-slate-800 shadow-2xl">
                <h2 className="text-3xl font-black text-white uppercase tracking-wider mb-8 border-b border-slate-800 pb-4 flex items-center gap-4">
                    <span className="text-purple-500">🛡️</span> ATS Ingestion
                </h2>

                {/* DROPZONE */}
                <div onClick={() => fileInputRef.current.click()} className="mb-10 border-2 border-dashed border-slate-700 rounded-2xl p-12 text-center hover:bg-slate-800/50 cursor-pointer transition-all group">
                    <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
                    {isUploading ? (
                        <div className="flex flex-col items-center">
                            <div className="relative w-32 h-24 mb-4">
                                <div className="absolute text-6xl" style={{ animation: 'nutShake 2s infinite' }}>🌰</div>
                                <div className="absolute text-7xl origin-bottom-right translate-x-8" style={{ animation: 'hammerStrike 2s infinite' }}>🔨</div>
                            </div>
                            <h3 className="text-purple-400 font-black animate-pulse uppercase tracking-widest">Jarvis is cracking the PDF...</h3>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-5xl group-hover:-translate-y-2 transition-transform duration-300">📄</div>
                            <div className="text-slate-300 font-bold">Click or Drag PDF to Auto-Fill</div>
                            <p className="text-slate-500 text-xs">Supports automated extraction for all categories.</p>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-12">

                    {/* CORE SUMMARY & METADATA */}
                    <div className="space-y-6 p-6 bg-slate-950/40 rounded-2xl border border-slate-800/60 shadow-inner">
                        <div>
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest block mb-2">🎯 Profile Summary</label>
                            <textarea value={resumeData.profileSummary} onChange={(e) => setResumeData({ ...resumeData, profileSummary: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 outline-none focus:border-purple-500" rows="3" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-2">💻 Core Skills</label>
                                <textarea value={resumeData.coreSkills} onChange={(e) => setResumeData({ ...resumeData, coreSkills: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 outline-none focus:border-emerald-500" rows="3" placeholder="e.g. .NET Core, React, Azure..." />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">📜 Certifications</label>
                                <textarea value={resumeData.certifications} onChange={(e) => setResumeData({ ...resumeData, certifications: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 outline-none focus:border-blue-500" rows="3" placeholder="e.g. AZ-400, AI-102..." />
                            </div>
                        </div>
                    </div>

                    {/* PROFESSIONAL ARSENAL (Experience) */}
                    <div>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Professional Arsenal</label>
                            <button type="button" onClick={addExperience} className="text-[10px] bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full border border-purple-500/20 hover:bg-purple-500/30 transition-all">+ Add Experience</button>
                        </div>
                        <div className="space-y-4">
                            {resumeData.workExperience.map((job, idx) => (
                                <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input placeholder="Role (e.g. Senior Systems Engineer)" value={job.role} onChange={(e) => updateCollection('workExperience', idx, 'role', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" />
                                        <input placeholder="Company (e.g. Infosys)" value={job.company} onChange={(e) => updateCollection('workExperience', idx, 'company', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-purple-400" />
                                    </div>
                                    <textarea placeholder="Bullet points (comma separated)" value={job.bullets?.join(', ')} onChange={(e) => updateCollection('workExperience', idx, 'bullets', e.target.value.split(','))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-400" rows="2" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* STRATEGIC PROJECTS */}
                    <div>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strategic Projects</label>
                            <button type="button" onClick={addProject} className="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 hover:bg-blue-500/30 transition-all">+ Add Project</button>
                        </div>
                        <div className="space-y-4">
                            {resumeData.projects.map((proj, idx) => (
                                <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
                                    <input placeholder="Project Name (e.g. Jarvis AI)" value={proj.name} onChange={(e) => updateCollection('projects', idx, 'name', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" />
                                    <input placeholder="Stack (e.g. React, .NET Core)" value={proj.technologies} onChange={(e) => updateCollection('projects', idx, 'technologies', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-blue-400" />
                                    <textarea placeholder="Description" value={proj.description} onChange={(e) => updateCollection('projects', idx, 'description', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-400" rows="2" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ACADEMIC ARSENAL (Education) */}
                    <div>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Arsenal</label>
                            <button type="button" onClick={addEducation} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 hover:bg-emerald-500/30 transition-all">+ Add Education</button>
                        </div>
                        <div className="space-y-4">
                            {resumeData.education.map((edu, idx) => (
                                <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input placeholder="Institution (e.g. IGIT Sarang)" value={edu.institution} onChange={(e) => updateCollection('education', idx, 'institution', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" />
                                        <input placeholder="Degree (e.g. B.Tech)" value={edu.degree} onChange={(e) => updateCollection('education', idx, 'degree', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-emerald-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* FINAL ACTION BAR */}
                    <div className="pt-8 flex justify-between items-center border-t border-slate-800">
                        <button type="button" onClick={() => setResumeData(initialFormState)} className="text-slate-500 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors">🗑️ Reset Form</button>
                        <button type="submit" disabled={isSaving || isUploading} className="bg-purple-600 hover:bg-purple-500 text-white px-12 py-4 rounded-xl font-black uppercase text-xs shadow-xl transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50">
                            {isSaving ? "Syncing Identity..." : "Save to Vault"}
                        </button>
                    </div>
                </form>
            </div>
            {toastMessage && <div className="fixed bottom-8 right-8 bg-slate-950 border border-purple-500/50 text-purple-400 px-6 py-4 rounded-xl font-mono text-[10px] uppercase shadow-2xl animate-in slide-in-from-bottom-8">{toastMessage}</div>}
        </div>
    );
};

export default AdminSettings;