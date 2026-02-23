import React, { useState, useEffect } from 'react';

const InterviewSimulator = ({ jobDescription, onClose }) => {
    // --- STATE ---
    const [questions, setQuestions] = useState([]);
    const [currentStep, setCurrentStep] = useState(0); // 0 = Loading, 1...N = Questions, 99 = Finished
    const [userAnswer, setUserAnswer] = useState('');

    // Loading States
    const [isGenerating, setIsGenerating] = useState(true);
    const [isEvaluating, setIsEvaluating] = useState(false);

    // Results State
    const [evaluations, setEvaluations] = useState([]); // Stores the feedback for each question
    const [error, setError] = useState(null);

    // --- API CALLS ---
    useEffect(() => {
        const generateQuestions = async () => {
            try {
                const response = await fetch("https://localhost:7155/api/JobStrategist/generate-interview-questions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ JobDescription: jobDescription })
                });

                if (!response.ok) throw new Error("Failed to generate questions.");

                const data = await response.json();
                setQuestions(data.questions);
                setCurrentStep(1); // Move to the first question
            } catch (err) {
                console.error(err);
                setError("Failed to initialize the Interrogation Protocol.");
            } finally {
                setIsGenerating(false);
            }
        };

        generateQuestions();
    }, [jobDescription]);

    const handleEvaluateAnswer = async () => {
        if (!userAnswer.trim()) return;
        setIsEvaluating(true);

        const currentQuestion = questions[currentStep - 1];

        try {
            const response = await fetch("https://localhost:7155/api/JobStrategist/evaluate-interview-answer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    JobDescription: jobDescription,
                    QuestionText: currentQuestion.question_text,
                    UserAnswer: userAnswer
                })
            });

            if (!response.ok) throw new Error("Failed to evaluate answer.");

            const result = await response.json();

            // Save the evaluation
            setEvaluations(prev => [...prev, result]);
        } catch (err) {
            console.error(err);
            setError("Jarvis failed to evaluate the answer.");
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleNextQuestion = () => {
        if (currentStep < questions.length) {
            setCurrentStep(prev => prev + 1);
            setUserAnswer(''); // Clear the text box for the next question
        } else {
            setCurrentStep(99); // Finished
        }
    };

    // --- DYNAMIC RESOURCE ROUTER ---
    const generateResourceLink = (platform, query) => {
        if (!platform || !query) return "#";
        const encodedQuery = encodeURIComponent(query);
        const p = platform.toLowerCase();

        if (p.includes('youtube')) return `https://www.youtube.com/results?search_query=${encodedQuery}`;
        if (p.includes('microsoft') || p.includes('learn')) return `https://learn.microsoft.com/en-us/search/?terms=${encodedQuery}`;
        if (p.includes('leetcode')) return `https://leetcode.com/problemset/all/?search=${encodedQuery}`;
        if (p.includes('geeksforgeeks') || p.includes('gfg')) return `https://www.geeksforgeeks.org/search/?q=${encodedQuery}`;

        // Ultimate Fallback: Google Site Search
        return `https://www.google.com/search?q=site:${platform.replace(/\s+/g, '')}.com+${encodedQuery}`;
    };

    // --- RENDER HELPERS ---
    if (isGenerating) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl">
                <div className="flex flex-col items-center animate-pulse">
                    <span className="text-6xl mb-6">🧠</span>
                    <h2 className="text-2xl font-black tracking-widest uppercase text-purple-400">Initializing Interrogation Protocol</h2>
                    <p className="text-slate-400 mt-2 font-mono text-sm">Analyzing job requirements and formatting technical questions...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl">
                <div className="bg-red-950/30 border border-red-500/50 p-8 rounded-2xl max-w-lg text-center">
                    <h2 className="text-red-400 font-bold text-xl uppercase mb-4">System Failure</h2>
                    <p className="text-slate-300 mb-6">{error}</p>
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded hover:bg-slate-700">Exit Simulator</button>
                </div>
            </div>
        );
    }

    // FINISHED VIEW
    if (currentStep === 99) {
        const averageScore = Math.round(evaluations.reduce((acc, curr) => acc + curr.score, 0) / evaluations.length);
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl p-10 max-w-2xl w-full text-center shadow-2xl animate-in fade-in zoom-in duration-500">
                    <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-6">Simulation Complete</h2>
                    <div className="flex justify-center mb-8">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 ${averageScore >= 80 ? 'border-emerald-500 text-emerald-400' : averageScore >= 60 ? 'border-yellow-500 text-yellow-400' : 'border-pink-500 text-pink-500'}`}>
                            <span className="text-4xl font-black">{averageScore}%</span>
                        </div>
                    </div>
                    <p className="text-slate-300 mb-8 font-serif leading-relaxed">
                        {averageScore >= 80 ? "Outstanding performance. You are technically calibrated for this role." :
                            averageScore >= 60 ? "Acceptable, but noticeable gaps remain. Review the recommended resources before the actual interview." :
                                "Critical knowledge gaps detected. Do not interview until you have heavily reviewed the core concepts."}
                    </p>
                    <button onClick={onClose} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold uppercase tracking-widest transition-all">
                        Return to Vault
                    </button>
                </div>
            </div>
        );
    }

    // ACTIVE QUESTION VIEW
    const questionIndex = currentStep - 1;
    const currentQuestion = questions[questionIndex];
    const currentEvaluation = evaluations[questionIndex]; // Will be undefined until answered

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl p-4 overflow-y-auto">
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-[24px] w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">
                            Question {currentStep} of {questions.length}
                        </span>
                        <span className="text-slate-400 text-sm font-mono">{currentQuestion.focus_area}</span>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-red-400 text-xl transition-colors">✕</button>
                </div>

                {/* Scrollable Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <h3 className="text-2xl font-medium text-white leading-relaxed mb-8">
                        {currentQuestion.question_text}
                    </h3>

                    {!currentEvaluation ? (
                        <div className="space-y-6">
                            <textarea
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                placeholder="Type your technical answer here. Be as specific and detailed as possible..."
                                className="w-full h-48 bg-slate-950 border border-slate-700 rounded-xl p-5 text-slate-300 font-serif leading-relaxed focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none transition-all"
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={handleEvaluateAnswer}
                                    disabled={!userAnswer.trim() || isEvaluating}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isEvaluating ? "Jarvis is Evaluating..." : "Submit Answer"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                            {/* Grading Header */}
                            <div className={`p-6 rounded-2xl border ${currentEvaluation.score >= 80 ? 'bg-emerald-950/20 border-emerald-500/30' : currentEvaluation.score >= 60 ? 'bg-yellow-950/20 border-yellow-500/30' : 'bg-pink-950/20 border-pink-500/30'} flex items-start gap-6`}>
                                <div className={`text-4xl font-black ${currentEvaluation.score >= 80 ? 'text-emerald-400' : currentEvaluation.score >= 60 ? 'text-yellow-400' : 'text-pink-500'}`}>
                                    {currentEvaluation.score}%
                                </div>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Technical Feedback</h4>
                                    <p className="text-slate-300 text-sm leading-relaxed font-serif">{currentEvaluation.feedback}</p>
                                </div>
                            </div>

                            {/* Better Answer Example */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
                                    <span>💡</span> The Ideal Answer
                                </h4>
                                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl text-emerald-100/70 text-sm font-serif italic border-l-2 border-l-emerald-500/50">
                                    "{currentEvaluation.better_answer_example}"
                                </div>
                            </div>

                            {/* Dynamic AI Study Materials */}
                            {currentEvaluation.recommended_resources && currentEvaluation.recommended_resources.length > 0 && (
                                <div className="pt-6 border-t border-slate-800">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
                                        <span>📚</span> AI Recommended Study Materials
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currentEvaluation.recommended_resources.map((res, idx) => (
                                            <a
                                                key={idx}
                                                href={generateResourceLink(res.platform, res.search_query)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 p-4 rounded-xl flex items-center justify-between group transition-all"
                                            >
                                                <div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{res.platform}</div>
                                                    <div className="text-sm font-medium text-blue-300 group-hover:text-blue-400 transition-colors line-clamp-1">{res.topic}</div>
                                                </div>
                                                <span className="text-slate-600 group-hover:text-blue-400 transition-colors">↗</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Next Action */}
                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleNextQuestion}
                                    className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all border border-slate-700 hover:border-slate-500"
                                >
                                    {currentStep < questions.length ? "Next Question ➡️" : "View Final Report 📊"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InterviewSimulator;