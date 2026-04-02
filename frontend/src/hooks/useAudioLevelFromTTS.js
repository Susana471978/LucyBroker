import { useEffect, useRef, useState } from "react";
import { onGlobalAudioChange } from "../voice/useVoiceEngine";

/**
 * useAudioLevelFromTTS v2
 *
 * El problema anterior: useVoiceEngine tiene su propio AudioContext y ya
 * llamó createMediaElementSource() en el <audio>. Este hook intentaba
 * crear un SEGUNDO AudioContext y llamar createMediaElementSource() de nuevo
 * → falla silenciosamente → level=0, waveform=null siempre.
 *
 * Solución: useVoiceEngine ahora exporta el analyser junto con el audio
 * via setGlobalAudio({ audio, analyser }). Este hook lo recoge y lee
 * directamente del analyser ya conectado.
 *
 * Fallback: si llega un <audio> sin analyser (briefing overlay, etc.),
 * intenta conectar su propio analyser. Si falla → simulación.
 *
 * Returns: { level: 0-1, waveform: Float32Array | null }
 */
export default function useAudioLevelFromTTS() {
    const [data, setData] = useState({ level: 0, waveform: null });
    const rafRef = useRef(null);
    const audioCtxRef = useRef(null);
    const connectedRef = useRef(null); // el <audio> al que ya conectamos

    useEffect(() => {
        let cancelled = false;

        const stopLoop = () => {
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            if (!cancelled) setData({ level: 0, waveform: null });
        };

        const startLoop = (audio, analyser) => {
            stopLoop();
            if (!audio || !analyser || cancelled) return;

            const bufLen = analyser.frequencyBinCount;
            const timeData = new Float32Array(bufLen);

            const tick = () => {
                if (cancelled) return;
                if (audio.paused || audio.ended) {
                    setData({ level: 0, waveform: null });
                    return;
                }

                analyser.getFloatTimeDomainData(timeData);

                // RMS
                let sum = 0;
                for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
                const rms = Math.sqrt(sum / timeData.length);
                const level = Math.min(1, rms * 5); // ×5 porque shimmer voice tiene RMS bajo

                setData({ level, waveform: new Float32Array(timeData) });
                rafRef.current = requestAnimationFrame(tick);
            };

            rafRef.current = requestAnimationFrame(tick);
        };

        const startSimulation = (audio) => {
            stopLoop();
            if (!audio || cancelled) return;

            const tick = () => {
                if (cancelled) return;
                if (audio.paused || audio.ended) {
                    setData({ level: 0, waveform: null });
                    return;
                }
                const ct = audio.currentTime * 8;
                const sim = Math.max(0, Math.min(1,
                    0.35
                    + Math.sin(ct) * 0.30
                    + Math.sin(ct * 2.3) * 0.20
                    + Math.sin(ct * 0.7) * 0.15
                ));
                setData({ level: sim, waveform: null });
                rafRef.current = requestAnimationFrame(tick);
            };

            rafRef.current = requestAnimationFrame(tick);
        };

        const tryConnectAndStart = (audio) => {
            // Si ya conectamos este mismo elemento, no repetir
            if (connectedRef.current?.audio === audio && connectedRef.current?.analyser) {
                startLoop(audio, connectedRef.current.analyser);
                return;
            }

            try {
                if (!audioCtxRef.current) {
                    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                }
                const ctx = audioCtxRef.current;
                if (ctx.state === 'suspended') ctx.resume().catch(() => { });

                const source = ctx.createMediaElementSource(audio);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.55; // menos suavizado = más reactivo

                source.connect(analyser);
                analyser.connect(ctx.destination);

                connectedRef.current = { audio, analyser };
                startLoop(audio, analyser);
            } catch (e) {
                // createMediaElementSource ya fue llamado por useVoiceEngine
                // → fallback a simulación basada en currentTime
                console.warn('[useAudioLevelFromTTS] AnalyserNode no disponible, usando simulación:', e.message);
                startSimulation(audio);
            }
        };

        const unsubscribe = onGlobalAudioChange((payload) => {
            if (!payload) {
                stopLoop();
                return;
            }

            // useVoiceEngine puede enviar { audio, analyser } o simplemente un <audio>
            if (payload && typeof payload === 'object' && payload.audio instanceof HTMLMediaElement) {
                // Formato enriquecido: { audio, analyser }
                const { audio, analyser } = payload;
                if (analyser) {
                    startLoop(audio, analyser);
                } else {
                    tryConnectAndStart(audio);
                }
            } else if (payload instanceof HTMLMediaElement) {
                // Formato legacy: solo el <audio>
                tryConnectAndStart(payload);
            }
        });

        return () => {
            cancelled = true;
            unsubscribe();
            stopLoop();
        };
    }, []);

    return data;
}