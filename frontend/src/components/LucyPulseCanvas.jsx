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

        let raf = 0, W = 0, H = 0, t = 0, smoothLevel = 0;
        let cR = 30, cG = 110, cB = 220;
        let gR = 70, gG = 160, gB = 255;

        const COLORS = {
            idle:       { m: [20, 60, 140],   g: [40, 100, 180] },
            listening:  { m: [0, 180, 216],   g: [100, 220, 255] },
            processing: { m: [100, 80, 220],  g: [140, 120, 255] },
            speaking:   { m: [201, 178, 124], g: [255, 220, 150] },
        };

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            W = Math.max(1, rect.width);
            H = Math.max(1, rect.height);
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const drawRibbon = (freq, speed, phase, yBase, amplitude, lineW, alpha) => {
            ctx.beginPath();
            for (let x = 0; x <= W; x += 2) {
                const nx = x / W;
                const env = Math.pow(Math.sin(nx * Math.PI), 2.0);
                const wave = Math.sin(nx * freq + t * speed + phase)
                           + Math.sin(nx * freq * 0.6 - t * speed * 0.7 + phase * 1.3) * 0.5
                           + Math.sin(nx * freq * 0.3 + t * speed * 0.4) * 0.25;
                const y = yBase + wave * amplitude * env;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            ctx.strokeStyle = `rgba(${Math.round(cR)},${Math.round(cG)},${Math.round(cB)},${alpha * 0.12})`;
            ctx.lineWidth = lineW + 8;
            ctx.shadowBlur = 40;
            ctx.shadowColor = `rgba(${Math.round(cR)},${Math.round(cG)},${Math.round(cB)},${alpha * 0.08})`;
            ctx.stroke();

            ctx.beginPath();
            for (let x = 0; x <= W; x += 2) {
                const nx = x / W;
                const env = Math.pow(Math.sin(nx * Math.PI), 2.0);
                const wave = Math.sin(nx * freq + t * speed + phase)
                           + Math.sin(nx * freq * 0.6 - t * speed * 0.7 + phase * 1.3) * 0.5
                           + Math.sin(nx * freq * 0.3 + t * speed * 0.4) * 0.25;
                const y = yBase + wave * amplitude * env;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            ctx.strokeStyle = `rgba(${Math.round(gR)},${Math.round(gG)},${Math.round(gB)},${alpha})`;
            ctx.lineWidth = lineW;
            ctx.shadowBlur = 18;
            ctx.shadowColor = `rgba(${Math.round(gR)},${Math.round(gG)},${Math.round(gB)},${alpha * 0.35})`;
            ctx.stroke();
            ctx.shadowBlur = 0;
        };

        const draw = () => {
            const st = stateRef.current;
            const cc = COLORS[st] || COLORS.idle;

            let level = 0;
            if (st === "listening") level = micLevelRef.current;
            else if (st === "speaking") level = ttsDataRef.current.level || 0;
            else if (st === "processing") level = 0.25 + Math.sin(t * 0.04) * 0.1;

            smoothLevel = smoothLevel * 0.9 + level * 0.1;
            const eff = st === "idle" ? Math.max(smoothLevel, 0.04) : Math.max(smoothLevel, 0.2);

            const lr = 0.035;
            cR += (cc.m[0] - cR) * lr; cG += (cc.m[1] - cG) * lr; cB += (cc.m[2] - cB) * lr;
            gR += (cc.g[0] - gR) * lr; gG += (cc.g[1] - gG) * lr; gB += (cc.g[2] - gB) * lr;

            ctx.fillStyle = "rgba(5,5,8,0.12)";
            ctx.fillRect(0, 0, W, H);

            const cy = H / 2;
            const spread = H * 0.35;
            const baseAmp = (0.15 + eff * 0.85) * spread;

            drawRibbon(4.5, 0.012, 0,     cy - spread * 0.5,  baseAmp * 0.7,  1.8, 0.55);
            drawRibbon(3.8, -0.015, 2.1,   cy - spread * 0.15, baseAmp * 0.9,  2.0, 0.75);
            drawRibbon(5.2, 0.018, 4.2,    cy + spread * 0.15, baseAmp * 0.85, 1.9, 0.70);
            drawRibbon(4.0, -0.01, 6.0,    cy + spread * 0.5,  baseAmp * 0.65, 1.6, 0.50);

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
        <canvas ref={canvasRef} className="block w-full h-full bg-transparent" />
    );
}
