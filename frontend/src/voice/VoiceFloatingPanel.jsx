import React from "react";
import { useVoice } from "./VoiceProvider";
import { Mic, Loader2 } from "lucide-react";

export default function VoiceFloatingPanel() {
    const {
        voiceState,
        startListening,
        cancel,
        STATES,
    } = useVoice();

    const isIdle = voiceState === STATES.IDLE;
    const isListening = voiceState === STATES.LISTENING;
    const isProcessing = voiceState === STATES.PROCESSING;
    const isSpeaking = voiceState === STATES.SPEAKING;
    const isError = voiceState === STATES.ERROR;

    const handleClick = () => {
        if (isIdle) {
            startListening();
        } else if (isListening || isSpeaking) {
            cancel();
        }
    };

    const getLabel = () => {
        if (isListening) return "Executive activo…";
        if (isProcessing) return "Analizando contexto…";
        if (isSpeaking) return "Executive respondiendo…";
        if (isError) return "Executive no disponible";
        return "Activar SyntexIA Executive";
    };

    const getStyle = () => {
        if (isListening) return "bg-blue-600";
        if (isProcessing) return "bg-blue-600";
        if (isError) return "bg-slate-700";
        return "bg-gradient-to-r from-blue-700 to-blue-500";
    };

    return (
        <button
            onClick={handleClick}
            disabled={isProcessing}
            className={`
        flex items-center gap-3 px-5 py-2.5 rounded-lg
        text-white font-medium
        border border-blue-500/20
        transition-all duration-200
        ${getStyle()}
      `}
        >
            {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Mic className="w-4 h-4" />
            )}

            <span>{getLabel()}</span>
        </button>
    );
}
