import { useEffect, useRef } from 'react';

export default function LucyPulseCanvas() {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let dpr = window.devicePixelRatio || 1;
        let w, h, cx, cy;

        const resize = () => {
            dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            w = rect.width;
            h = rect.height;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cx = w / 2;
            cy = h / 2;
        };

        resize();
        window.addEventListener('resize', resize);

        /* ── palette ── */
        const BLUE_DEEP = [30, 100, 200];
        const BLUE_MID  = [58, 140, 230];
        const BLUE_LITE = [100, 180, 255];
        const WHITE_ICE = [200, 218, 245];
        const CHAMPAGNE = [201, 178, 124];

        const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

        /* ── hash-based pseudo-noise (deterministic, non-repeating feel) ── */
        const hash = (n) => {
            let x = Math.sin(n) * 43758.5453;
            return x - Math.floor(x);
        };

        /* ── organic signal: NOT a sine wave ──
           Uses layered hash lookups + smoothed noise
           to produce an irregular, audio-like trace */
        const signal = (x01, time, seed) => {
            const env = Math.sin(x01 * Math.PI);
            const e = env * env;

            /* slow wander (non-periodic via hash) */
            const t1 = time * 0.35 + seed;
            const wander =
                (hash(Math.floor(x01 * 8 + t1) * 1.731 + seed) - 0.5) * 14 +
                (hash(Math.floor(x01 * 8 + t1 + 1) * 1.731 + seed) - 0.5) * 14;
            const wanderFrac = (x01 * 8 + t1) % 1;
            const wanderSmooth = wander * (1 - wanderFrac) +
                ((hash(Math.floor(x01 * 8 + t1 + 1) * 1.731 + seed) - 0.5) * 14 +
                 (hash(Math.floor(x01 * 8 + t1 + 2) * 1.731 + seed) - 0.5) * 14) * wanderFrac;

            /* mid-frequency texture */
            const t2 = time * 0.9 + seed * 1.3;
            const seg2 = x01 * 18 + t2;
            const tex =
                (hash(Math.floor(seg2) * 2.371 + seed * 0.7) - 0.5) * 8;
            const texFrac = seg2 % 1;
            const texSmooth = tex * (1 - texFrac * texFrac) +
                (hash(Math.floor(seg2 + 1) * 2.371 + seed * 0.7) - 0.5) * 8 * texFrac * texFrac;

            /* sharp transient spikes (ECG-like) */
            const spikePhase = x01 * 6.7 + time * 0.8 + seed * 2.3;
            const spikeSeed = hash(Math.floor(spikePhase) * 3.919 + seed);
            const spikeActive = spikeSeed > 0.88; // ~12% chance per cell
            const spikeFrac = spikePhase % 1;
            const spikeShape = spikeFrac < 0.15
                ? spikeFrac / 0.15        // fast rise
                : (1 - spikeFrac) / 0.85; // slow decay
            const spikeDir = spikeSeed > 0.94 ? -1 : 1;
            const spike = spikeActive ? spikeShape * spikeDir * 22 : 0;

            /* micro tremor */
            const tremor =
                (hash(x01 * 47 + time * 3.1 + seed) - 0.5) * 2.4 +
                (hash(x01 * 91 + time * 5.7 + seed * 1.8) - 0.5) * 1.0;

            return (wanderSmooth + texSmooth + spike + tremor) * e;
        };

        /* ── 4 layers: core, upper, lower, GOLD ── */
        const LAYERS = [
            { count: 130, yOff:  0,   ampMul: 1.0,  alpha: 1.0,   seed: 0.0,   speed: 1.0,   colType: 'blue' },
            { count:  90, yOff: -12,  ampMul: 0.68, alpha: 0.45,  seed: 4.2,   speed: 0.85,  colType: 'blue' },
            { count:  90, yOff:  13,  ampMul: 0.65, alpha: 0.24,  seed: 8.5,   speed: 0.78,  colType: 'blue' },
            { count:  60, yOff:  -1,  ampMul: 0.82, alpha: 0.55,  seed: 12.9,  speed: 0.92,  colType: 'gold' },
        ];

        const GOLD_BRIGHT = [218, 195, 138];
        const GOLD_SOFT   = [190, 168, 110];

        const allParticles = LAYERS.map(layer => {
            const particles = [];
            for (let i = 0; i < layer.count; i++) {
                const x01 = i / (layer.count - 1);
                particles.push({
                    x01,
                    jitterX: (Math.random() - 0.5) * 0.004,
                    jitterY: (Math.random() - 0.5) * 1.8,
                    phase: Math.random() * Math.PI * 2,
                    baseRadius: layer.colType === 'gold'
                        ? 0.5 + Math.random() * 0.7
                        : 0.7 + Math.random() * 1.0,
                    kind: Math.random(),
                    microAmp: 0.4 + Math.random() * 1.2,
                    microFreq: 1.2 + Math.random() * 2.5,
                    brightnessVar: 0.8 + Math.random() * 0.4,
                });
            }
            return { ...layer, particles };
        });

        /* ── scatter particles ── */
        const SCATTER_COUNT = 50;
        const scatter = [];
        for (let i = 0; i < SCATTER_COUNT; i++) {
            scatter.push({
                x01: Math.random(),
                layerIdx: Math.floor(Math.random() * 4),
                offsetY: (Math.random() - 0.5) * 0.75,
                phase: Math.random() * Math.PI * 2,
                speed: 0.12 + Math.random() * 0.45,
                amp: 0.3 + Math.random() * 0.6,
                radius: 0.3 + Math.random() * 0.5,
                driftX: (Math.random() - 0.5) * 0.00018,
                kind: Math.random(),
            });
        }

        /* ── ambient dust ── */
        const DUST_COUNT = 28;
        const dust = [];
        for (let i = 0; i < DUST_COUNT; i++) {
            dust.push({
                x01: Math.random(),
                y01: 0.12 + Math.random() * 0.76,
                phase: Math.random() * Math.PI * 2,
                radius: 0.2 + Math.random() * 0.4,
                driftX: (Math.random() - 0.5) * 0.00012,
                driftY: (Math.random() - 0.5) * 0.00006,
                kind: Math.random(),
            });
        }

        /* ── colour pickers ── */
        const pickBlue = (kind) => {
            if (kind < 0.38) return BLUE_MID;
            if (kind < 0.65) return BLUE_LITE;
            if (kind < 0.82) return BLUE_DEEP;
            return WHITE_ICE;
        };

        const pickGold = (kind) => {
            return kind < 0.6 ? GOLD_BRIGHT : GOLD_SOFT;
        };

        /* ── main loop ── */
        const t0 = performance.now();

        const draw = (now) => {
            const t = (now - t0) / 1000;
            ctx.clearRect(0, 0, w, h);

            const waveWidth = w * 0.88;
            const xStart = (w - waveWidth) / 2;

            /* ── dual ambient glow (blue centre + faint gold) ── */
            const glowR = w * 0.30;
            const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
            grd.addColorStop(0, rgba(BLUE_DEEP, 0.05 + Math.sin(t * 0.35) * 0.01));
            grd.addColorStop(0.4, rgba(BLUE_MID, 0.01));
            grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, w, h);

            const goldGlowR = w * 0.18;
            const ggrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, goldGlowR);
            ggrd.addColorStop(0, rgba(CHAMPAGNE, 0.025 + Math.sin(t * 0.5 + 1.2) * 0.008));
            ggrd.addColorStop(1, 'transparent');
            ctx.fillStyle = ggrd;
            ctx.fillRect(0, 0, w, h);

            /* ── render 4 layers back-to-front ── */
            for (let li = allParticles.length - 1; li >= 0; li--) {
                const layer = allParticles[li];
                const layerTime = t * layer.speed;
                const isGold = layer.colType === 'gold';

                for (let i = 0; i < layer.particles.length; i++) {
                    const p = layer.particles[i];

                    const x01 = p.x01 + Math.sin(layerTime * 0.22 + p.phase) * p.jitterX;
                    const px = xStart + x01 * waveWidth;

                    /* signal position (non-sinusoidal) */
                    const sig = signal(x01, layerTime, layer.seed) * layer.ampMul;

                    /* per-particle micro offset (non-sin: hash-based) */
                    const micro = (hash(p.phase * 100 + t * p.microFreq) - 0.5) * p.microAmp * 2;

                    const py = cy + layer.yOff + sig + p.jitterY + micro;

                    /* envelope */
                    const env = Math.sin(Math.max(0, Math.min(1, x01)) * Math.PI);

                    /* centre density */
                    const centreProx = 1 - Math.abs(x01 - 0.5) * 2;
                    const densityAlpha = isGold
                        ? 0.14 + centreProx * 0.28
                        : 0.10 + centreProx * 0.22;
                    const pulse = (hash(p.phase + t * 0.8) - 0.5) * 0.06;

                    const alpha = (densityAlpha + pulse) * env * layer.alpha * p.brightnessVar;

                    /* peak glow */
                    const absSig = Math.abs(sig);
                    const peakBoost = absSig > 16 ? 1.35 : absSig > 9 ? 1.12 : 1.0;

                    const col = isGold ? pickGold(p.kind) : pickBlue(p.kind);
                    const r = p.baseRadius * (0.7 + centreProx * 0.5) * peakBoost;

                    ctx.beginPath();
                    ctx.arc(px, py, r, 0, Math.PI * 2);
                    ctx.fillStyle = rgba(col, Math.min(alpha * peakBoost, isGold ? 0.52 : 0.55));
                    ctx.fill();
                }
            }

            /* ── scatter ── */
            for (let i = 0; i < SCATTER_COUNT; i++) {
                const s = scatter[i];
                s.x01 += s.driftX;
                if (s.x01 < -0.03) s.x01 = 1.03;
                if (s.x01 > 1.03) s.x01 = -0.03;

                const layer = allParticles[s.layerIdx];
                const layerTime = t * layer.speed;
                const isGold = layer.colType === 'gold';
                const px = xStart + s.x01 * waveWidth;
                const sigBase = signal(s.x01, layerTime, layer.seed) * layer.ampMul;
                const dispersion = (hash(s.phase + t * s.speed * 0.7) - 0.5) * s.amp * 36;
                const py = cy + layer.yOff + sigBase * 0.55 + s.offsetY * 30 + dispersion;

                const env = Math.sin(Math.max(0, Math.min(1, s.x01)) * Math.PI);
                const alpha = (0.05 + (hash(s.phase + t * 1.1) - 0.5) * 0.04) * env * (0.35 + layer.alpha * 0.65);

                const col = isGold ? pickGold(s.kind) : pickBlue(s.kind);

                ctx.beginPath();
                ctx.arc(px, py, s.radius, 0, Math.PI * 2);
                ctx.fillStyle = rgba(col, Math.min(alpha, 0.22));
                ctx.fill();
            }

            /* ── ambient dust ── */
            for (let i = 0; i < DUST_COUNT; i++) {
                const d = dust[i];
                d.x01 += d.driftX;
                d.y01 += d.driftY;
                if (d.x01 < -0.02) d.x01 = 1.02;
                if (d.x01 > 1.02) d.x01 = -0.02;
                if (d.y01 < 0.10 || d.y01 > 0.90) d.driftY *= -1;

                const px = xStart + d.x01 * waveWidth;
                const py = h * d.y01 + (hash(d.phase + t * 0.3) - 0.5) * 4;

                const alpha = 0.025 + (hash(d.phase * 7 + t * 0.6) - 0.5) * 0.015;
                const col = d.kind < 0.55 ? BLUE_DEEP : d.kind < 0.85 ? BLUE_MID : d.kind < 0.95 ? WHITE_ICE : GOLD_SOFT;

                ctx.beginPath();
                ctx.arc(px, py, d.radius, 0, Math.PI * 2);
                ctx.fillStyle = rgba(col, Math.max(alpha, 0.01));
                ctx.fill();
            }

            rafRef.current = requestAnimationFrame(draw);
        };

        rafRef.current = requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', resize);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
        />
    );
}
