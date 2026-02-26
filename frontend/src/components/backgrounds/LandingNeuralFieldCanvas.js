import React, { useEffect, useRef } from "react";

const LandingNeuralFieldCanvas = () => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        let width = canvas.offsetWidth;
        let height = canvas.offsetHeight;

        canvas.width = width;
        canvas.height = height;

        const FRAGMENT_COUNT = 36;
        const CYCLE_DURATION = 10000; // 10s ciclo completo
        const HELIX_HEIGHT = 140;
        const HELIX_WIDTH = 70;

        let startTime = performance.now();

        const fragments = [];

        for (let i = 0; i < FRAGMENT_COUNT; i++) {
            fragments.push({
                x: Math.random() * width,
                y: Math.random() * height,
                baseX: Math.random() * width,
                baseY: Math.random() * height,
                rotation: Math.random() * Math.PI,
                phaseOffset: Math.random() * Math.PI * 2,
                size: 18 + Math.random() * 20
            });
        }

        const handleResize = () => {
            width = canvas.offsetWidth;
            height = canvas.offsetHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener("resize", handleResize);

        const drawFragment = (f, glowStrength) => {
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.rotation);

            const gradient = ctx.createLinearGradient(
                -f.size / 2,
                0,
                f.size / 2,
                0
            );
            gradient.addColorStop(0, `rgba(255,180,60,${0.4 * glowStrength})`);
            gradient.addColorStop(0.5, `rgba(255,220,120,${0.8 * glowStrength})`);
            gradient.addColorStop(1, `rgba(255,180,60,${0.4 * glowStrength})`);

            ctx.fillStyle = gradient;

            ctx.beginPath();
            ctx.moveTo(-f.size / 2, 0);
            ctx.lineTo(0, -f.size / 4);
            ctx.lineTo(f.size / 2, 0);
            ctx.lineTo(0, f.size / 4);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        };

        const animate = (now) => {
            const elapsed = (now - startTime) % CYCLE_DURATION;
            const progress = elapsed / CYCLE_DURATION;

            ctx.clearRect(0, 0, width, height);

            const helixCenterX = progress * width;
            const helixCenterY = height / 2;

            fragments.forEach((f, i) => {
                const helixProgress =
                    Math.sin(progress * Math.PI * 2 + f.phaseOffset);

                const targetX =
                    helixCenterX +
                    Math.sin(i * 0.5 + progress * 6) * HELIX_WIDTH;

                const targetY =
                    helixCenterY +
                    helixProgress * HELIX_HEIGHT * 0.5;

                let attractionStrength = 0;

                if (progress > 0.3 && progress < 0.8) {
                    attractionStrength =
                        (Math.sin((progress - 0.3) / 0.5 * Math.PI));
                }

                if (progress >= 0.8) {
                    attractionStrength =
                        1 - (progress - 0.8) / 0.2;
                }

                f.x += (targetX - f.x) * 0.02 * attractionStrength;
                f.y += (targetY - f.y) * 0.02 * attractionStrength;

                if (progress < 0.3) {
                    f.x += (f.baseX - f.x) * 0.01;
                    f.y += (f.baseY - f.y) * 0.01;
                }

                f.rotation += 0.003;

                const glow = 0.4 + attractionStrength * 0.8;

                drawFragment(f, glow);
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationRef.current);
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 0,
                pointerEvents: "none"
            }}
        />
    );
};

export default LandingNeuralFieldCanvas;