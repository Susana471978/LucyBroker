import { useState, useRef, useCallback, useEffect } from "react";
import { executeVoiceActions } from "./voiceCommandRouter";
import apiClient from "../services/apiClient";

/**
 * useVoiceEngine v4.2 — Conversational mode
 *
 * Flow after wake word:
 *   1. "Hola Lucy" → beep → command listener
 *   2. Command captured → process → Lucy speaks response
 *   3. Lucy listens 15 seconds for follow-up
 *   4. User says something → process → Lucy responds → loop
 *   5. 15 seconds silence OR user says "gracias/no/hasta luego" → back to wake listener
 *
 * Saludo flow:
 *   1. "Hola Lucy, buenos días" → Lucy responde con saludo natural → escucha
 *   2. "¿Cómo tenemos el día?" → "Dame un segundo..." → briefing completo
 *
 * Email flow:
 *   1. "manda email a Carlos" → backend: no body → awaiting_body
 *   2. "que le diga saludos" → backend: genera cuerpo → needs_confirm
 *   3. "sí envíalo" → backend envía → confirmación
 *
 * Manos libres:
 *   - Activa escucha continua sin wake word
 *   - Al terminar conversación/timeout vuelve a startCommandListener (no wake)
 *   - Solo sale del modo con goodbye words
 *
 * Cambios v4.2:
 *   - Lucy decide el cierre de cada respuesta — sin "¿Algo más?" hardcodeado
 *   - pendingEmailContextRef no se limpia antes del await (bug fix)
 *   - Saludo simple detectado antes del briefing trigger
 *
 * Cambios v4.3:
 *   - speak() reescrita: AudioContext.decodeAudioData + AudioBufferSourceNode
 *   - Elimina restricciones de autoplay en móvil
 *   - Fallback a new Audio() si decodeAudioData falla
 */

export const STATES = {
    IDLE: "IDLE",
    LISTENING: "LISTENING",
    PROCESSING: "PROCESSING",
    SPEAKING: "SPEAKING",
    ERROR: "ERROR",
};

// Normalizar texto — eliminar tildes para comparación
function _normalize(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

const WAKE_WORDS = [
    "hola lucy",
    "ola lucy",
    "hola luci",
    "oye lucy",
    "hey lucy",
    "buenos días lucy",
    "buenos dias lucy",
    "buenas lucy",
    "buenas luci",
    "buenos días",
    "buenos dias",
];

// Saludos simples — respuesta natural sin briefing
const GREETING_ONLY = [
    "buenos días", "buenos dias", "buenas tardes", "buenas noches",
    "buenas", "hola", "qué tal", "que tal",
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
    "cómo tenemos el día", "como tenemos el dia",
    "cómo está el día", "como esta el dia",
    "qué hay hoy", "que hay hoy",
];
const BRIEFING_THINKING_PHRASES = [
    "Dame un segundo que me pongo al día...",
    "Un momento, estoy revisando todo...",
    "Déjame ver cómo tienes el día...",
];

// ─── Global audio with change notification ───────────────────────────────────
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
        // AudioBufferSourceNode
        if (typeof _globalAudio?.audio?.stop === "function") {
            try { _globalAudio.audio.stop(); } catch (_) { }
        }
        // HTMLMediaElement
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
    const [pendingEmail, setPendingEmail] = useState(null);
    const [pendingContact, setPendingContact] = useState(null);  // ← NUEVO
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
    const pendingEmailContextRef = useRef(null);
    const pendingContactRef = useRef(null);  // ← NUEVO

    useEffect(() => { stateRef.current = voiceState; }, [voiceState]);
    useEffect(() => { pendingEmailContextRef.current = pendingEmail; }, [pendingEmail]);
    useEffect(() => { pendingContactRef.current = pendingContact; }, [pendingContact]);  // ← NUEVO
    useEffect(() => { ttsRef.current = ttsEnabled; }, [ttsEnabled]);
    useEffect(() => { handsFreeRef.current = handsFreeModeActive; }, [handsFreeModeActive]);
    useEffect(() => { wakeEnabledRef.current = wakeWordEnabled; }, [wakeWordEnabled]);

    const setUIContext = useCallback((ctx) => { uiContextRef.current = { ...uiContextRef.current, ...ctx }; }, []);

    // ─── Audio context ────────────────────────────────────────────────────────
    const getAudioCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
        return audioCtxRef.current;
    }, []);

    // ─── Unlock audio on first user interaction ───────────────────────────────
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

    // ─── Kill recognition ─────────────────────────────────────────────────────
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

    // ─── Speak v4.3 — AudioContext.decodeAudioData (no autoplay restrictions) ─
    const speak = useCallback(async (text, onEnd) => {
        console.log("[TTS] speak() llamada — ttsRef:", ttsRef.current, "| text:", text?.slice(0, 40));
        if (!ttsRef.current || !text) {
            console.log("[TTS] speak() abortada — ttsRef false o text vacío");
            onEnd?.();
            return;
        }

        stopGlobalAudio();
        killRecognition();

        try {
            setVoiceState(STATES.SPEAKING);

            const apiBase = apiClient.defaults.baseURL || "/api";
            const token = localStorage.getItem("auth_token") || "";

            console.log("[TTS] Iniciando fetch...");

            const fetchRes = await fetch(`${apiBase}/tts/stream`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ text }),
            });

            console.log("[TTS] Response status:", fetchRes.status);

            if (!fetchRes.ok) throw new Error(`TTS HTTP ${fetchRes.status}`);

            const arrayBuffer = await fetchRes.arrayBuffer();
            console.log("[TTS] ArrayBuffer recibido:", arrayBuffer.byteLength, "bytes");

            const ctx = getAudioCtx();
            if (ctx.state === "suspended") await ctx.resume();

            console.log("[TTS] Decodificando audio...");

            let audioBuffer;
            try {
                audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                console.log("[TTS] Audio decodificado OK, duración:", audioBuffer.duration.toFixed(2) + "s");
            } catch (decodeErr) {
                console.warn("[TTS] Error en decodeAudioData:", decodeErr);
                console.log("[TTS] Fallback a new Audio()");
                throw { _fallback: true, originalBuffer: arrayBuffer };
            }

            // ── Analyser para LucyPulseCanvas ─────────────────────────────────
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.55;

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyser);
            analyser.connect(ctx.destination);

            setGlobalAudio({ audio: source, analyser });

            console.log("[TTS] Reproduciendo via AudioContext...");

            let ended = false;
            const handleEnd = () => {
                if (ended) return;
                ended = true;
                console.log("[TTS] Reproducción terminada");
                setGlobalAudio(null);
                setTimeout(() => {
                    onEnd?.();
                    if (stateRef.current === STATES.SPEAKING) setVoiceState(STATES.IDLE);
                }, 2500);
            };

            // Timer de seguridad — Android Chrome a veces no dispara onended
            const safetyTimer = setTimeout(handleEnd, (audioBuffer.duration * 1000) + 1500);

            source.onended = () => {
                clearTimeout(safetyTimer);
                handleEnd();
            };

            source.start(0);

        } catch (err) {
            // ── Fallback: new Audio() si decodeAudioData falla ───────────────
            if (err?._fallback) {
                console.log("[TTS] Fallback a new Audio()");
                try {
                    const blob = new Blob([err.originalBuffer], { type: "audio/mpeg" });
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);

                    let analyser = null;
                    try {
                        const ctx = getAudioCtx();
                        const source = ctx.createMediaElementSource(audio);
                        analyser = ctx.createAnalyser();
                        analyser.fftSize = 512;
                        analyser.smoothingTimeConstant = 0.55;
                        source.connect(analyser);
                        analyser.connect(ctx.destination);
                    } catch (_) { }

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

                    await audio.play();
                    return;
                } catch (fallbackErr) {
                    console.error("[TTS] Error fatal:", fallbackErr);
                }
            } else {
                console.error("[TTS] Error fatal:", err);
            }

            setVoiceState(STATES.IDLE);
            onEnd?.();
        }
    }, [getAudioCtx, killRecognition]);

    // ─── Send to assistant ────────────────────────────────────────────────────
    const sendToAssistant = useCallback(async (text, extraPayload = {}) => {
        if (!text?.trim() || busyRef.current) return null;
        busyRef.current = true;
        setVoiceState(STATES.PROCESSING);
        try {
            const res = await apiClient.post("/assistant", { text, ...extraPayload });
            const data = res.data?.data || res.data;
            const reply = data?.assistant_text || "";
            setLastInteraction(reply);
            setTranscript("");

            const pe = data?.pending_email;
            if (pe && (pe.awaiting_body || pe.needs_confirm || pe.awaiting_recipient || pe.awaiting_email_address)) {
                pendingEmailContextRef.current = pe;
                setPendingEmail(pe);
            } else if (pe === undefined || pe === null || (!pe.awaiting_body && !pe.needs_confirm && !pe.awaiting_recipient && !pe.awaiting_email_address)) {
                pendingEmailContextRef.current = null;
                setPendingEmail(null);
            }

            if (Array.isArray(data.actions) && data.actions.length > 0 && uiContextRef.current) {
                executeVoiceActions(data.actions, uiContextRef.current);
            }
            return { reply, data };
        } catch (err) {
            console.error("[Voice] Assistant error:", err);
            setVoiceState(STATES.ERROR);
            return null;
        } finally {
            busyRef.current = false;
        }
    }, []);

    // ─── End conversation ─────────────────────────────────────────────────────
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

    // ─── Forward declarations ─────────────────────────────────────────────────
    const startCommandListenerRef = useRef(null);
    const startWakeListenerRef = useRef(null);

    // ─── Listen for follow-up (15s timeout) ──────────────────────────────────
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
        const echoGuardUntil = Date.now() + 2000;

        setVoiceState(STATES.LISTENING);
        console.log("[Voice] Esperando seguimiento (15s)...");

        const clearTimers = () => {
            if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
            if (abandonTimer) { clearTimeout(abandonTimer); abandonTimer = null; }
        };

        const afterTimeout = () => {
            killRecognition();
            if (pendingEmailContextRef.current) {
                console.log("[Voice] Timeout con email pendiente — reescuchando");
                setTimeout(() => listenForFollowUp(), 500);
                return;
            }
            if (handsFreeRef.current) {
                endConversation(false);
                setTimeout(() => startCommandListenerRef.current?.(), 500);
            } else {
                endConversation(true);
                setTimeout(() => startWakeListenerRef.current?.(), 500);
            }
        };

        abandonTimer = setTimeout(() => {
            console.log("[Voice] 30s sin respuesta, cerrando conversación");
            afterTimeout();
        }, 30000);

        rec.onresult = (event) => {
            // Ignorar eco del altavoz durante los primeros 2s
            if (Date.now() < echoGuardUntil) {
                console.log("[Voice] Echo guard activo, ignorando resultado");
                return;
            }
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

    // ─── Process command ref ──────────────────────────────────────────────────
    const processCommandRef = useRef(null);

    // ─── Process command ──────────────────────────────────────────────────────
    const processCommand = useCallback(async (text, extraPayload = {}) => {
        const cleanText = text.replace(/^[.,\s]+/, '').trim();
        console.log("[Voice] Procesando comando:", cleanText);
        if (cleanText.length < 2) return;
        text = cleanText;

        const _noise = ["time", "times", "the", "a", "ok", "yes", "no", "hi", "hey"];
        if (_noise.includes(text.trim().toLowerCase())) return;
        const textLower = text.toLowerCase();


        // ── Goodbye → salir siempre ───────────────────────────────────────────
        if (STOP_WORDS.some(w => textLower.includes(w)) || GOODBYE_WORDS.some(w => textLower.includes(w))) {
            pendingEmailContextRef.current = null;
            setPendingEmail(null);
            pendingContactRef.current = null;   // ← NUEVO
            setPendingContact(null);            // ← NUEVO
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


        // ── Contacto: awaiting_email → este turno ES el email del contacto ────────
        const pendingContactCtx = pendingContactRef.current;
        console.log("[Voice] pendingContactCtx al entrar:", JSON.stringify(pendingContactCtx));
        if (pendingContactCtx?.id) {
            let cleanEmail = text
                .replace(/punto/gi, ".")
                .replace(/arroba/gi, "@")
                .replace(/\s+/g, "")
                .toLowerCase()
                .trim();
            console.log("[Voice] Recibiendo email para contacto draft:", pendingContactCtx.id, "email:", cleanEmail);
            const result = await sendToAssistant(cleanEmail, { pending_contact_id: pendingContactCtx.id });
            if (!result) {
                speak("No he podido guardar el email. ¿Puedes repetirlo?", () => listenForFollowUp());
                return;
            }
            pendingContactRef.current = null;
            setPendingContact(null);
            const { reply } = result;
            conversationActiveRef.current = true;
            speak(reply, () => { playBeep(660, 0.1); listenForFollowUp(); });
            return;
        }

        // ── Email: awaiting_body → este turno ES el cuerpo ───────────────────
        const emailCtx = pendingEmailContextRef.current;
        console.log("[Voice] emailCtx actual:", JSON.stringify(emailCtx));
        console.log("[Voice] pendingEmail state:", JSON.stringify(pendingEmail));

        const looksLikeEmail = text.includes("@") || text.match(/\b[a-z0-9._%+-]+\s*[\.-]\s*[a-z0-9._%+-]*\s*@/i);
        if (!emailCtx && looksLikeEmail) {
            console.log("[Voice] Texto parece email, buscando draft pendiente...");
        }

        if (emailCtx?.awaiting_recipient || emailCtx?.awaiting_email_address) {
            let cleanRecipient = text;
            WAKE_WORDS.forEach(w => {
                cleanRecipient = cleanRecipient.replace(new RegExp(_normalize(w), 'gi'), '').trim();
            });
            cleanRecipient = cleanRecipient
                .replace(/^(te digo (el destinatario|a quien|que)|el destinatario es|va para|va dirigido a|es para)\s*/i, '')
                .replace(/^(hola|oye|hey|buenas?|buenos días?)\s*/i, '')
                .trim();
            if (!cleanRecipient || cleanRecipient.length < 2) {
                speak("No he entendido bien el nombre. ¿A quién va dirigido el correo?", () => listenForFollowUp());
                return;
            }
            console.log("[Voice] Recibiendo destinatario/email:", cleanRecipient);
            const result = await sendToAssistant(cleanRecipient, { pending_email_id: emailCtx.id });
            if (!result) {
                speak("No he podido procesar eso. ¿Puedes repetirlo?", () => listenForFollowUp());
                return;
            }
            const { reply } = result;
            conversationActiveRef.current = true;
            speak(reply, () => { playBeep(660, 0.1); listenForFollowUp(); });
            return;
        }

        if (emailCtx?.awaiting_body) {
            let cleanBody = text;
            WAKE_WORDS.forEach(w => {
                cleanBody = cleanBody.replace(new RegExp(_normalize(w), 'gi'), '').trim();
            });
            cleanBody = cleanBody.replace(/^(dile que|que le diga|el mensaje es|el correo dice|ponle que)\s*/i, '').trim();
            if (!cleanBody || cleanBody.length < 3) {
                speak("No he entendido el mensaje. ¿Qué quieres decirle?", () => listenForFollowUp());
                return;
            }
            console.log("[Voice] Recibiendo cuerpo del email para draft:", emailCtx.id, "body:", cleanBody);
            const result = await sendToAssistant(cleanBody, {
                pending_email_id: emailCtx.id,
                confirm_email: null,
            });
            if (!result) {
                pendingEmailContextRef.current = emailCtx;
                speak("No he podido procesar el mensaje. ¿Puedes repetirlo?", () => listenForFollowUp());
                return;
            }
            const { reply } = result;
            conversationActiveRef.current = true;
            speak(reply, () => { playBeep(660, 0.1); listenForFollowUp(); });
            return;
        }

        // ── Email: needs_confirm → este turno ES la confirmación ─────────────
        const confirmCtx = pendingEmailContextRef.current;
        if (confirmCtx?.needs_confirm) {
            console.log("[Voice] Confirmando email draft:", confirmCtx.id);
            const result = await sendToAssistant(text, { pending_email_id: confirmCtx.id });
            if (!result) {
                speak("No he podido procesar eso. ¿Puedes repetirlo?", () => listenForFollowUp());
                return;
            }
            const { reply } = result;
            conversationActiveRef.current = true;
            speak(reply, () => { playBeep(660, 0.1); listenForFollowUp(); });
            return;
        }

        // ── Saludo simple sin comando → respuesta natural ─────────────────────
        const isGreetingOnly = GREETING_ONLY.some(g => textLower.trim() === g || textLower.trim() === g + ".")
            && !BRIEFING_TRIGGERS.some(t => textLower.includes(t));

        if (isGreetingOnly) {
            console.log("[Voice] Saludo simple detectado");
            const result = await sendToAssistant(text);
            if (result?.reply) {
                conversationActiveRef.current = true;
                speak(result.reply, () => { playBeep(660, 0.1); listenForFollowUp(); });
            }
            return;
        }

        // ── Briefing ──────────────────────────────────────────────────────────
        const isBriefing = BRIEFING_TRIGGERS.some(t => textLower === t || textLower.startsWith(t));

        if (isBriefing) {
            const thinkingPhrase = BRIEFING_THINKING_PHRASES[Math.floor(Math.random() * BRIEFING_THINKING_PHRASES.length)];
            console.log("[Voice] Briefing detectado");
            speak(thinkingPhrase, async () => {
                const result = await sendToAssistant(text);
                const reply = result?.reply;
                if (reply) {
                    speak(reply, () => {
                        conversationActiveRef.current = true;
                        playBeep(660, 0.1);
                        listenForFollowUp();
                    });
                } else {
                    speak("No he podido preparar tu briefing. ¿Puedes repetirlo?", () => listenForFollowUp());
                }
            });
            return;
        }

        // ── Comando normal ────────────────────────────────────────────────────
        const result = await sendToAssistant(text, extraPayload);
        if (!result) {
            speak("No he podido procesar eso. ¿Puedes repetirlo?", () => listenForFollowUp());
            return;
        }
        const { reply, data } = result;
        conversationActiveRef.current = true;
        speak(reply, () => { playBeep(660, 0.1); listenForFollowUp(); });

    }, [sendToAssistant, speak, playBeep, listenForFollowUp]);

    useEffect(() => { processCommandRef.current = processCommand; }, [processCommand]);

    // ─── Command listener ─────────────────────────────────────────────────────
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
                        speak("Te escucho", () => { startCommandListenerRef.current?.(); });
                        return;
                    }
                    processCommandRef.current?.(cleanCmd);
                } else if (handsFreeRef.current) {
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
                if (pendingEmailContextRef.current) {
                    setTimeout(() => listenForFollowUp(), 500);
                } else if (handsFreeRef.current) {
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
    }, [killRecognition, speak, listenForFollowUp]);

    useEffect(() => { startCommandListenerRef.current = startCommandListener; }, [startCommandListener]);

    // ─── Wake word listener ───────────────────────────────────────────────────
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
                const text = _normalize(event.results[i][0].transcript);

                if (stateRef.current === STATES.SPEAKING) {
                    if (STOP_WORDS.some(w => text.includes(_normalize(w)))) {
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

                const isWake = WAKE_WORDS.some(w => text.includes(_normalize(w)));
                if (!isWake) continue;

                console.log("[Wake] Detectado:", text);
                killRecognition();

                setWakeWordActive(true);
                setTimeout(() => setWakeWordActive(false), 2000);
                playBeep(880, 0.12);

                let cleanText = text;
                WAKE_WORDS.forEach(w => { cleanText = cleanText.replace(_normalize(w), ""); });
                cleanText = cleanText.trim();

                if (event.results[i].isFinal && cleanText.length > 3) {
                    console.log("[Wake] Comando completo:", cleanText);
                    getAudioCtx();
                    setTimeout(() => processCommandRef.current?.(cleanText), 200);
                } else {
                    console.log("[Wake] Activando manos libres con saludo...");
                    getAudioCtx();
                    setTimeout(() => activateHandsFreeMode(null), 400);
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

    useEffect(() => { startWakeListenerRef.current = startWakeListener; }, [startWakeListener]);

    // ─── Activate hands-free ──────────────────────────────────────────────────
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
            console.log("[Voice] Wake word sin comando — intentando WelcomeOverlay");
            try { getAudioCtx().resume(); } catch (_) { }

            // Intentar mostrar WelcomeOverlay (si no se ha hecho briefing hoy)
            const triggered = uiContextRef.current?.triggerWelcome?.();
            if (triggered) {
                // El overlay se encarga del saludo y la escucha
                handsFreeRef.current = false;
                setHandsFreeModeActive(false);
                conversationActiveRef.current = false;
                setVoiceState(STATES.IDLE);
                return;
            }

            // Ya hizo briefing hoy — saludo directo
            const hour = new Date().getHours();
            const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
            console.log("[Voice] Saludo directo (briefing ya hecho)");
            speak(`${greeting}. Te escucho.`, () => {
                setTimeout(() => startCommandListenerRef.current?.(), 500);
            });
            return;
        }

        const isBriefing = BRIEFING_TRIGGERS.some(t => query.toLowerCase().includes(t));

        if (isBriefing) {
            const thinkingPhrase = BRIEFING_THINKING_PHRASES[Math.floor(Math.random() * BRIEFING_THINKING_PHRASES.length)];
            speak(thinkingPhrase, async () => {
                const result = await sendToAssistant(query);
                const reply = result?.reply;
                if (reply) {
                    speak(reply, () => { playBeep(660, 0.1); listenForFollowUp(); });
                } else {
                    speak("No he podido preparar tu briefing.", () => listenForFollowUp());
                }
            });
        } else {
            const result = await sendToAssistant(query);
            const reply = result?.reply;
            if (reply) {
                speak(reply, () => { playBeep(660, 0.1); listenForFollowUp(); });
            } else {
                listenForFollowUp();
            }
        }
    }, [killRecognition, getAudioCtx, playBeep, sendToAssistant, speak, listenForFollowUp]);

    // ─── Cancel ───────────────────────────────────────────────────────────────
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

    // ─── Lifecycle ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (wakeWordEnabled && !handsFreeModeActive) {
            if (!activeRecRef.current && stateRef.current === STATES.IDLE) {
                const timer = setTimeout(() => startWakeListenerRef.current?.(), 1000);
                return () => clearTimeout(timer);
            }
        } else if (handsFreeModeActive) {
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
        return () => {
            document.removeEventListener("click", init);
            document.removeEventListener("touchstart", init);
        };
    }, [getAudioCtx]);

    return {
        voiceState, transcript, lastInteraction,
        ttsEnabled, setTtsEnabled: setTtsEnabledWithStop,
        wakeWordEnabled, setWakeWordEnabled,
        wakeWordActive, handsFreeModeActive,
        activateHandsFreeMode, startListening, cancel,
        setUIContext, speak, STATES,
        pendingEmail, setPendingEmail,
        pendingContact, setPendingContact,  // ← NUEVO
        listenForFollowUp,
    };
}