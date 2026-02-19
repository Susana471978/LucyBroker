// src/voice/VoiceProvider.js

import React, { createContext, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceEngine } from "./useVoiceEngine";

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

    const { setUIContext } = voiceEngine;

    /**
     * Inyectamos navegación al motor
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
        </VoiceContext.Provider>
    );
}
