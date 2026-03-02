import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from "jspdf";

const InterviewSimulator = ({ job, onClose }) => {
    // --- STATE ---
    const [questions, setQuestions] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');

    // Loading & Safety States
    const [isGenerating, setIsGenerating] = useState(true);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [error, setError] = useState(null);
    const [showHistoryPrompt, setShowHistoryPrompt] = useState(false);

    // Results & HUD States
    const [evaluations, setEvaluations] = useState([]);
    const [timeLeft, setTimeLeft] = useState(120);
    const [isListening, setIsListening] = useState(false);
    const [ACESpeaking, setACESpeaking] = useState(false);
    const [isPromptCopied, setIsPromptCopied] = useState(false);

    // --- REFS ---
    const synthRef = useRef(window.speechSynthesis);
    const recognitionRef = useRef(null);
    const timerRef = useRef(null);

    // --- CLEANUP ---
    useEffect(() => {
        return () => {
            if (synthRef.current) synthRef.current.cancel();
            if (recognitionRef.current) recognitionRef.current.stop();
            clearInterval(timerRef.current);
        };
    }, []);

    // --- API CALLS & CORE LOGIC ---
    useEffect(() => {
        if (job.interviewHistoryJson && job.interviewHistoryJson.trim() !== '') {
            setShowHistoryPrompt(true);
            setIsGenerating(false);
        } else {
            generateQuestions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [job]);

    const generateQuestions = async () => {
        try {
            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/generate-interview-questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ JobDescription: job.jobDescription })
            });

            if (response.status === 429) {
                setCurrentStep(429);
                return;
            }

            if (!response.ok) throw new Error("Failed to generate questions.");

            const data = await response.json();
            setQuestions(data.questions);
            setCurrentStep(1);
        } catch (err) {
            console.error(err);
            setError("Failed to initialize the Interrogation Protocol.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleViewPastSession = () => {
        try {
            const parsedEvals = JSON.parse(job.interviewHistoryJson);
            setEvaluations(parsedEvals);
            setShowHistoryPrompt(false);
            setCurrentStep(99);
        } catch (e) {
            console.error("Failed to parse historical data", e);
            handleStartNewSession();
        }
    };

    const handleStartNewSession = () => {
        setShowHistoryPrompt(false);
        setIsGenerating(true);
        generateQuestions();
    };

    useEffect(() => {
        if (currentStep > 0 && currentStep <= questions.length) {
            if (evaluations.length < currentStep) {
                startQuestionProtocol(currentStep - 1);
            }
        }
    }, [currentStep, questions]);

    const startQuestionProtocol = (index) => {
        const qText = questions[index].question_text;
        setUserAnswer('');
        setTimeLeft(120);

        if (synthRef.current) {
            synthRef.current.cancel();
            const utterance = new SpeechSynthesisUtterance(qText);
            const voices = synthRef.current.getVoices();
            utterance.voice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Great Britain')) || voices[0];
            utterance.rate = 1.05;

            utterance.onstart = () => setACESpeaking(true);
            utterance.onend = () => {
                setACESpeaking(false);
                startTimer();
            };
            synthRef.current.speak(utterance);
        } else {
            startTimer();
        }
    };

    const startTimer = () => {
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    document.getElementById('submit-answer-btn')?.click();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const toggleMic = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support the Web Speech API. Please type your answer.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
            }
            if (finalTranscript) setUserAnswer(prev => prev + finalTranscript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
    };

    const handleEvaluateAnswer = async () => {
        const finalAnswer = userAnswer.trim() || "[Candidate failed to answer in time]";

        clearInterval(timerRef.current);
        if (synthRef.current) synthRef.current.cancel();
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
        setIsEvaluating(true);

        const currentQuestion = questions[currentStep - 1];

        try {
            const response = await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/evaluate-interview-answer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    JobDescription: job.jobDescription,
                    QuestionText: currentQuestion.question_text,
                    UserAnswer: finalAnswer
                })
            });

            if (response.status === 429) {
                setCurrentStep(429);
                return;
            }
            if (!response.ok) throw new Error("Failed to evaluate answer.");

            const result = await response.json();
            const enrichedResult = { ...result, question: currentQuestion.question_text, candidate_answer: finalAnswer };

            setEvaluations(prev => [...prev, enrichedResult]);
        } catch (err) {
            console.error(err);
            setError("ACE failed to evaluate the answer.");
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleNextQuestion = () => {
        if (currentStep < questions.length) {
            setCurrentStep(prev => prev + 1);
        } else {
            finishAndSaveSession();
        }
    };

    const finishAndSaveSession = async () => {
        setCurrentStep(99);
        try {
            await fetch("https://jarvis-ace-api-hbepfjgzhmguhchv.southindia-01.azurewebsites.net/api/JobStrategist/save-history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    JobId: job.id,
                    InterviewHistory: evaluations
                })
            });
            window.dispatchEvent(new Event('vaultUpdated'));
        } catch (e) {
            console.error("Failed to sync interview session to Vault", e);
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFont("times", "bold");
        doc.setFontSize(16);
        doc.text("ACE Technical Screen Report", 20, 20);

        const avgScore = Math.round(evaluations.reduce((acc, curr) => acc + curr.score, 0) / evaluations.length);
        doc.setFontSize(12);
        doc.text(`Company: ${job.companyName} | Final Score: ${avgScore}%`, 20, 30);

        let yPos = 45;
        doc.setFont("times", "normal");
        doc.setFontSize(10);

        evaluations.forEach((evalObj, i) => {
            if (yPos > 260) { doc.addPage(); yPos = 20; }

            doc.setFont("times", "bold");
            doc.text(`Q${i + 1}: ${doc.splitTextToSize(evalObj.question, 170)}`, 20, yPos);
            yPos += 10;

            doc.setFont("times", "normal");
            doc.text(`Your Answer: ${doc.splitTextToSize(evalObj.candidate_answer, 170)}`, 20, yPos);
            yPos += 15;

            doc.setTextColor(100, 100, 100);
            doc.text(`ACE Feedback (${evalObj.score}%): ${doc.splitTextToSize(evalObj.feedback, 170)}`, 20, yPos);
            yPos += 15;
            doc.setTextColor(0, 0, 0);
            yPos += 5;
        });

        doc.save(`ACE_Interview_${job.companyName.replace(/\s+/g, '_')}.pdf`);
    };

    const generateResourceLink = (platform, query) => {
        if (!platform || !query) return "#";
        const encodedQuery = encodeURIComponent(query);
        const p = platform.toLowerCase();

        if (p.includes('youtube')) return `https://www.youtube.com/results?search_query=${encodedQuery}`;
        if (p.includes('microsoft') || p.includes('learn')) return `https://learn.microsoft.com/en-us/search/?terms=${encodedQuery}`;
        if (p.includes('leetcode')) return `https://leetcode.com/problemset/all/?search=${encodedQuery}`;
        if (p.includes('geeksforgeeks') || p.includes('gfg')) return `https://www.geeksforgeeks.org/search/?q=${encodedQuery}`;
        return `https://www.google.com/search?q=site:${platform.replace(/\s+/g, '')}.com+${encodedQuery}`;
    };

    const handleJustCopy = () => {
        const prompt = `You are AI, an elite Principal Engineer conducting a rigorous technical job interview. I am applying for this role:\n${job.jobDescription}\n\nGenerate 10 highly specific, scenario-based technical questions cross-referencing my skills with this job. Do not ask behavioral questions. Give me one question at a time, wait for my answer, and then brutally grade it out of 100 before giving me the next question. Start with Question 1 now.`;
        navigator.clipboard.writeText(prompt);
        setIsPromptCopied(true);
        setTimeout(() => setIsPromptCopied(false), 2000);
    };

    const copyHandoffPrompt = () => {
        const prompt = `You are ACE, an elite Principal Engineer conducting a rigorous technical job interview. I am applying for this role:\n${job.jobDescription}\n\nGenerate 10 highly specific, scenario-based technical questions cross-referencing my skills with this job. Do not ask behavioral questions. Give me one question at a time, wait for my answer, and then brutally grade it out of 100 before giving me the next question. Start with Question 1 now.`;
        navigator.clipboard.writeText(prompt);
        window.open('https://gemini.google.com', '_blank');
    };

    // --- RENDER HELPERS (NOW USING PORTALS) ---

    // 1. HISTORY PROMPT VIEW
    if (showHistoryPrompt) {
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
                <div className="bg-white border border-white rounded-3xl p-10 max-w-lg w-full text-center shadow-[0_20px_50px_-10px_rgba(139,92,246,0.2)] animate-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 mx-auto bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <span className="text-4xl">🕰️</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest mb-4">Training Record Found</h2>
                    <p className="text-slate-600 font-serif leading-relaxed mb-8">
                        ACE has a previous mock interview session logged for this specific role. Would you like to review your past performance report, or initialize a new gauntlet?
                    </p>
                    <div className="flex flex-col gap-4">
                        <button onClick={handleViewPastSession} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest transition-all shadow-md hover:-translate-y-0.5">
                            📊 View Past Report
                        </button>
                        <button onClick={handleStartNewSession} className="w-full py-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold uppercase tracking-widest transition-all shadow-sm">
                            🔄 Start New Gauntlet
                        </button>
                        <button onClick={onClose} className="mt-2 text-slate-500 hover:text-rose-600 text-xs font-bold uppercase tracking-widest transition-colors">
                            Abort
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // 2. LOADING VIEW
    if (isGenerating) {
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md">
                <div className="flex flex-col items-center animate-pulse bg-white/90 px-16 py-12 rounded-[36px] shadow-2xl border border-white">
                    <span className="text-6xl mb-6">🧠</span>
                    <h2 className="text-2xl font-black tracking-widest uppercase text-violet-600">Initializing Interrogation Protocol</h2>
                    <p className="text-slate-500 mt-2 font-mono text-sm">Analyzing job requirements and formatting technical questions...</p>
                </div>
            </div>,
            document.body
        );
    }

    // 3. ERROR VIEW
    if (error) {
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
                <div className="bg-rose-50 border border-rose-200 p-8 rounded-2xl max-w-lg text-center w-full shadow-xl">
                    <h2 className="text-rose-600 font-bold text-xl uppercase mb-4">System Failure</h2>
                    <p className="text-slate-700 mb-6 font-serif">{error}</p>
                    <button onClick={onClose} className="px-6 py-3 font-bold uppercase tracking-widest bg-slate-800 text-white rounded hover:bg-slate-700 w-full transition-colors shadow-md">Exit Simulator</button>
                </div>
            </div>,
            document.body
        );
    }

    // 4. HANDOFF VIEW (RATE LIMIT)
    if (currentStep === 429) {
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
                <div className="text-center animate-in zoom-in-95 duration-500 max-w-2xl mx-auto py-10 bg-white p-10 rounded-3xl border border-amber-200 shadow-2xl">
                    <div className="w-20 h-20 mx-auto bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <span className="text-4xl">⚠️</span>
                    </div>
                    <h3 className="text-2xl font-black text-amber-600 uppercase tracking-widest mb-4">Rate Limit Reached</h3>
                    <p className="text-slate-600 font-serif leading-relaxed mb-8">
                        ACE local token reserves are depleted. To bypass this restriction and continue your technical screen, initiate the Gemini Handoff Protocol.
                    </p>

                    <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl text-left mb-8 shadow-inner relative group">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] text-amber-600 uppercase tracking-widest font-black block">Mega-Prompt Generated</span>
                            <button
                                onClick={handleJustCopy}
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-2 ${isPromptCopied ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-amber-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                {isPromptCopied ? '✅ COPIED' : '📋 COPY TEXT'}
                            </button>
                        </div>
                        <p className="text-slate-500 text-xs font-mono line-clamp-3 italic">"You are ACE, an elite Principal Engineer conducting a rigorous technical job interview. I am applying for this role..."</p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-4 font-bold uppercase tracking-widest text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all w-1/3 shadow-sm">Abort</button>
                        <button onClick={copyHandoffPrompt} className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-8 py-4 rounded-xl font-black uppercase tracking-widest flex-1 transition-all shadow-sm">
                            Open Gemini ↗
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // 5. FINISHED / REPORT VIEW
    if (currentStep === 99) {
        const averageScore = evaluations.length > 0 ? Math.round(evaluations.reduce((acc, curr) => acc + curr.score, 0) / evaluations.length) : 0;
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
                <div className="bg-white/95 border border-white rounded-3xl p-10 max-w-2xl w-full text-center shadow-[0_20px_50px_-10px_rgba(139,92,246,0.15)] animate-in fade-in zoom-in duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <h2 className="text-3xl font-black text-slate-800 uppercase tracking-widest mb-6">Simulation Complete</h2>
                    <div className="flex justify-center mb-8">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 bg-white shadow-inner ${averageScore >= 80 ? 'border-emerald-500 text-emerald-600' : averageScore >= 60 ? 'border-amber-400 text-amber-500' : 'border-rose-400 text-rose-500'}`}>
                            <span className="text-4xl font-black">{averageScore}%</span>
                        </div>
                    </div>
                    <p className="text-slate-600 mb-8 font-serif leading-relaxed">
                        {averageScore >= 80 ? "Outstanding performance. You are technically calibrated for this role." :
                            averageScore >= 60 ? "Acceptable, but noticeable gaps remain. Review the recommended resources before the actual interview." :
                                "Critical knowledge gaps detected. Do not interview until you have heavily reviewed the core concepts."}
                    </p>

                    <div className="space-y-6 text-left mb-8">
                        {evaluations.map((evalObj, idx) => (
                            <div key={idx} className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="text-slate-800 font-bold mb-2 flex justify-between items-start">
                                    <span className="text-sm">Q{idx + 1}: {evalObj.question}</span>
                                    <span className={`font-black ml-4 ${evalObj.score >= 80 ? 'text-emerald-600' : evalObj.score >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>{evalObj.score}%</span>
                                </h4>
                                <div className="text-slate-600 text-xs font-serif mb-3 p-3 bg-white border border-slate-100 rounded-lg shadow-inner">"{evalObj.candidate_answer}"</div>
                                <div className="text-violet-700 text-xs font-serif leading-relaxed italic border-l-2 border-violet-300 pl-3">{evalObj.feedback}</div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        <button onClick={handleExportPDF} className="w-1/2 py-4 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-xl font-bold uppercase tracking-widest transition-all shadow-sm">
                            📄 Export Takeouts
                        </button>
                        <button onClick={onClose} className="w-1/2 py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold uppercase tracking-widest transition-all shadow-md hover:-translate-y-0.5">
                            Return to Vault
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // 6. ACTIVE QUESTION VIEW
    const questionIndex = currentStep - 1;
    const currentQuestion = questions[questionIndex];
    const currentEvaluation = evaluations[questionIndex];

    if (!currentQuestion) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-white/90 border border-white rounded-[36px] w-full max-w-4xl shadow-[0_20px_50px_-10px_rgba(139,92,246,0.15)] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col max-h-[90vh]">

                <div className="p-6 border-b border-violet-100 flex justify-between items-center bg-slate-50/80 shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="bg-violet-100 text-violet-700 border border-violet-200 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest shadow-sm">
                            Question {currentStep} of {questions.length}
                        </span>
                        <span className="text-slate-500 text-sm font-mono">{currentQuestion.focus_area}</span>
                    </div>

                    {!currentEvaluation && (
                        <div className={`px-4 py-1.5 rounded-full border text-xs font-bold font-mono flex items-center gap-2 shadow-sm ${timeLeft < 30 ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' : 'bg-white border-slate-200 text-emerald-600'}`}>
                            <span>⏱️</span> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </div>
                    )}
                </div>

                <div className="p-8 md:p-10 overflow-y-auto custom-scrollbar relative flex-1">
                    {ACESpeaking && (
                        <div className="absolute top-8 right-8 flex gap-1 items-end h-6">
                            <div className="w-1 bg-violet-500 animate-[bounce_1s_infinite] h-full"></div>
                            <div className="w-1 bg-violet-500 animate-[bounce_1s_infinite_0.2s] h-2/3"></div>
                            <div className="w-1 bg-violet-500 animate-[bounce_1s_infinite_0.4s] h-full"></div>
                        </div>
                    )}

                    <h3 className="text-2xl font-medium text-slate-800 leading-relaxed mb-8 pr-10 font-serif">
                        {currentQuestion.question_text}
                    </h3>

                    {!currentEvaluation ? (
                        <div className="space-y-6">
                            <div className="relative">
                                <textarea
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    placeholder={ACESpeaking ? "Listen to ACE..." : "Type your technical answer here, or click the mic to speak..."}
                                    disabled={ACESpeaking}
                                    className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-5 text-slate-700 font-serif leading-relaxed focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-none transition-all disabled:opacity-50 shadow-inner"
                                />
                                <button
                                    onClick={toggleMic}
                                    disabled={ACESpeaking}
                                    className={`absolute bottom-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isListening ? 'bg-rose-50 border border-rose-200 text-rose-600 animate-pulse' : 'bg-white border border-slate-200 text-slate-500 hover:text-violet-600 hover:border-violet-200'} disabled:hidden`}
                                    title="Voice Dictation"
                                >
                                    🎤
                                </button>
                            </div>
                            <div className="flex justify-between items-center">
                                <button onClick={onClose} className="text-slate-500 hover:text-rose-600 text-xs uppercase tracking-widest font-bold transition-colors">Abort Session</button>
                                <button
                                    id="submit-answer-btn"
                                    onClick={handleEvaluateAnswer}
                                    disabled={(!userAnswer.trim() && timeLeft > 0) || isEvaluating || ACESpeaking}
                                    className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-md hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 disabled:hover:translate-y-0"
                                >
                                    {isEvaluating ? "ACE is Evaluating..." : "Submit Answer"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className={`p-6 rounded-2xl border shadow-sm flex items-start gap-6 ${currentEvaluation.score >= 80 ? 'bg-emerald-50 border-emerald-200' : currentEvaluation.score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                                <div className={`text-4xl font-black ${currentEvaluation.score >= 80 ? 'text-emerald-600' : currentEvaluation.score >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                                    {currentEvaluation.score}%
                                </div>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Technical Feedback</h4>
                                    <p className="text-slate-700 text-sm leading-relaxed font-serif">{currentEvaluation.feedback}</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-2">
                                    <span>💡</span> The Ideal Answer
                                </h4>
                                <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-emerald-800 text-sm font-serif italic border-l-4 border-l-emerald-400 shadow-inner">
                                    "{currentEvaluation.better_answer_example}"
                                </div>
                            </div>

                            {currentEvaluation.recommended_resources && currentEvaluation.recommended_resources.length > 0 && (
                                <div className="pt-6 border-t border-violet-100">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
                                        <span>📚</span> AI Recommended Study Materials
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currentEvaluation.recommended_resources.map((res, idx) => (
                                            <a
                                                key={idx}
                                                href={generateResourceLink(res.platform, res.search_query)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 p-4 rounded-xl flex items-center justify-between group transition-all shadow-sm"
                                            >
                                                <div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{res.platform}</div>
                                                    <div className="text-sm font-medium text-blue-700 group-hover:text-blue-800 transition-colors line-clamp-1">{res.topic}</div>
                                                </div>
                                                <span className="text-slate-400 group-hover:text-blue-600 transition-colors">↗</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleNextQuestion}
                                    className="bg-white hover:bg-slate-50 text-slate-700 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all border border-slate-200 shadow-sm hover:shadow-md"
                                >
                                    {currentStep < questions.length ? "Next Question ➡️" : "View Final Report 📊"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default InterviewSimulator;