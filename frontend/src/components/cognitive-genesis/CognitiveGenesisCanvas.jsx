import { useEffect, useRef } from "react";
import { initCognitiveGenesis } from "./useCognitiveGenesis";

export default function CognitiveGenesisCanvas() {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const cleanup = initCognitiveGenesis(containerRef.current);

        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none"
            }}
        />
    );
}