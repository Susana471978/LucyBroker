// src/voice/VoiceFloatingPanel.jsx

import React, { useState, useEffect } from "react";
import { useVoice } from "./VoiceProvider";

export default function VoiceFloatingPanel() {
    const {
        voiceState,
        transcript,
        lastInteraction,
        ttsEnabled,
        setTtsEnabled,
        startListening,
        cancel,
        STATES,
    } = useVoice();

    const [expanded, setExpanded] = useState(false);
    const [preview, setPreview] = useState("");

    /* -------- Preview logic (Modo C) -------- */

    useEffect(() => {
        if (voiceState === STATES.IDLE && lastInteraction) {
            setPreview(lastInteraction);
            const timer = setTimeout(() => {
                setPreview("");
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [voiceState, lastInteraction, STATES]);

    /* -------- State colors -------- */

    const getStateColor = () => {
        switch (voiceState) {
            case STATES.LISTENING:
                return "bg-blue-500";
            case STATES.PROCESSING:
                return "bg-yellow-500";
            case STATES.SPEAKING:
                return "bg-green-500";
            case STATES.ERROR:
                return "bg-red-500";
            default:
                return "bg-gray-700";
        }
    };

    /* -------- Button click -------- */

    const handleMainClick = () => {
        if (voiceState === STATES.IDLE) {
            setExpanded(true);
            startListening();
        } else {
            cancel();
            setExpanded(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={handleMainClick}
                    className={`w-14 h-14 rounded-full text-white shadow-lg transition-all duration-300 ${getStateColor()}`}
                >
                    🎙
                </button>

                {/* Preview bubble (Modo C) */}
                {preview && !expanded && (
                    <div className="mt-2 p-2 bg-black text-white text-sm rounded shadow-lg max-w-xs">
                        {preview}
                    </div>
                )}
            </div>

            {/* Expanded Panel */}
            {expanded && (
                <div className="fixed bottom-24 right-6 w-80 bg-gray-900 text-white p-4 rounded-xl shadow-2xl z-50">
                    <div className="text-sm mb-2 font-semibold">
                        Estado: {voiceState}
                    </div>

                    <div className="text-xs bg-gray-800 p-2 rounded mb-3 min-h-[40px]">
                        {transcript || "Escuchando..."}
                    </div>

                    <div className="flex justify-between items-center mb-3">
                        <label className="text-xs flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={ttsEnabled}
                                onChange={(e) => setTtsEnabled(e.target.checked)}
                            />
                            TTS
                        </label>

                        <button
                            onClick={() => {
                                cancel();
                                setExpanded(false);
                            }}
                            className="text-xs text-red-400"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
