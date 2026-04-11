import { useState, useRef, useCallback, useEffect } from "react";
import { executeVoiceActions } from "./voiceCommandRouter";
import apiClient from "../services/apiClient";

/**
 * useVoiceEngine v4.1 — Conversational mode
 *
 * Flow after wake word:
 *   1. "Hola Lucy" → beep → command listener
 *   2. Command captured → process → Lucy speaks response
 *   3. Lucy says "¿Algo más?" → listens 10 seconds
 *   4. User says something → process → Lucy responds → "¿Algo más?" → loop
 *   5. 10 seconds silence OR user says "gracias/no/hasta luego" → back to wake listener
 *
 * Briefing flow:
 *   1. "Hola Lucy, buenos días" → instant "Dame un momento para ponerme al día..."
 *   2. Full briefing loads in background
 *   3. Lucy speaks full briefing → "¿Algo más?"
 *
 * Manos libres:
 *   - Activa escucha continua sin wake word
 *   - Al terminar conversación/timeout vuelve a startCommandListener (no wake)
 *   - Solo sale del modo con goodbye words
 */

export const STATES = {
    IDLE: "IDLE",
    LISTENING: "LISTENING",
    PROCESSING: "PROCESSING",
    SPEAKING: "SPEAKING",
    ERROR: "ERROR",
};

const WAKE_WORDS = [
    "hola lucy",
    "ola lucy",
    "hola luci",
    "oye lucy",
    "hey lucy",
    "buenos días lucy",
    "buenas lucy",
    "buenas luci"
];
const STOP_WORDS = ["lucy para", "lucy stop", "detente lucy", "detente", "stop", "para lucy", "cállate", "silencio"];
const GOODBYE_WORDS = [
    "no gracias", "no nada", "nada más", "nada mas", "eso es todo",
    "hasta luego", "adiós", "adios", "gracias lucy", "no lucy",
    "no nada más", "no nada mas", "ya está", "ya esta",
];
const BRIEFING_TRIGGERS = [
    "briefing", "qué tengo hoy", "que tengo hoy",
    "resumen del día", "resumen del dia", "resumen matutino",
    "ponme al día", "ponme al dia", "cuéntame el día", "cuentame el dia",
];

const BRIEFING_THINKING_PHRASES = [
    "Dame un momento para ponerme al día...",
    "Un segundo, estoy preparando tu briefing...",
    "Déjame revisar todo, un momento...",
];

// ─── Global audio with change notification ───
let _globalAudio = null;
let _audioChangeListeners = [];

export function setGlobalAudio(audio) {
    _globalAudio = audio;
    _audioChangeListeners.forEach(fn => fn(audio));
}

export function getGlobalAudio() {
    return _globalAudio;
}

export function onGlobalAudioChange(fn) {
    _audioChangeListeners.push(fn);
    return () => {
        _audioChangeListeners = _audioChangeListeners.filter(f => f !== fn);
    };
}

export function stopGlobalAudio() {
    if (_globalAudio) {
        const audioEl = (_globalAudio?.audio instanceof HTMLMediaElement)
            ? _globalAudio.audio
            : _globalAudio;
        try { audioEl.pause(); audioEl.currentTime = 0; } catch (_) { }
    }
    setGlobalAudio(null);
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

    const stateRef = useRef(STATES.IDLE);
    const ttsRef = useRef(true);
    const handsFreeRef = useRef(false);
    const wakeEnabledRef = useRef(true);
    const busyRef = useRef(false);
    const audioCtxRef = useRef(null);
    const activeRecRef = useRef(null);
    const uiContextRef = useRef(null);
    const conversationActiveRef = useRef(false);

    useEffect(() => { stateRef.current = voiceState; }, [voiceState]);
    useEffect(() => { ttsRef.current = ttsEnabled; }, [ttsEnabled]);
    useEffect(() => { handsFreeRef.current = handsFreeModeActive; }, [handsFreeModeActive]);
    useEffect(() => { wakeEnabledRef.current = wakeWordEnabled; }, [wakeWordEnabled]);

    const setUIContext = useCallback((ctx) => { uiContextRef.current = { ...uiContextRef.current, ...ctx }; }, []);

    // ─── Audio context ─────────────────────────────────────────────
    const getAudioCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
        return audioCtxRef.current;
    }, []);

    // ─── Unlock audio on first user interaction ────────────────────
    useEffect(() => {
        const unlock = () => {
            try {
                const ctx = getAudioCtx();
                if (ctx.state === "suspended") ctx.resume();
                const b = ctx.createBuffer(1, 1, 22050);
                const s = ctx.createBufferSource();
                s.buffer = b; s.connect(ctx.destination); s.start();
            } catch (_) { }
            document.removeEventListener("click", unlock);
            document.removeEventListener("touchstart", unlock);
        };
        document.addEventListener("click", unlock, { once: true });
        document.addEventListener("touchstart", unlock, { once: true });
        return () => {
            document.removeEventListener("click", unlock);
            document.removeEventListener("touchstart", unlock);
        };
    }, [getAudioCtx]);

    const playBeep = useCallback((freq = 880, dur = 0.12) => {
        try {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
        } catch (_) { }
    }, [getAudioCtx]);

    // ─── Kill recognition ──────────────────────────────────────────
    const killRecognition = useCallback(() => {
        if (activeRecRef.current) {
            const rec = activeRecRef.current;
            activeRecRef.current = null;
            rec._killed = true;
            rec.onresult = null;
            rec.onerror = null;
            rec.onend = null;
            try { rec.stop(); } catch (_) { }
        }
    }, []);

    // ─── Speak ─────────────────────────────────────────────────────
    const speak = useCallback(async (text, onEnd) => {
        if (!ttsRef.current || !text) { onEnd?.(); return; }

        stopGlobalAudio();
        killRecognition();
        try {
            setVoiceState(STATES.SPEAKING);

            const res = await apiClient.post("/tts", { text }, { responseType: "blob" });
            const url = URL.createObjectURL(res.data);
            const audio = new Audio(url);

            let analyser = null;
            try {
                const ctx = getAudioCtx();
                if (ctx.state === "suspended") await ctx.resume().catch(() => { });

                const source = ctx.createMediaElementSource(audio);
                analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.55;

                source.connect(analyser);
                analyser.connect(ctx.destination);
            } catch (analyserErr) {
                console.warn("[Voice] AnalyserNode no pudo conectarse:", analyserErr.message);
            }

            setGlobalAudio({ audio, analyser });

            audio.onended = () => {
                setGlobalAudio(null);
                URL.revokeObjectURL(url);
                setTimeout(() => {
                    onEnd?.();
                    if (stateRef.current === STATES.SPEAKING) setVoiceState(STATES.IDLE);
                }, 600);
            };

            audio.onerror = () => {
                setGlobalAudio(null);
                URL.revokeObjectURL(url);
                setVoiceState(STATES.IDLE);
                onEnd?.();
            };

            try {
                const ctx = getAudioCtx();
                if (ctx.state === "suspended") await ctx.resume();
            } catch (_) { }

            try {
                await audio.play();
            } catch (playErr) {
                console.warn("[Voice] Autoplay bloqueado, reintentando...");
                try {
                    const ctx = getAudioCtx();
                    await ctx.resume();
                    const buf = ctx.createBuffer(1, 1, 22050);
                    const src = ctx.createBufferSource();
                    src.buffer = buf; src.connect(ctx.destination); src.start();
                    await audio.play();
                } catch (retryErr) {
                    console.error("[Voice] TTS autoplay falló:", retryErr);
                    setGlobalAudio(null);
                    URL.revokeObjectURL(url);
                    setVoiceState(STATES.IDLE);
                    onEnd?.();
                }
            }

        } catch (err) {
            console.error("[Voice] TTS error:", err);
            setVoiceState(STATES.IDLE);
            onEnd?.();
        }
    }, [getAudioCtx, killRecognition]);

    // ─── Send to assistant ─────────────────────────────────────────
    const sendToAssistant = useCallback(async (text) => {
        if (!text?.trim() || busyRef.current) return null;
        busyRef.current = true;
        setVoiceState(STATES.PROCESSING);
        try {
            const res = await apiClient.post("/assistant", { text });
            const data = res.data;
            const reply = data?.assistant_text || "";
            setLastInteraction(reply);
            setTranscript("");
            if (Array.isArray(data.actions) && data.actions.length > 0 && uiContextRef.current) {
                executeVoiceActions(data.actions, uiContextRef.current);
            }
            return reply;
        } catch (err) {
            console.error("[Voice] Assistant error:", err);
            setVoiceState(STATES.ERROR);
            return null;
        } finally {
            busyRef.current = false;
        }
    }, []);

    // ─── End conversation ──────────────────────────────────────────
    // exitHandsFree=true → sale completamente del modo manos libres
    // exitHandsFree=false → solo termina la conversación activa, mantiene manos libres
    const endConversation = useCallback((exitHandsFree = false) => {
        console.log("[Voice] Conversación terminada, exitHandsFree:", exitHandsFree);
        conversationActiveRef.current = false;
        if (exitHandsFree) {
            handsFreeRef.current = false;
            setHandsFreeModeActive(false);
        }
        setVoiceState(STATES.IDLE);
        stateRef.current = STATES.IDLE;
    }, []);

    // ─── Forward declarations (resueltas por useCallback más abajo) ─
    const startCommandListenerRef = useRef(null);
    const startWakeListenerRef = useRef(null);

    // ─── Listen for follow-up (15s timeout) ────────────────────────
    const listenForFollowUp = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        killRecognition();

        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "es-ES";
        activeRecRef.current = rec;

        let finalText = "";
        let silenceTimer = null;
        let abandonTimer = null;

        setVoiceState(STATES.LISTENING);
        console.log("[Voice] Esperando seguimiento (15s)...");

        const clearTimers = () => {
            if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
            if (abandonTimer) { clearTimeout(abandonTimer); abandonTimer = null; }
        };

        const afterTimeout = () => {
            killRecognition();
            if (handsFreeRef.current) {
                // Manos libres: no salir del modo, volver a escuchar
                endConversation(false);
                setTimeout(() => startCommandListenerRef.current?.(), 500);
            } else {
                endConversation(true);
                setTimeout(() => startWakeListenerRef.current?.(), 500);
            }
        };

        abandonTimer = setTimeout(() => {
            console.log("[Voice] 15s sin respuesta, cerrando conversación");
            afterTimeout();
        }, 15000);

        rec.onresult = (event) => {
            if (abandonTimer) { clearTimeout(abandonTimer); abandonTimer = null; }
            if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }

            let interim = "";
            let hasFinal = false;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalText += event.results[i][0].transcript;
                    hasFinal = true;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            setTranscript(finalText + interim);

            const timeout = hasFinal && interim.length === 0 ? 2000 : 2800;

            silenceTimer = setTimeout(() => {
                const cmd = finalText.trim();
                killRecognition();
                if (cmd.length > 0) {
                    // eslint-disable-next-line no-use-before-define
                    processCommandRef.current?.(cmd);
                } else {
                    afterTimeout();
                }
            }, timeout);
        };

        rec.onerror = (e) => {
            clearTimers();
            if (e.error === "no-speech" || e.error === "aborted") {
                afterTimeout();
            } else {
                console.warn("[Voice] Follow-up error:", e.error);
                afterTimeout();
            }
        };

        rec.onend = () => {
            if (rec._killed) return;
            clearTimers();
            if (activeRecRef.current === rec && stateRef.current === STATES.LISTENING) {
                afterTimeout();
            }
        };

        try { rec.start(); } catch (e) {
            console.warn("[Voice] Failed to start follow-up listener:", e);
            afterTimeout();
        }
    }, [killRecognition, endConversation]);

    // ─── Process command ref (para uso en closures) ─────────────────
    const processCommandRef = useRef(null);

    // ─── Process command (conversational) ──────────────────────────
    const processCommand = useCallback(async (text) => {
        console.log("[Voice] Procesando comando:", text);
        if (text.trim().length < 4) return;
        const _noise = ["time", "times", "the", "a", "ok", "yes", "no", "hi", "hey"];
        if (_noise.includes(text.trim().toLowerCase())) return;
        const textLower = text.toLowerCase();

        // Check goodbye → siempre sale del modo manos libres
        if (STOP_WORDS.some(w => textLower.includes(w)) || GOODBYE_WORDS.some(w => textLower.includes(w))) {
            conversationActiveRef.current = false;
            handsFreeRef.current = false;
            setHandsFreeModeActive(false);
            speak("Perfecto, aquí estaré cuando me necesites.", () => {
                setVoiceState(STATES.IDLE);
                stateRef.current = STATES.IDLE;
                startWakeListenerRef.current?.();
            });
            return;
        }

        // Check briefing — solo si no estamos ya en conversación
        const isBriefing = !conversationActiveRef.current && BRIEFING_TRIGGERS.some(t => textLower.includes(t));

        if (isBriefing) {
            const thinkingPhrase = BRIEFING_THINKING_PHRASES[Math.floor(Math.random() * BRIEFING_THINKING_PHRASES.length)];
            console.log("[Voice] Briefing detectado, respuesta intermedia...");

            speak(thinkingPhrase, async () => {
                const reply = await sendToAssistant(text);
                if (reply) {
                    speak(reply + " ¿Algo más?", () => {
                        conversationActiveRef.current = true;
                        playBeep(660, 0.1);
                        listenForFollowUp();
                    });
                } else {
                    speak("No he podido preparar tu briefing. ¿Puedes repetirlo?", () => {
                        listenForFollowUp();
                    });
                }
            });
            return;
        }

        // Comando normal
        const reply = await sendToAssistant(text);
        if (reply) {
            conversationActiveRef.current = true;
            speak(reply + " ¿Algo más?", () => {
                playBeep(660, 0.1);
                listenForFollowUp();
            });
        } else {
            speak("No he podido procesar eso. ¿Puedes repetirlo?", () => {
                listenForFollowUp();
            });
        }
    }, [sendToAssistant, speak, playBeep, listenForFollowUp]);

    // Mantener ref actualizada
    useEffect(() => { processCommandRef.current = processCommand; }, [processCommand]);

    // ─── Command listener (escucha activa, post-wake o manos libres) ─
    const startCommandListener = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        killRecognition();

        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "es-ES";
        activeRecRef.current = rec;

        let finalText = "";
        let silenceTimer = null;

        setVoiceState(STATES.LISTENING);
        console.log("[Voice] Escuchando comando...");

        const clearSilence = () => { if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; } };

        rec.onresult = (event) => {
            clearSilence();
            let interim = "";
            let hasFinal = false;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalText += event.results[i][0].transcript;
                    hasFinal = true;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            setTranscript(finalText + interim);

            const timeout = hasFinal && interim.length === 0 ? 2000 : 2800;

            silenceTimer = setTimeout(() => {
                const cmd = finalText.trim();
                killRecognition();
                if (cmd.length > 0) {
                    let cleanCmd = cmd;
                    WAKE_WORDS.forEach(w => { cleanCmd = cleanCmd.replace(new RegExp(w, 'i'), '').trim(); });
                    if (cleanCmd.length === 0) {
                        // Solo dijeron "Hola Lucy" sin comando — volver a escuchar
                        speak("Te escucho", () => { startCommandListenerRef.current?.(); });
                        return;
                    }
                    processCommandRef.current?.(cleanCmd);
                } else if (handsFreeRef.current) {
                    // Manos libres: silencio → seguir escuchando
                    startCommandListenerRef.current?.();
                } else {
                    setVoiceState(STATES.IDLE);
                    stateRef.current = STATES.IDLE;
                    startWakeListenerRef.current?.();
                }
            }, timeout);
        };

        rec.onerror = (e) => {
            clearSilence();
            console.log("[Voice] Command recognition error:", e.error);
            if (e.error === "no-speech" || e.error === "aborted") {
                if (handsFreeRef.current) {
                    setTimeout(() => startCommandListenerRef.current?.(), 500);
                } else {
                    setVoiceState(STATES.IDLE);
                    stateRef.current = STATES.IDLE;
                    startWakeListenerRef.current?.();
                }
            } else {
                setVoiceState(STATES.ERROR);
                setTimeout(() => {
                    setVoiceState(STATES.IDLE);
                    stateRef.current = STATES.IDLE;
                    startWakeListenerRef.current?.();
                }, 2000);
            }
        };

        rec.onend = () => {
            if (rec._killed) return;
            clearSilence();
            if (activeRecRef.current === rec && stateRef.current === STATES.LISTENING) {
                if (handsFreeRef.current) {
                    setTimeout(() => startCommandListenerRef.current?.(), 300);
                }
            }
        };

        try { rec.start(); } catch (e) {
            console.warn("[Voice] Failed to start command listener:", e);
            setVoiceState(STATES.IDLE);
        }
    }, [killRecognition, speak]);

    // Mantener ref actualizada
    useEffect(() => { startCommandListenerRef.current = startCommandListener; }, [startCommandListener]);

    // ─── Wake word listener ────────────────────────────────────────
    const startWakeListener = useCallback(() => {
        if (!wakeEnabledRef.current) return;
        if (stateRef.current !== STATES.IDLE) return;
        if (handsFreeRef.current) return;
        if (conversationActiveRef.current) return;

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        killRecognition();

        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "es-ES";
        activeRecRef.current = rec;

        rec.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript.toLowerCase().trim();

                if (stateRef.current === STATES.SPEAKING) {
                    if (STOP_WORDS.some(w => text.includes(w))) {
                        console.log("[Wake] STOP durante habla");
                        stopGlobalAudio();
                        handsFreeRef.current = false;
                        setHandsFreeModeActive(false);
                        conversationActiveRef.current = false;
                        setVoiceState(STATES.IDLE);
                        return;
                    }
                    continue;
                }

                if (stateRef.current !== STATES.IDLE) continue;

                const isWake = WAKE_WORDS.some(w => text.includes(w));
                if (!isWake) continue;

                console.log("[Wake] Detectado:", text);
                killRecognition();

                setWakeWordActive(true);
                setTimeout(() => setWakeWordActive(false), 2000);
                playBeep(880, 0.12);

                let cleanText = text;
                WAKE_WORDS.forEach(w => { cleanText = cleanText.replace(w, ""); });
                cleanText = cleanText.trim();

                if (event.results[i].isFinal && cleanText.length > 3) {
                    console.log("[Wake] Comando completo:", cleanText);
                    getAudioCtx();
                    setTimeout(() => processCommandRef.current?.(cleanText), 200);
                } else {
                    console.log("[Wake] Esperando comando...");
                    getAudioCtx();
                    setTimeout(() => startCommandListenerRef.current?.(), 400);
                }
                return;
            }
        };

        rec.onerror = (e) => {
            if (e.error !== "no-speech" && e.error !== "aborted") {
                console.warn("[Wake] Error:", e.error);
            }
        };

        rec.onend = () => {
            if (rec._killed) return;
            if (activeRecRef.current !== rec) return;
            activeRecRef.current = null;
            if (!wakeEnabledRef.current) return;
            if (handsFreeRef.current) return;
            if (stateRef.current !== STATES.IDLE) return;
            if (document.visibilityState !== "visible") return;
            const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
            const delay = isMobile ? 2000 : 500;
            setTimeout(() => {
                if (!wakeEnabledRef.current || handsFreeRef.current) return;
                if (stateRef.current !== STATES.IDLE) return;
                if (activeRecRef.current !== null) return;
                startWakeListenerRef.current?.();
            }, delay);
        };

        try { rec.start(); } catch (_) { }
    }, [killRecognition, playBeep, getAudioCtx]);

    // Mantener ref actualizada
    useEffect(() => { startWakeListenerRef.current = startWakeListener; }, [startWakeListener]);

    // ─── Activate hands-free (desde botón UI) ──────────────────────
    const activateHandsFreeMode = useCallback(async (wakeText) => {
        if (handsFreeRef.current) return;

        killRecognition();
        handsFreeRef.current = true;
        setHandsFreeModeActive(true);
        conversationActiveRef.current = true;
        setLastInteraction("");
        getAudioCtx();
        playBeep(880, 0.12);

        const query = (typeof wakeText === "string" && wakeText.trim().length > 0)
            ? wakeText.trim()
            : null;

        console.log("[Voice] Manos libres activado. Query:", query);

        if (!query) {
            // Sin query → arrancar wake listener en silencio
            setTimeout(() => startWakeListenerRef.current?.(), 300);
            return;
        }

        const isBriefing = query && BRIEFING_TRIGGERS.some(t => query.toLowerCase().includes(t));

        if (isBriefing) {
            const thinkingPhrase = BRIEFING_THINKING_PHRASES[Math.floor(Math.random() * BRIEFING_THINKING_PHRASES.length)];
            speak(thinkingPhrase, async () => {
                const reply = await sendToAssistant(query);
                if (reply) {
                    speak(reply + " ¿Algo más?", () => {
                        playBeep(660, 0.1);
                        listenForFollowUp();
                    });
                } else {
                    speak("No he podido preparar tu briefing.", () => {
                        listenForFollowUp();
                    });
                }
            });
        } else {
            const reply = await sendToAssistant(query);
            if (reply) {
                speak(reply + " ¿Algo más?", () => {
                    playBeep(660, 0.1);
                    listenForFollowUp();
                });
            } else {
                listenForFollowUp();
            }
        }
    }, [killRecognition, getAudioCtx, playBeep, sendToAssistant, speak, listenForFollowUp]);

    // ─── Cancel ────────────────────────────────────────────────────
    const cancel = useCallback(() => {
        killRecognition();
        stopGlobalAudio();
        handsFreeRef.current = false;
        setHandsFreeModeActive(false);
        conversationActiveRef.current = false;
        setTranscript("");
        setVoiceState(STATES.IDLE);
        setTimeout(() => startWakeListenerRef.current?.(), 1000);
    }, [killRecognition]);

    const startListening = useCallback(() => {
        killRecognition();
        startCommandListenerRef.current?.();
    }, [killRecognition]);

    const setTtsEnabledWithStop = useCallback((value) => {
        const newVal = typeof value === "function" ? value(ttsRef.current) : value;
        setTtsEnabled(newVal);
        if (!newVal) {
            stopGlobalAudio();
            setVoiceState(STATES.IDLE);
        }
    }, []);

    // ─── Lifecycle ─────────────────────────────────────────────────
    useEffect(() => {
        if (wakeWordEnabled && !handsFreeModeActive) {
            // Modo normal: arrancar wake listener si IDLE
            if (!activeRecRef.current && stateRef.current === STATES.IDLE) {
                const timer = setTimeout(() => startWakeListenerRef.current?.(), 1000);
                return () => clearTimeout(timer);
            }
        } else if (handsFreeModeActive) {
            // Manos libres: si no hay reconocimiento activo y está IDLE, arrancar escucha directa
            if (!activeRecRef.current && stateRef.current === STATES.IDLE) {
                const timer = setTimeout(() => startCommandListenerRef.current?.(), 500);
                return () => clearTimeout(timer);
            }
        }
        if (!wakeWordEnabled) {
            killRecognition();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wakeWordEnabled, handsFreeModeActive]);

    useEffect(() => {
        const handler = () => {
            if (document.visibilityState === "visible" && wakeEnabledRef.current && !handsFreeRef.current && stateRef.current === STATES.IDLE) {
                startWakeListenerRef.current?.();
            } else if (document.visibilityState === "hidden") {
                killRecognition();
            }
        };
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, [killRecognition]);

    useEffect(() => {
        const init = () => {
            getAudioCtx();
            document.removeEventListener("click", init);
            document.removeEventListener("touchstart", init);
        };
        document.addEventListener("click", init);
        document.addEventListener("touchstart", init);
        return () => { document.removeEventListener("click", init); document.removeEventListener("touchstart", init); };
    }, [getAudioCtx]);

    return {
        voiceState, transcript, lastInteraction,
        ttsEnabled, setTtsEnabled: setTtsEnabledWithStop,
        wakeWordEnabled, setWakeWordEnabled,
        wakeWordActive, handsFreeModeActive,
        activateHandsFreeMode, startListening, cancel,
        setUIContext, speak, STATES,
    };
}