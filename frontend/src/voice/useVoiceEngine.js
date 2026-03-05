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

    const startSilenceTimer = useCallback((callback) => {
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(callback, 1500);
    }, [clearSilenceTimer]);

    const playBeep = useCallback((freq = 880, duration = 0.15) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch (_) { }
    }, []);

    const speak = useCallback(async (text, onEnd) => {
        if (!ttsEnabledRef.current || !text) {
            setVoiceState(STATES.IDLE);
            onEnd?.();
            return;
        }
        try {
            window.speechSynthesis.cancel();
            setVoiceState(STATES.SPEAKING);
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
            audio.onended = () => { setVoiceState(STATES.IDLE); onEnd?.(); };
            audio.onerror = () => { setVoiceState(STATES.ERROR); onEnd?.(); };
            await audio.play();
        } catch (error) {
            console.error("Neural TTS failed, fallback:", error);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "es-ES";
            utterance.rate = 0.95;
            utterance.onend = () => { setVoiceState(STATES.IDLE); onEnd?.(); };
            window.speechSynthesis.speak(utterance);
        }
    }, []);

    const cancel = useCallback(() => {
        clearSilenceTimer();
        handsFreeModeRef.current = false;
        setHandsFreeModeActive(false);
        if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) { } }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setTranscript("");
        setVoiceState(STATES.IDLE);
    }, [clearSilenceTimer]);

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

    const startListeningLoop = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition || voiceStateRef.current !== STATES.IDLE) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "es-ES";
        recognitionRef.current = recognition;

        let finalTranscript = "";

        recognition.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                if (r.isFinal) finalTranscript += r[0].transcript;
                else interim += r[0].transcript;
            }
            setTranscript(finalTranscript + interim);

            startSilenceTimer(async () => {
                const text = finalTranscript.trim();
                if (!text) return;
                recognition.stop();

                const isStop = STOP_COMMANDS.some(c => text.toLowerCase().includes(c));
                if (isStop) {
                    handsFreeModeRef.current = false;
                    setHandsFreeModeActive(false);
                    speak("Hasta luego. Modo manos libres desactivado.");
                    return;
                }

                const assistantText = await sendToAssistant(text);

                if (assistantText) {
                    if (handsFreeModeRef.current) {
                        speak(assistantText, () => {
                            setTimeout(() => {
                                if (handsFreeModeRef.current) {
                                    playBeep(660, 0.1);
                                    startListeningLoop();
                                }
                            }, 400);
                        });
                    } else {
                        speak(assistantText);
                    }
                } else {
                    if (handsFreeModeRef.current) setTimeout(() => startListeningLoop(), 500);
                    else setVoiceState(STATES.IDLE);
                }
            });
        };

        recognition.onerror = (e) => {
            if (e.error !== "no-speech" && e.error !== "aborted") setVoiceState(STATES.ERROR);
            else if (handsFreeModeRef.current) setTimeout(() => startListeningLoop(), 500);
            else setVoiceState(STATES.IDLE);
        };

        recognition.onend = () => {
            if (!isRequestInFlight.current && voiceStateRef.current === STATES.LISTENING) {
                setVoiceState(STATES.IDLE);
            }
        };

        recognition.start();
        setVoiceState(STATES.LISTENING);
    }, [startSilenceTimer, sendToAssistant, speak, playBeep]);

    const startListening = useCallback(() => {
        startListeningLoop();
    }, [startListeningLoop]);

    const activateHandsFreeMode = useCallback(async () => {
        handsFreeModeRef.current = true;
        setHandsFreeModeActive(true);
        playBeep(880, 0.15);

        const briefingText = await sendToAssistant("dame un resumen rápido de mi bandeja");

        if (briefingText) {
            speak(briefingText, () => {
                setTimeout(() => {
                    if (handsFreeModeRef.current) {
                        playBeep(660, 0.1);
                        startListeningLoop();
                    }
                }, 400);
            });
        } else {
            startListeningLoop();
        }
    }, [sendToAssistant, speak, playBeep, startListeningLoop]);

    const startWakeWordListener = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const wake = new SpeechRecognition();
        wake.continuous = true;
        wake.interimResults = true;
        wake.lang = "es-ES";
        wakeRecognitionRef.current = wake;

        wake.onresult = (event) => {
            if (voiceStateRef.current !== STATES.IDLE) return;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript.toLowerCase().trim();
                if (WAKE_WORD_VARIANTS.some(v => text.includes(v))) {
                    console.log("[Wake Word] Detectado:", text);
                    setWakeWordActive(true);
                    setTimeout(() => setWakeWordActive(false), 2000);
                    playBeep(880, 0.15);
                    setTimeout(() => activateHandsFreeMode(), 300);
                    break;
                }
            }
        };

        wake.onend = () => {
            if (wakeWordEnabled && document.visibilityState === "visible") {
                try { wake.start(); } catch (_) { }
            }
        };

        wake.onerror = (e) => {
            if (e.error !== "no-speech" && e.error !== "aborted") {
                console.warn("[Wake Word] Error:", e.error);
            }
        };

        try { wake.start(); } catch (_) { }
    }, [wakeWordEnabled, activateHandsFreeMode, playBeep]);

    const stopWakeWordListener = useCallback(() => {
        if (wakeRecognitionRef.current) {
            try { wakeRecognitionRef.current.onend = null; wakeRecognitionRef.current.stop(); } catch (_) { }
            wakeRecognitionRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (wakeWordEnabled) {
            const timer = setTimeout(() => startWakeWordListener(), 1000);
            return () => { clearTimeout(timer); stopWakeWordListener(); };
        } else {
            stopWakeWordListener();
        }
    }, [wakeWordEnabled, startWakeWordListener, stopWakeWordListener]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === "visible" && wakeWordEnabled) startWakeWordListener();
            else stopWakeWordListener();
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [wakeWordEnabled, startWakeWordListener, stopWakeWordListener]);

    return {
        voiceState,
        transcript,
        lastInteraction,
        ttsEnabled,
        setTtsEnabled,
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