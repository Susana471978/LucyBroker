/**
 * useLucyLipSync.js
 * Hook que gestiona el flujo completo de lip-sync:
 * texto → TTS → MuseTalk → vídeo MP4
 *
 * Uso en OverviewPage:
 *   const { state, videoUrl, error, generateResponse, resetToIdle } = useLucyLipSync();
 *   await generateResponse("Tienes 3 reuniones hoy...");
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export function useLucyLipSync() {
    const [state, setState] = useState('idle');    // idle | thinking | generating | speaking
    const [videoUrl, setVideoUrl] = useState(null);
    const [error, setError] = useState(null);
    const pollingRef = useRef(null);

    const cleanup = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        if (videoUrl) URL.revokeObjectURL(videoUrl);
    }, [videoUrl]);

    // Cleanup on unmount
    useEffect(() => cleanup, [cleanup]);

    const generateResponse = useCallback(async (text) => {
        cleanup();
        setError(null);
        setVideoUrl(null);
        setState('thinking');

        try {
            // 1. Pedir generación
            const res = await fetch('/api/lipsync/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!res.ok) throw new Error(`API error: ${res.status}`);

            const { job_id } = await res.json();
            setState('generating');

            // 2. Polling del estado
            return new Promise((resolve, reject) => {
                pollingRef.current = setInterval(async () => {
                    try {
                        const statusRes = await fetch(`/api/lipsync/status/${job_id}`);
                        const status = await statusRes.json();

                        if (status.status === 'ready' && status.video_url) {
                            clearInterval(pollingRef.current);
                            pollingRef.current = null;

                            // 3. Descargar vídeo como blob para reproducción
                            const videoRes = await fetch(status.video_url);
                            const blob = await videoRes.blob();
                            const url = URL.createObjectURL(blob);

                            setVideoUrl(url);
                            setState('speaking');
                            resolve(url);
                        }

                        if (status.status === 'error') {
                            clearInterval(pollingRef.current);
                            pollingRef.current = null;
                            setState('idle');
                            setError(status.error);
                            reject(new Error(status.error));
                        }
                    } catch (err) {
                        console.error('Polling error:', err);
                    }
                }, 1500); // Poll cada 1.5s
            });

        } catch (err) {
            setState('idle');
            setError(err.message);
            throw err;
        }
    }, [cleanup]);

    const resetToIdle = useCallback(() => {
        cleanup();
        setState('idle');
        setVideoUrl(null);
    }, [cleanup]);

    return { state, videoUrl, error, generateResponse, resetToIdle };
}