import { createContext, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useVoiceEngine } from "./useVoiceEngine";

const VoiceContext = createContext(null);

export function useVoice() {
    return useContext(VoiceContext);
}

export default function VoiceProvider({ children }) {
    const navigate = useNavigate();
    const voiceEngine = useVoiceEngine();
    const { setUIContext } = voiceEngine;

    /**
     * Inyectamos navegación al motor.
     * Las páginas pueden extender el contexto llamando a setUIContext
     * con campos adicionales (refreshReminders, refreshTasks, etc.)
     */
    useEffect(() => {
        setUIContext({
            navigate,
            currentFilters: null,
            setFilters: null,
            openMessageById: null,
            clearFilters: null,
            refreshReminders: null,
            refreshTasks: null,
            setPendingContact: voiceEngine.setPendingContact,  // ← AÑADIR
        });
    }, [navigate, setUIContext, voiceEngine.setPendingContact]);

    return (
        <VoiceContext.Provider value={voiceEngine}>
            {children}
        </VoiceContext.Provider>
    );
}
