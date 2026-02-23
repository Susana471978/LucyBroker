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

    const speak = useCallback(
        (text) => {
            if (!ttsEnabled || !text || !window.speechSynthesis) {
                setVoiceState(STATES.IDLE);
                return;
            }

            setVoiceState(STATES.SPEAKING);

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "es-ES";

            utterance.onend = () => {
                setVoiceState(STATES.IDLE);
            };

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        },
        [ttsEnabled]
    );

    const stopListening = useCallback(
        async (finalText) => {
            clearSilenceTimer();

            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }

            if (!finalText || isRequestInFlight.current) {
                setVoiceState(STATES.IDLE);
                return;
            }

            isRequestInFlight.current = true;
            setVoiceState(STATES.PROCESSING);

            try {
                const token = localStorage.getItem("auth_token");

                console.log("[Executive] Sending to backend:", finalText);

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
                    console.error("Backend error:", response.status);
                    setVoiceState(STATES.ERROR);
                    return;
                }

                const data = await response.json();

                console.log("[Executive] Response:", data);

                setLastInteraction(data.assistant_text || "");

                if (
                    Array.isArray(data.actions) &&
                    data.actions.length > 0 &&
                    uiContextRef.current
                ) {
                    executeVoiceActions(data.actions, uiContextRef.current);
                }

                if (ttsEnabled && data.assistant_text) {
                    speak(data.assistant_text);
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

    const startListening = useCallback(() => {
        if (voiceState !== STATES.IDLE) return;

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error("SpeechRecognition not supported");
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

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setVoiceState(STATES.ERROR);
        };

        recognition.start();
        setVoiceState(STATES.LISTENING);
    }, [voiceState, startSilenceTimer, stopListening]);

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

    return {
        voiceState,
        transcript,
        lastInteraction,
        ttsEnabled,
        setTtsEnabled,
        startListening,
        cancel,
        setUIContext,
        speak,               // 👈 añadido
        STATES,
    };
}
