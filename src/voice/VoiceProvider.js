// src/voice/VoiceProvider.js

import React, { createContext, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceEngine } from "./useVoiceEngine";
import VoiceFloatingPanel from "./VoiceFloatingPanel";

/**
 * Context para exponer el motor si algún día queremos usarlo externamente
 */
const VoiceContext = createContext(null);

export const useVoice = () => {
    return useContext(VoiceContext);
};

export default function VoiceProvider({ children }) {
    const navigate = useNavigate();

    const voiceEngine = useVoiceEngine();

    const {
        setUIContext,
    } = voiceEngine;

    /**
     * Aquí inyectamos las funciones reales del sistema.
     * IMPORTANTE:
     * De momento solo conectamos navegación.
     * Los filtros y openMessage los conectaremos cuando integremos en Overview/Messages.
     */
    useEffect(() => {
        setUIContext({
            navigate,
            currentFilters: null,
            setFilters: null,
            openMessageById: null,
            clearFilters: null,
        });
    }, [navigate, setUIContext]);

    return (
        <VoiceContext.Provider value={voiceEngine}>
            {children}
            <VoiceFloatingPanel />
        </VoiceContext.Provider>
    );
}

