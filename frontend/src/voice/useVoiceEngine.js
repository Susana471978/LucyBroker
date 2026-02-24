import { useState, useRef, useCallback } from "react";
import { executeVoiceActions } from "./voiceCommandRouter";

const API =
    `${process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000"}/api`;

const STATES = {
    IDLE: "IDLE",
    LISTENING: "LISTENING",
    PROCESSING: "PROCESSING",
    SPEAKING: "SPEAKING",
    ERROR: "ERROR",
};

export function useVoiceEngine() {
    const [voiceState, setVoiceState] = useState(STATES.IDLE);
    const [transcript, setTranscript] = useState("");
    const [lastInteraction, setLastInteraction] = useState("");
    const [ttsEnabled, setTtsEnabled] = useState(true);

    const recognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const isRequestInFlight = useRef(false);
    const uiContextRef = useRef(null);

    /* ================= UI CONTEXT ================= */

    const setUIContext = useCallback((context) => {
        uiContextRef.current = context;
    }, []);

    /* ================= SILENCE TIMER ================= */

    const clearSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    const startSilenceTimer = useCallback(
        (callback) => {
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(callback, 1500);
        },
        [clearSilenceTimer]
    );

    /* ================= TTS ================= */

    const getPreferredVoice = () => {
        if (!window.speechSynthesis) return null;

        const voices = window.speechSynthesis.getVoices();

        if (!voices || voices.length === 0) return null;

        // Preferimos voz femenina española si existe
        const spanishFemale =
            voices.find(
                (v) =>
                    v.lang?.startsWith("es") &&
                    (
                        v.name.toLowerCase().includes("female") ||
                        v.name.toLowerCase().includes("zira") ||
                        v.name.toLowerCase().includes("laura") ||
                        v.name.toLowerCase().includes("helena")
                    )
            ) ||
            voices.find((v) => v.lang?.startsWith("es"));

        return spanishFemale || voices[0];
    };

    const speak = useCallback(async (text) => {
        if (!ttsEnabled || !text) {
            setVoiceState(STATES.IDLE);
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

            audio.onended = () => {
                setVoiceState(STATES.IDLE);
            };

            audio.onerror = () => {
                setVoiceState(STATES.ERROR);
            };

            await audio.play();

        } catch (error) {
            console.error("Neural TTS failed, fallback to browser:", error);

            // fallback
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "es-ES";
            utterance.onend = () => setVoiceState(STATES.IDLE);
            window.speechSynthesis.speak(utterance);
        }
    }, [ttsEnabled]);

    /* ================= STOP LISTENING ================= */

    const stopListening = useCallback(
        async (finalText) => {
            clearSilenceTimer();

            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }

            if (!finalText?.trim() || isRequestInFlight.current) {
                setVoiceState(STATES.IDLE);
                return;
            }

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
                    body: JSON.stringify({
                        text: finalText,
                    }),
                });

                if (!response.ok) {
                    setVoiceState(STATES.ERROR);
                    return;
                }

                const data = await response.json();

                const assistantText = data?.assistant_text || "";

                setLastInteraction(assistantText);
                setTranscript("");

                if (
                    Array.isArray(data.actions) &&
                    data.actions.length > 0 &&
                    uiContextRef.current
                ) {
                    executeVoiceActions(data.actions, uiContextRef.current);
                }

                if (ttsEnabled && assistantText) {
                    speak(assistantText);
                } else {
                    setVoiceState(STATES.IDLE);
                }

            } catch (err) {
                console.error("Voice assistant error:", err);
                setVoiceState(STATES.ERROR);
            } finally {
                isRequestInFlight.current = false;
            }
        },
        [clearSilenceTimer, speak, ttsEnabled]
    );

    /* ================= START LISTENING ================= */

    const startListening = useCallback(() => {
        if (voiceState !== STATES.IDLE) return;

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setVoiceState(STATES.ERROR);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "es-ES";

        recognitionRef.current = recognition;

        let finalTranscript = "";

        recognition.onresult = (event) => {
            let interimTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];

                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            setTranscript(finalTranscript + interimTranscript);

            startSilenceTimer(() => {
                if (finalTranscript.trim()) {
                    stopListening(finalTranscript.trim());
                }
            });
        };

        recognition.onerror = () => {
            setVoiceState(STATES.ERROR);
        };

        recognition.onend = () => {
            if (!isRequestInFlight.current) {
                setVoiceState(STATES.IDLE);
            }
        };

        recognition.start();
        setVoiceState(STATES.LISTENING);
    }, [voiceState, startSilenceTimer, stopListening]);

    /* ================= CANCEL ================= */

    const cancel = useCallback(() => {
        clearSilenceTimer();

        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        setTranscript("");
        setVoiceState(STATES.IDLE);
    }, [clearSilenceTimer]);

    /* ================= RETURN ================= */

    return {
        voiceState,
        transcript,
        lastInteraction,
        ttsEnabled,
        setTtsEnabled,
        startListening,
        cancel,
        setUIContext,
        speak,
        STATES,
    };
}