/**
 * LucyAvatar.jsx
 * Componente para OverviewPage — Avatar de Lucy con lip-sync
 *
 * 3 estados visuales:
 *   1. idle/thinking  → Imagen estática (ojos cerrados) + partículas doradas
 *   2. generating     → Imagen estática (ojos abiertos) + progress ring
 *   3. speaking       → Vídeo MP4 con lip-sync (blend mode: screen)
 *
 * Uso:
 *   import LucyAvatar from '../components/LucyAvatar';
 *   import { useLucyLipSync } from '../hooks/useLucyLipSync';
 *
 *   const { state, videoUrl, generateResponse, resetToIdle } = useLucyLipSync();
 *
 *   <LucyAvatar
 *     state={state}
 *     videoUrl={videoUrl}
 *     onVideoEnd={resetToIdle}
 *   />
 */

import React, { useState, useRef, useEffect } from 'react';

// ─── Imágenes base ───────────────────────────────────────────
const LUCY_IDLE = '/assets/lucy-idle.png';     // Imagen 1: ojos cerrados
const LUCY_ACTIVE = '/assets/lucy-active.png'; // Imagen 2: ojos abiertos

// ─── Design tokens ───────────────────────────────────────────
const GOLD = '#C9B27C';
const GOLD_LIGHT = '#E8D5A3';
const GOLD_DIM = 'rgba(201, 178, 124, 0.15)';
const BG_DARK = '#080A0F';

// ─── Canvas Particle System ──────────────────────────────────
function GoldParticles({ active = true, intensity = 1 }) {
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const particlesRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        };
        resize();
        window.addEventListener('resize', resize);

        const count = Math.floor(60 * intensity);
        particlesRef.current = Array.from({ length: count }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2.5 + 0.5,
            speedX: (Math.random() - 0.5) * 0.4,
            speedY: (Math.random() - 0.5) * 0.4 - 0.2,
            opacity: Math.random() * 0.6 + 0.2,
            pulse: Math.random() * Math.PI * 2,
        }));

        const animate = () => {
            if (!active) return;
            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);

            particlesRef.current.forEach(p => {
                p.x += p.speedX;
                p.y += p.speedY;
                p.pulse += 0.02;

                if (p.x < 0) p.x = rect.width;
                if (p.x > rect.width) p.x = 0;
                if (p.y < 0) p.y = rect.height;
                if (p.y > rect.height) p.y = 0;

                const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse));
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(201, 178, 124, ${alpha})`;
                ctx.fill();

                if (p.size > 1.5) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(201, 178, 124, ${alpha * 0.1})`;
                    ctx.fill();
                }
            });

            animRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resize);
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [active, intensity]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 2,
            }}
        />
    );
}

// ─── Progress Ring ───────────────────────────────────────────
function ProgressRing({ elapsed = 0, estimatedTotal = 12 }) {
    const progress = Math.min(elapsed / estimatedTotal, 0.95);
    const radius = 90;
    const stroke = 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - progress);

    return (
        <svg
            width={radius * 2 + stroke * 2}
            height={radius * 2 + stroke * 2}
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                filter: `drop-shadow(0 0 8px ${GOLD_DIM})`,
            }}
        >
            <circle
                cx={radius + stroke}
                cy={radius + stroke}
                r={radius}
                fill="none"
                stroke="rgba(201,178,124,0.1)"
                strokeWidth={stroke}
            />
            <circle
                cx={radius + stroke}
                cy={radius + stroke}
                r={radius}
                fill="none"
                stroke={GOLD}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${radius + stroke} ${radius + stroke})`}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
        </svg>
    );
}

// ─── Pulsing Orb ─────────────────────────────────────────────
function PulsingOrb({ state }) {
    const isActive = state === 'thinking' || state === 'generating';
    return (
        <div
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                height: '60%',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${GOLD_DIM} 0%, transparent 70%)`,
                opacity: isActive ? 1 : 0.3,
                animation: isActive ? 'lucyPulse 3s ease-in-out infinite' : 'none',
                zIndex: 0,
            }}
        />
    );
}

// ─── Main Component ──────────────────────────────────────────
export default function LucyAvatar({
    state = 'idle',
    videoUrl = null,
    onVideoEnd = () => { },
    thinkingText = '',
    className = '',
}) {
    const videoRef = useRef(null);
    const [elapsed, setElapsed] = useState(0);
    const [videoLoaded, setVideoLoaded] = useState(false);

    // Timer para generating state
    useEffect(() => {
        if (state !== 'generating') {
            setElapsed(0);
            return;
        }
        const interval = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => clearInterval(interval);
    }, [state]);

    // Play video cuando está listo
    useEffect(() => {
        if (state === 'speaking' && videoUrl && videoRef.current) {
            videoRef.current.load();
            videoRef.current.play().catch(console.error);
        }
    }, [state, videoUrl]);

    // Reset video loaded flag
    useEffect(() => {
        if (state !== 'speaking') setVideoLoaded(false);
    }, [state]);

    const showIdleImage = state === 'idle' || state === 'thinking';
    const showActiveImage = state === 'generating';
    const showVideo = state === 'speaking' && videoUrl;

    return (
        <>
            <style>{`
        @keyframes lucyPulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes lucyFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes textFade {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>

            <div
                className={className}
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 400,
                    aspectRatio: '1 / 1',
                    margin: '0 auto',
                    overflow: 'hidden',
                    borderRadius: 16,
                    background: BG_DARK,
                }}
            >
                <PulsingOrb state={state} />

                <GoldParticles
                    active={state !== 'speaking'}
                    intensity={state === 'thinking' ? 1.5 : state === 'generating' ? 2 : 0.7}
                />

                {/* Idle image — ojos cerrados */}
                {showIdleImage && (
                    <img
                        src={LUCY_IDLE}
                        alt="Lucy"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            mixBlendMode: 'screen',
                            zIndex: 1,
                            animation: 'lucyFadeIn 0.6s ease-out',
                        }}
                    />
                )}

                {/* Active image — ojos abiertos, durante generating */}
                {showActiveImage && (
                    <img
                        src={LUCY_ACTIVE}
                        alt="Lucy procesando"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            mixBlendMode: 'screen',
                            zIndex: 1,
                            animation: 'lucyFadeIn 0.6s ease-out',
                        }}
                    />
                )}

                {/* Lip-sync video */}
                {showVideo && (
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        playsInline
                        onLoadedData={() => setVideoLoaded(true)}
                        onEnded={onVideoEnd}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            mixBlendMode: 'screen',
                            zIndex: 4,
                            opacity: videoLoaded ? 1 : 0,
                            transition: 'opacity 0.4s ease',
                        }}
                    />
                )}

                {/* Progress ring */}
                {state === 'generating' && (
                    <ProgressRing elapsed={elapsed} estimatedTotal={15} />
                )}

                {/* Status text */}
                {(state === 'thinking' || state === 'generating') && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 16,
                            left: 0,
                            right: 0,
                            textAlign: 'center',
                            zIndex: 5,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 13,
                            letterSpacing: '0.05em',
                            color: GOLD_LIGHT,
                            animation: 'textFade 2s ease-in-out infinite',
                        }}
                    >
                        {state === 'thinking' && (thinkingText || 'Lucy está pensando...')}
                        {state === 'generating' && `Generando respuesta... ${elapsed}s`}
                    </div>
                )}
            </div>
        </>
    );
}
