import { useEffect, useRef } from "react";

export default function ExecutiveOrbCanvas({ state = "idle" }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let raf;
        let width = 220;
        let height = 220;

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            width = rect.width || 220;
            height = rect.height || 220;

            canvas.width = width;
            canvas.height = height;
        };

        const getIntensity = () => {
            if (state === "speaking") return 1;
            if (state === "listening") return 0.7;
            if (state === "processing") return 0.5;
            return 0.25;
        };

        const draw = (time = 0) => {
            const t = time * 0.001;

            if (!width || !height) {
                raf = requestAnimationFrame(draw);
                return;
            }

            const cx = width / 2;
            const cy = height / 2;
            const radius = Math.min(width, height) * 0.28;
            const intensity = getIntensity();

            ctx.clearRect(0, 0, width, height);

            // 🌌 ORB (más elegante)
            const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius * 1.2);
            gradient.addColorStop(0, "rgba(59,130,246,0.35)");
            gradient.addColorStop(1, "rgba(0,0,0,0)");

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
            ctx.fill();

            // 🔵 ARO
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(120,180,255,0.6)";
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // 🌊 CAMPO DE PARTÍCULAS (clave visual)
            const spread = radius * 1.6;
            const particleCount = 180;

            for (let i = 0; i < particleCount; i++) {
                const progress = i / particleCount;

                const x = -spread + progress * spread * 2;

                const envelope = 1 - Math.abs(x / spread);

                const noise =
                    Math.sin(x * 0.025 + t * 1.2) +
                    Math.sin(x * 0.012 - t * 0.6) * 0.5;

                const y = noise * 18 * intensity * envelope;

                const px = cx + x;
                const py = cy + y;

                // volumen vertical (clave para parecer referencia)
                const scatter =
                    (Math.random() - 0.5) *
                    24 *
                    envelope *
                    intensity;

                const finalY = py + scatter;

                // mezcla plata + dorado
                const isGold = Math.random() > 0.6;

                ctx.beginPath();
                ctx.arc(px, finalY, 1 + Math.random() * 1.6, 0, Math.PI * 2);

                ctx.fillStyle = isGold
                    ? "rgba(201,178,124,0.75)" // dorado
                    : "rgba(220,225,235,0.85)"; // plata

                ctx.fill();
            }

            raf = requestAnimationFrame(draw);
        };

        resize();
        draw();

        window.addEventListener("resize", resize);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, [state]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full block"
        />
    );
}