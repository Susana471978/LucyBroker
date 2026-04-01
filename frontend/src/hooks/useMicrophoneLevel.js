import { useEffect, useRef, useState } from "react";

export default function useMicrophoneLevel(active = true) {
    const [level, setLevel] = useState(0);

    const streamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const cleanup = async () => {
            // 🔁 parar loop
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }

            // 🔌 desconectar source
            if (sourceRef.current) {
                try {
                    sourceRef.current.disconnect();
                } catch { }
                sourceRef.current = null;
            }

            // 🔊 cerrar contexto
            if (audioContextRef.current) {
                try {
                    await audioContextRef.current.close();
                } catch { }
                audioContextRef.current = null;
            }

            // 🎤 parar micrófono
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }

            analyserRef.current = null;

            // reset visual
            setLevel(0);
        };

        if (!active) {
            cleanup();
            return;
        }

        const start = async () => {
            try {
                // 🎤 pedir micrófono
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                const audioContext = new AudioContextClass();

                const analyser = audioContext.createAnalyser();
                const source = audioContext.createMediaStreamSource(stream);

                // ⚙️ configuración clave
                analyser.fftSize = 512; // más precisión
                analyser.smoothingTimeConstant = 0.85;

                source.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                // guardar refs
                streamRef.current = stream;
                audioContextRef.current = audioContext;
                analyserRef.current = analyser;
                sourceRef.current = source;

                const tick = () => {
                    if (!analyserRef.current) return;

                    analyserRef.current.getByteTimeDomainData(dataArray);

                    let sumSquares = 0;

                    for (let i = 0; i < dataArray.length; i++) {
                        const normalized = (dataArray[i] - 128) / 128;
                        sumSquares += normalized * normalized;
                    }

                    const rms = Math.sqrt(sumSquares / dataArray.length);

                    // 🔥 ajuste de sensibilidad (MUY IMPORTANTE)
                    const boosted = Math.min(1, rms * 4);

                    setLevel(boosted);

                    rafRef.current = requestAnimationFrame(tick);
                };

                tick();
            } catch (error) {
                console.error("No se pudo acceder al micrófono:", error);
                setLevel(0);
            }
        };

        start();

        return () => {
            cancelled = true;
            cleanup();
        };
    }, [active]);

    return level;
}