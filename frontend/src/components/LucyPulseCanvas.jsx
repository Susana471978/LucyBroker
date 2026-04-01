import { useEffect, useRef } from "react";
import useMicrophoneLevel from "../hooks/useMicrophoneLevel";
import useAudioLevelFromTTS from "../hooks/useAudioLevelFromTTS";

export default function LucyPulseCanvas({ state = "idle" }) {
    const canvasRef = useRef(null);

    const micLevel = useMicrophoneLevel(state === "listening");
    const micLevelRef = useRef(0);

    const ttsData = useAudioLevelFromTTS();
    const ttsDataRef = useRef({ level: 0, waveform: null });

    const stateRef = useRef(state);

    useEffect(() => { micLevelRef.current = micLevel; }, [micLevel]);
    useEffect(() => { ttsDataRef.current = ttsData; }, [ttsData]);
    useEffect(() => { stateRef.current = state; }, [state]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let raf = 0;
        let W = 0;
        let H = 0;
        let t = 0;

        let smoothLevel = 0;

        let liveColor = [30, 110, 220];
        let liveColorB = [70, 160, 255];

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            W = Math.max(1, rect.width);
            H = Math.max(1, rect.height);
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const COLORS = {
            idle: { a: [30, 110, 220], b: [70, 160, 255] },
            listening: { a: [0, 180, 216], b: [120, 220, 255] },
            processing: { a: [100, 120, 255], b: [160, 140, 255] },
            speaking: { a: [201, 178, 124], b: [255, 220, 150] },
        };

        const generateWave = (points, level, st) => {
            const data = new Float32Array(points);

            const baseAmp =
                st === "speaking"
                    ? Math.max(level, 0.35)
                    : Math.max(level, 0.15);

            for (let i = 0; i < points; i++) {
                const x = i / points;

                const wave =
                    Math.sin(x * 12 + t * 0.04) * 0.6 +
                    Math.sin(x * 24 - t * 0.06) * 0.3 +
                    Math.sin(x * 6 + t * 0.02) * 0.2;

                data[i] = wave * baseAmp;
            }

            return data;
        };

        const drawWave = (data, color, colorB) => {
            const cy = H / 2;
            const scaleY = cy * 0.65;

            ctx.beginPath();

            for (let i = 0; i < data.length; i++) {
                const x = (i / data.length) * W;
                const y = cy + data[i] * scaleY;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            // Glow suave
            ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.25)`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 20;
            ctx.shadowColor = `rgba(${color[0]},${color[1]},${color[2]},0.4)`;
            ctx.stroke();

            // Línea principal
            ctx.beginPath();
            for (let i = 0; i < data.length; i++) {
                const x = (i / data.length) * W;
                const y = cy + data[i] * scaleY;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            ctx.strokeStyle = `rgba(${colorB[0]},${colorB[1]},${colorB[2]},0.9)`;
            ctx.lineWidth = 1.4;
            ctx.shadowBlur = 10;
            ctx.shadowColor = `rgba(${colorB[0]},${colorB[1]},${colorB[2]},0.5)`;
            ctx.stroke();

            ctx.shadowBlur = 0;
        };

        const draw = () => {
            const st = stateRef.current;
            const colorCfg = COLORS[st] || COLORS.idle;

            let level = 0;
            let waveform = null;

            if (st === "listening") {
                level = micLevelRef.current;
            } else if (st === "speaking") {
                const d = ttsDataRef.current;
                level = d.level || 0;
                waveform = d.waveform || null;
            }

            smoothLevel = smoothLevel * 0.7 + level * 0.3;

            // transición color suave
            const lr = 0.05;
            liveColor[0] += (colorCfg.a[0] - liveColor[0]) * lr;
            liveColor[1] += (colorCfg.a[1] - liveColor[1]) * lr;
            liveColor[2] += (colorCfg.a[2] - liveColor[2]) * lr;

            liveColorB[0] += (colorCfg.b[0] - liveColorB[0]) * lr;
            liveColorB[1] += (colorCfg.b[1] - liveColorB[1]) * lr;
            liveColorB[2] += (colorCfg.b[2] - liveColorB[2]) * lr;

            // limpiar suave (NO borrar agresivo)
            ctx.fillStyle = "rgba(5,5,8,0.12)";
            ctx.fillRect(0, 0, W, H);

            const points = Math.floor(W / 2);

            let data;

            if (waveform && waveform.length > 0) {
                data = new Float32Array(points);
                const ratio = waveform.length / points;

                for (let i = 0; i < points; i++) {
                    const idx = Math.floor(i * ratio);
                    data[i] = waveform[Math.min(idx, waveform.length - 1)];
                }
            } else {
                data = generateWave(points, smoothLevel, st);
            }

            drawWave(
                data,
                liveColor.map(Math.round),
                liveColorB.map(Math.round)
            );

            t += 1;
            raf = requestAnimationFrame(draw);
        };

        resize();
        window.addEventListener("resize", resize);
        draw();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="block w-full h-full bg-transparent"
        />
    );
}