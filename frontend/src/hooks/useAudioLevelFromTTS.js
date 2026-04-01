import { useEffect, useRef, useState } from "react";
import { onGlobalAudioChange } from "../voice/useVoiceEngine";

/**
 * Returns TTS audio data for visualization:
 *   { level: 0-1, waveform: Float32Array | null }
 *
 * - If an AnalyserNode can be connected → waveform has real time-domain data
 * - If not (AudioContext conflicts) → waveform is null, level is simulated
 *
 * LucyPulseCanvas uses waveform when available, otherwise generates
 * a simulated waveform from the level value.
 */
export default function useAudioLevelFromTTS() {
    const [data, setData] = useState({ level: 0, waveform: null });
    const rafRef = useRef(null);
    const audioRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const audioCtxRef = useRef(null);
    const connectedAudioRef = useRef(null); // track which <audio> we connected

    useEffect(() => {
        let cancelled = false;

        const stopLoop = () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            audioRef.current = null;
            if (!cancelled) setData({ level: 0, waveform: null });
        };

        const tryConnectAnalyser = (audio) => {
            // Only connect once per <audio> element — createMediaElementSource
            // can only be called once per element
            if (connectedAudioRef.current === audio && analyserRef.current) {
                return true;
            }

            try {
                if (!audioCtxRef.current) {
                    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                }
                const actx = audioCtxRef.current;

                // Resume if suspended (autoplay policy)
                if (actx.state === "suspended") {
                    actx.resume().catch(() => { });
                }

                const source = actx.createMediaElementSource(audio);
                const analyser = actx.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.6;

                source.connect(analyser);
                analyser.connect(actx.destination);

                sourceRef.current = source;
                analyserRef.current = analyser;
                connectedAudioRef.current = audio;

                return true;
            } catch (e) {
                // MediaElementSource conflict — fall back to simulation
                console.warn("[useAudioLevelFromTTS] AnalyserNode failed, using simulation:", e.message);
                analyserRef.current = null;
                return false;
            }
        };

        const startLoop = (audio) => {
            stopLoop();
            if (!audio || cancelled) return;
            audioRef.current = audio;

            const hasAnalyser = tryConnectAnalyser(audio);
            const bufferLen = hasAnalyser ? analyserRef.current.frequencyBinCount : 0;
            const timeData = hasAnalyser ? new Float32Array(bufferLen) : null;

            const tick = () => {
                if (cancelled || !audioRef.current) return;
                const a = audioRef.current;

                if (a.paused || a.ended) {
                    setData({ level: 0, waveform: null });
                    return;
                }

                if (hasAnalyser && analyserRef.current && timeData) {
                    // === REAL AUDIO DATA ===
                    analyserRef.current.getFloatTimeDomainData(timeData);

                    // Compute RMS level
                    let sum = 0;
                    for (let i = 0; i < timeData.length; i++) {
                        sum += timeData[i] * timeData[i];
                    }
                    const rms = Math.sqrt(sum / timeData.length);
                    const level = Math.min(1, rms * 4); // scale up for visibility

                    // Pass a copy of waveform data
                    setData({ level, waveform: new Float32Array(timeData) });
                } else {
                    // === SIMULATION FALLBACK ===
                    const ct = a.currentTime * 8;
                    const w1 = Math.sin(ct) * 0.3;
                    const w2 = Math.sin(ct * 2.3) * 0.2;
                    const w3 = Math.sin(ct * 0.7) * 0.15;
                    const base = 0.35;
                    const simLevel = Math.max(0, Math.min(1, base + w1 + w2 + w3));
                    setData({ level: simLevel, waveform: null });
                }

                rafRef.current = requestAnimationFrame(tick);
            };

            tick();
        };

        const unsubscribe = onGlobalAudioChange((audio) => {
            if (audio) {
                startLoop(audio);
            } else {
                stopLoop();
            }
        });

        return () => {
            cancelled = true;
            unsubscribe();
            stopLoop();
            // Don't close AudioContext — may be reused
        };
    }, []);

    return data;
}