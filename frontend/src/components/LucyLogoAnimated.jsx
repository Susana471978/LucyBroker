import { useEffect, useRef } from "react";

export default function LucyLogoAnimated() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        let raf;
        let t = 0;

        let W = 0;
        let H = 0;

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();

            W = rect.width || 120;
            H = rect.height || 60;

            canvas.width = W * dpr;
            canvas.height = H * dpr;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        resize();
        window.addEventListener("resize", resize);

        const draw = () => {
            ctx.clearRect(0, 0, W, H);

            const centerY = H / 2;

            // 🎨 colores Lucy
            const gold = [201, 178, 124];
            const goldLight = [255, 220, 150];

            // 🟡 L elegante proporcional
            const fontSize = Math.min(W, H) * 0.6;
            ctx.font = `${fontSize}px Cormorant Garamond`;
            ctx.fillStyle = `rgba(${gold[0]},${gold[1]},${gold[2]},1)`;
            ctx.fillText("L", W * 0.05, H * 0.75);

            // 🌊 onda
            ctx.beginPath();

            const points = Math.floor(W * 0.8);
            let wavePoints = [];

            for (let i = 0; i < points; i++) {
                const x = W * 0.35 + (i / points) * (W * 0.6);

                const wave =
                    Math.sin(i * 0.12 + t * 0.05) * (H * 0.08) +
                    Math.sin(i * 0.04 + t * 0.025) * (H * 0.04);

                const y = centerY + wave;

                wavePoints.push({ x, y });

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            // Glow suave
            ctx.strokeStyle = `rgba(${gold[0]},${gold[1]},${gold[2]},0.25)`;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = `rgba(${gold[0]},${gold[1]},${gold[2]},0.4)`;
            ctx.stroke();

            // Línea principal
            ctx.beginPath();
            wavePoints.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });

            ctx.strokeStyle = `rgba(${goldLight[0]},${goldLight[1]},${goldLight[2]},0.9)`;
            ctx.lineWidth = 1.2;
            ctx.shadowBlur = 6;
            ctx.stroke();

            // ✨ punto animado
            const progress = (t * 0.01) % 1;
            const index = Math.floor(progress * (wavePoints.length - 1));
            const p = wavePoints[index];

            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${goldLight[0]},${goldLight[1]},${goldLight[2]},1)`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = `rgba(${goldLight[0]},${goldLight[1]},${goldLight[2]},0.8)`;
            ctx.fill();

            ctx.shadowBlur = 0;

            t++;
            raf = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: "100%",
                height: "100%",
                display: "block",
            }}
        />
    );
}