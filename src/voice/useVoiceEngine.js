// src/voice/useVoiceEngine.js

import { useState, useRef, useCallback } from "react";

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
    const activeSessionToken = useRef(null);

    /* -------------------- UTIL -------------------- */

    const generateSessionToken = () => {
        return Date.now().toString();
    };

    const clearSilenceTimer = () => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    };

    const startSilenceTimer = (callback) => {
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(callback, 1800);
    };

    /* -------------------- START LISTENING -------------------- */

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
        activeSessionToken.current = generateSessionToken();

        let finalTranscript = "";

        recognition.onresult = (event) => {
            let interimTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
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
            if (voiceState === STATES.LISTENING) {
                recognition.start();
            }
        };

        recognition.start();
        setVoiceState(STATES.LISTENING);
    }, [voiceState]);

    /* -------------------- STOP LISTENING -------------------- */

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
                const response = await fetch("/api/assistant", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        message: finalText,
                        input_mode: "voice",
                    }),
                });

                const data = await response.json();

                setLastInteraction(data.assistant_text || "");
                speak(data.assistant_text || "");

                setVoiceState(STATES.IDLE);
            } catch (err) {
                console.error("Voice assistant error:", err);
                setVoiceState(STATES.ERROR);
            } finally {
                isRequestInFlight.current = false;
            }
        },
        []
    );

    /* -------------------- TTS -------------------- */

    const speak = (text) => {
        if (!ttsEnabled || !text) return;

        if (!window.speechSynthesis) return;

        setVoiceState(STATES.SPEAKING);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "es-ES";

        utterance.onend = () => {
            setVoiceState(STATES.IDLE);
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    };

    const interruptSpeech = () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setVoiceState(STATES.IDLE);
    };

    const cancel = () => {
        clearSilenceTimer();

        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        interruptSpeech();
        setTranscript("");
        setVoiceState(STATES.IDLE);
    };

    return {
        voiceState,
        transcript,
        lastInteraction,
        ttsEnabled,
        setTtsEnabled,
        startListening,
        cancel,
        interruptSpeech,
        STATES,
    };
}
