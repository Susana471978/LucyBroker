import { useState, useRef, useCallback, useEffect } from "react";
import { executeVoiceActions } from "./voiceCommandRouter";

const API = `${process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000"}/api`;

export const STATES = {
    IDLE: "IDLE",
    LISTENING: "LISTENING",
    PROCESSING: "PROCESSING",
    SPEAKING: "SPEAKING",
    ERROR: "ERROR",
};

const WAKE_WORD_VARIANTS = [
    "hola lucy", "ola lucy", "hola luci",
    "oye lucy", "hey lucy", "lucy",
];

const STOP_COMMANDS = [
    "para", "stop", "detente", "salir", "exit",
    "terminar", "fin", "adiós", "adios", "hasta luego",
];

// ─── Global audio ref — para que cancel() pueda detener CUALQUIER audio ───
let _globalAudioElement = null;

export function setGlobalAudio(audio) {
    _globalAudioElement = audio;
}

export function stopGlobalAudio() {
    if (_globalAudioElement) {
        try { _globalAudioElement.pause(); _globalAudioElement.currentTime = 0; } catch (_) { }
        _globalAudioElement = null;
    }
    try { window.speechSynthesis.cancel(); } catch (_) { }
}

export function useVoiceEngine() {
    const [voiceState, setVoiceState] = useState(STATES.IDLE);
    const [transcript, setTranscript] = useState("");
    const [lastInteraction, setLastInteraction] = useState("");
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
    const [wakeWordActive, setWakeWordActive] = useState(false);
    const [handsFreeModeActive, setHandsFreeModeActive] = useState(false);

    const recognitionRef = useRef(null);
    const wakeRecognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const isRequestInFlight = useRef(false);
    const uiContextRef = useRef(null);
    const voiceStateRef = useRef(STATES.IDLE);
    const handsFreeModeRef = useRef(false);
    const ttsEnabledRef = useRef(true);
    const postSpeakGuardRef = useRef(false);
    const wakeWordCooldownRef = useRef(false);
    const audioCtxRef = useRef(null);

    useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
    useEffect(() => { handsFreeModeRef.current = handsFreeModeActive; }, [handsFreeModeActive]);
    useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

    const setUIContext = useCallback((context) => {
        uiContextRef.current = context;
    }, []);

    const clearSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    const startSilenceTimer = useCallback((callback, ms = 2500) => {
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(callback, ms);
    }, [clearSilenceTimer]);

    const getAudioCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    }, []);

    const playBeep = useCallback((freq = 880, duration = 0.15) => {
        try {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.13, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch (_) { }
    }, [getAudioCtx]);

    // ─── speak ────────────────────────────────────────────────────────
    const speak = useCallback(async (text, onEnd) => {
        if (!ttsEnabledRef.current || !text) {
            setVoiceState(STATES.IDLE);
            onEnd?.();
            return;
        }
        try {
            // Detener cualquier audio previo
            stopGlobalAudio();
            setVoiceState(STATES.SPEAKING);
            postSpeakGuardRef.current = true;

            const token = localStorage.getItem("auth_token");
            const response = await fetch(`${API}/tts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ text }),
            });
            if (!response.ok) throw new Error("TTS failed");
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            // Registrar audio globalmente para que cancel() pueda detenerlo
            setGlobalAudio(audio);

            audio.onended = () => {
                setGlobalAudio(null);
                URL.revokeObjectURL(audioUrl);
                setVoiceState(STATES.IDLE);
                setTimeout(() => {
                    postSpeakGuardRef.current = false;
                    onEnd?.();
                }, 2000);
            };
            audio.onerror = () => {
                setGlobalAudio(null);
                URL.revokeObjectURL(audioUrl);
                postSpeakGuardRef.current = false;
                setVoiceState(STATES.ERROR);
                onEnd?.();
            };
            await audio.play();
        } catch (error) {
            console.error("TTS failed:", error);
            postSpeakGuardRef.current = false;
            setVoiceState(STATES.IDLE);
            onEnd?.();
            // NO fallback a Web Speech API — voz diferente confunde al usuario
        }
    }, []);

    // ─── cancel — detiene TODO: audio, speech, recognition ────────────
    const cancel = useCallback(() => {
        clearSilenceTimer();
        handsFreeModeRef.current = false;
        postSpeakGuardRef.current = false;
        wakeWordCooldownRef.current = false;
        setHandsFreeModeActive(false);

        // Detener audio global (briefing, TTS, lo que sea)
        stopGlobalAudio();

        if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) { } }
        setTranscript("");
        setVoiceState(STATES.IDLE);
    }, [clearSilenceTimer]);

    // ─── Wrapper para setTtsEnabled que también detiene audio si se desactiva ──
    const setTtsEnabledWithStop = useCallback((value) => {
        const newValue = typeof value === 'function' ? value(ttsEnabledRef.current) : value;
        setTtsEnabled(newValue);
        if (!newValue) {
            // Si se desactiva TTS, detener audio inmediatamente
            stopGlobalAudio();
            setVoiceState(STATES.IDLE);
            postSpeakGuardRef.current = false;
        }
    }, []);

    // ─── sendToAssistant ──────────────────────────────────────────────
    const sendToAssistant = useCallback(async (text) => {
        if (!text?.trim() || isRequestInFlight.current) return null;
        isRequestInFlight.current = true;
        setVoiceState(STATES.PROCESSING);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`${API}/assistant`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ text }),
            });
            if (!response.ok) { setVoiceState(STATES.ERROR); return null; }
            const data = await response.json();
            const assistantText = data?.assistant_text || "";
            setLastInteraction(assistantText);
            setTranscript("");
            if (Array.isArray(data.actions) && data.actions.length > 0 && uiContextRef.current) {
                executeVoiceActions(data.actions, uiContextRef.current);
            }
            return assistantText;
        } catch (err) {
            console.error("Assistant error:", err);
            setVoiceState(STATES.ERROR);
            return null;
        } finally {
            isRequestInFlight.current = false;
        }
    }, []);

    // ─── listenForCommand ─────────────────────────────────────────────
    const listenForCommand = useCallback(() => {
        if (postSpeakGuardRef.current) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (_) { }
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "es-ES";
        recognitionRef.current = recognition;

        let finalTranscript = "";
        let hasReceivedSpeech = false;

        console.log("[Voice] Escuchando comando...");
        setVoiceState(STATES.LISTENING);

        recognition.onresult = (event) => {
            if (postSpeakGuardRef.current) return;

            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                if (r.isFinal) {
                    finalTranscript += r[0].transcript;
                    hasReceivedSpeech = true;
                } else {
                    interim += r[0].transcript;
                    hasReceivedSpeech = true;
                }
            }
            setTranscript(finalTranscript + interim);

            startSilenceTimer(async () => {
                const text = finalTranscript.trim();
                if (!text) {
                    if (handsFreeModeRef.current) {
                        listenForCommand();
                    } else {
                        setVoiceState(STATES.IDLE);
                    }
                    return;
                }

                console.log("[Voice] Comando capturado:", text);
                recognition.stop();

                const isStop = STOP_COMMANDS.some(c => text.toLowerCase().includes(c));
                if (isStop) {
                    handsFreeModeRef.current = false;
                    setHandsFreeModeActive(false);
                    speak("Hasta luego.");
                    return;
                }

                const assistantText = await sendToAssistant(text);

                if (assistantText) {
                    speak(assistantText, () => {
                        if (handsFreeModeRef.current) {
                            playBeep(660, 0.1);
                            listenForCommand();
                        }
                    });
                } else {
                    if (handsFreeModeRef.current) {
                        setTimeout(() => listenForCommand(), 500);
                    } else {
                        setVoiceState(STATES.IDLE);
                    }
                }
            }, 2500);
        };

        recognition.onerror = (e) => {
            console.log("[Voice] Recognition error:", e.error);
            if (e.error !== "no-speech" && e.error !== "aborted") {
                setVoiceState(STATES.ERROR);
            } else if (handsFreeModeRef.current) {
                setTimeout(() => listenForCommand(), 500);
            } else {
                setVoiceState(STATES.IDLE);
            }
        };

        recognition.onend = () => {
            if (!isRequestInFlight.current && voiceStateRef.current === STATES.LISTENING) {
                if (handsFreeModeRef.current && !hasReceivedSpeech) {
                    setTimeout(() => listenForCommand(), 300);
                } else if (!handsFreeModeRef.current) {
                    setVoiceState(STATES.IDLE);
                }
            }
        };

        try {
            recognition.start();
        } catch (e) {
            console.warn("[Voice] Failed to start command recognition:", e);
            setVoiceState(STATES.IDLE);
        }
    }, [startSilenceTimer, sendToAssistant, speak, playBeep]);

    const startListening = useCallback(() => {
        listenForCommand();
    }, [listenForCommand]);

    // ─── activateHandsFreeMode ────────────────────────────────────────
    const activateHandsFreeMode = useCallback(async (wakeText) => {
        if (handsFreeModeRef.current) return;

        handsFreeModeRef.current = true;
        setHandsFreeModeActive(true);

        getAudioCtx();
        playBeep(880, 0.15);

        const queryText = (typeof wakeText === "string" && wakeText.trim().length > 0)
            ? wakeText.trim()
            : "buenos días";

        console.log("[Voice] Manos libres activado. Query:", queryText);

        const responseText = await sendToAssistant(queryText);

        if (responseText) {
            speak(responseText, () => {
                if (handsFreeModeRef.current) {
                    playBeep(660, 0.1);
                    listenForCommand();
                }
            });
        } else {
            if (handsFreeModeRef.current) {
                listenForCommand();
            }
        }
    }, [sendToAssistant, speak, playBeep, listenForCommand, getAudioCtx]);

    // ─── startWakeWordListener ────────────────────────────────────────
    // Escucha "para" incluso mientras Lucy habla (SPEAKING state)
    const startWakeWordListener = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const wake = new SpeechRecognition();
        wake.continuous = true;
        wake.interimResults = true;
        wake.lang = "es-ES";
        wakeRecognitionRef.current = wake;

        wake.onresult = (event) => {
            if (wakeWordCooldownRef.current) return;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript.toLowerCase().trim();

                // ── Detectar "para" / "stop" INCLUSO durante SPEAKING ──
                if (voiceStateRef.current === STATES.SPEAKING) {
                    const isStop = STOP_COMMANDS.some(c => text.includes(c));
                    if (isStop) {
                        console.log("[Wake Word] STOP detectado durante habla:", text);
                        stopGlobalAudio();
                        setVoiceState(STATES.IDLE);
                        postSpeakGuardRef.current = false;
                        handsFreeModeRef.current = false;
                        setHandsFreeModeActive(false);
                        return;
                    }
                    // Si Lucy está hablando y no es "para", ignorar
                    continue;
                }

                // ── Solo procesar wake word si estamos IDLE ──
                if (voiceStateRef.current !== STATES.IDLE) continue;
                if (postSpeakGuardRef.current) continue;
                if (handsFreeModeRef.current) continue;

                if (WAKE_WORD_VARIANTS.some(v => text.includes(v))) {
                    console.log("[Wake Word] Detectado:", text);

                    wakeWordCooldownRef.current = true;
                    setTimeout(() => { wakeWordCooldownRef.current = false; }, 8000);

                    setWakeWordActive(true);
                    setTimeout(() => setWakeWordActive(false), 3000);

                    wake.onend = null;
                    try { wake.stop(); } catch (_) { }
                    wakeRecognitionRef.current = null;

                    const cleanText = text
                        .replace(/hola lucy/gi, "")
                        .replace(/ola lucy/gi, "")
                        .replace(/oye lucy/gi, "")
                        .replace(/hey lucy/gi, "")
                        .replace(/^lucy/gi, "")
                        .trim();

                    if (event.results[i].isFinal && cleanText.length > 5) {
                        console.log("[Wake Word] Comando completo:", cleanText);
                        playBeep(880, 0.15);
                        setTimeout(() => activateHandsFreeMode(cleanText), 300);
                    } else {
                        console.log("[Wake Word] Esperando comando...");
                        playBeep(880, 0.15);

                        setTimeout(() => {
                            if (handsFreeModeRef.current) return;
                            handsFreeModeRef.current = true;
                            setHandsFreeModeActive(true);
                            getAudioCtx();
                            console.log("[Voice] Esperando orden del usuario...");
                            listenForCommand();
                        }, 500);
                    }
                    break;
                }
            }
        };

        wake.onend = () => {
            if (wakeWordEnabled && !handsFreeModeRef.current && document.visibilityState === "visible") {
                setTimeout(() => {
                    try {
                        if (wakeRecognitionRef.current === wake) {
                            wake.start();
                        }
                    } catch (_) { }
                }, 300);
            }
        };

        wake.onerror = (e) => {
            if (e.error !== "no-speech" && e.error !== "aborted") {
                console.warn("[Wake Word] Error:", e.error);
            }
        };

        try { wake.start(); } catch (_) { }
    }, [wakeWordEnabled, activateHandsFreeMode, playBeep, listenForCommand, getAudioCtx]);

    const stopWakeWordListener = useCallback(() => {
        if (wakeRecognitionRef.current) {
            try {
                wakeRecognitionRef.current.onend = null;
                wakeRecognitionRef.current.stop();
            } catch (_) { }
            wakeRecognitionRef.current = null;
        }
    }, []);

    // ─── Wake word lifecycle ──────────────────────────────────────────
    useEffect(() => {
        if (wakeWordEnabled && !handsFreeModeActive) {
            const timer = setTimeout(() => startWakeWordListener(), 1000);
            return () => { clearTimeout(timer); stopWakeWordListener(); };
        } else if (!wakeWordEnabled) {
            stopWakeWordListener();
        }
    }, [wakeWordEnabled, handsFreeModeActive, startWakeWordListener, stopWakeWordListener]);

    useEffect(() => {
        if (!handsFreeModeActive && wakeWordEnabled) {
            const timer = setTimeout(() => {
                if (!wakeRecognitionRef.current) {
                    startWakeWordListener();
                }
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [handsFreeModeActive, wakeWordEnabled, startWakeWordListener]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "visible" && wakeWordEnabled && !handsFreeModeRef.current) {
                startWakeWordListener();
            } else {
                stopWakeWordListener();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [wakeWordEnabled, startWakeWordListener, stopWakeWordListener]);

    useEffect(() => {
        const initAudio = () => {
            getAudioCtx();
            document.removeEventListener("click", initAudio);
            document.removeEventListener("touchstart", initAudio);
        };
        document.addEventListener("click", initAudio);
        document.addEventListener("touchstart", initAudio);
        return () => {
            document.removeEventListener("click", initAudio);
            document.removeEventListener("touchstart", initAudio);
        };
    }, [getAudioCtx]);

    return {
        voiceState,
        transcript,
        lastInteraction,
        ttsEnabled,
        setTtsEnabled: setTtsEnabledWithStop,
        wakeWordEnabled,
        setWakeWordEnabled,
        wakeWordActive,
        handsFreeModeActive,
        activateHandsFreeMode,
        startListening,
        cancel,
        setUIContext,
        speak,
        STATES,
    };
}