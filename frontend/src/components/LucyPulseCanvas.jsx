/**
 * LucyPulseCanvas.jsx — v3 "Conversación viva"
 *
 * Props:
 *   state    : 'idle' | 'listening' | 'processing' | 'speaking'
 *   level    : number 0–1  (RMS del micrófono o TTS)
 *   waveform : Float32Array | null  (datos reales del AnalyserNode TTS)
 *
 * Sincronización:
 *   speaking  → protagonista sigue la waveform real sample-a-sample.
 *               Si no hay waveform, síntesis orgánica amplificada por level.
 *   listening → todas las líneas respiran con el micrófono en tiempo real.
 *   processing→ pulso autónomo lento, violeta.
 *   idle      → respiración mínima continua, azul.
 *
 * Fix de dimensiones:
 *   El canvas se monta con position:absolute pero el padre puede no tener
 *   altura definida todavía (motion.div animando flex, o div sin height).
 *   tryInit() hace retry via rAF hasta que getBoundingClientRect devuelva
 *   dimensiones reales. ResizeObserver reacciona a cambios posteriores.
 */

import { useRef, useEffect, useCallback } from 'react';

// ─── Paletas ────────────────────────────────────────────────────────────────
const PALETTES = {
  idle: {
    primary: '#4A9EFF', secondary: '#2D6FCC', accent: '#7BC8FF',
    glow: 'rgba(74,158,255,0.35)', particle: 'rgba(123,200,255,0.75)',
  },
  listening: {
    primary: '#00E5CC', secondary: '#00B3A0', accent: '#80FFEE',
    glow: 'rgba(0,229,204,0.42)', particle: 'rgba(128,255,238,0.82)',
  },
  processing: {
    primary: '#A855F7', secondary: '#7C3AED', accent: '#D8B4FE',
    glow: 'rgba(168,85,247,0.38)', particle: 'rgba(216,180,254,0.75)',
  },
  speaking: {
    primary: '#C9B27C', secondary: '#A08952', accent: '#F0E2B0',
    glow: 'rgba(201,178,124,0.48)', particle: 'rgba(240,226,176,0.82)',
  },
};

// ─── DNA de líneas ───────────────────────────────────────────────────────────
// Dibujado de atrás hacia adelante. Protagonista (A) siempre encima.
// audioResponse: multiplicador de reactividad al level (0 = sordo, 1 = máximo)
const LINE_DNA = [
  { id: 'G', role: 'pulse', freq: 0.40, amp: 0.50, speed: 0.38, w: 22, op: 0.09, phase: 0, ar: 0.25 },
  { id: 'E', role: 'whisper', freq: 1.70, amp: 0.26, speed: 2.80, w: 1, op: 0.18, phase: Math.PI * 0.60, ar: 0.55 },
  { id: 'F', role: 'whisper', freq: 2.10, amp: 0.20, speed: 3.20, w: 1, op: 0.14, phase: Math.PI * 1.10, ar: 0.55 },
  { id: 'B', role: 'shadow', freq: 0.95, amp: 0.76, speed: 1.55, w: 4, op: 0.28, phase: Math.PI * 0.15, ar: 0.72 },
  { id: 'D', role: 'echo', freq: 1.35, amp: 0.42, speed: 2.00, w: 2, op: 0.26, phase: Math.PI * 0.85, ar: 0.68 },
  { id: 'C', role: 'echo', freq: 1.20, amp: 0.46, speed: 1.90, w: 2, op: 0.28, phase: Math.PI * 0.40, ar: 0.68 },
  { id: 'H', role: 'harmonic', freq: 3.10, amp: 0.14, speed: 4.00, w: 1, op: 0.16, phase: Math.PI * 1.50, ar: 0.40 },
  { id: 'A', role: 'protagonist', freq: 1.00, amp: 1.00, speed: 1.20, w: 3, op: 1.00, phase: 0, ar: 1.00 },
];

const PARTICLE_COUNT = 24;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function expSmooth(cur, tgt, a) { return cur + (tgt - cur) * a; }

function gradient(ctx, W, pal, role) {
  const g = ctx.createLinearGradient(0, 0, W, 0);
  if (role === 'protagonist') {
    g.addColorStop(0, 'rgba(8,10,15,0)');
    g.addColorStop(0.22, pal.secondary + 'AA');
    g.addColorStop(0.52, pal.primary);
    g.addColorStop(0.78, pal.accent);
    g.addColorStop(0.92, '#FFFFFFAA');
    g.addColorStop(1, 'rgba(8,10,15,0)');
  } else if (role === 'pulse') {
    g.addColorStop(0, 'rgba(8,10,15,0)');
    g.addColorStop(0.3, pal.secondary + '33');
    g.addColorStop(0.7, pal.primary + '33');
    g.addColorStop(1, 'rgba(8,10,15,0)');
  } else {
    g.addColorStop(0, 'rgba(8,10,15,0)');
    g.addColorStop(0.5, pal.primary);
    g.addColorStop(1, 'rgba(8,10,15,0)');
  }
  return g;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export default function LucyPulseCanvas({ state = 'idle', level = 0, waveform = null }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(state);
  const levelRef = useRef(level);
  const waveformRef = useRef(waveform);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const smoothRef = useRef(0);   // nivel suavizado
  const timeRef = useRef(0);   // timestamp acumulado para sin()

  // Mantener refs actualizados sin reiniciar el loop
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { waveformRef.current = waveform; }, [waveform]);

  // ── Partículas ──────────────────────────────────────────────────────────
  const initParticles = useCallback((W, H) => {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * W,
      y: H / 2 + (Math.random() - 0.5) * H * 0.4,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.0,
      life: Math.random(),
      maxLife: 0.5 + Math.random() * 1.0,
      size: 0.8 + Math.random() * 2.5,
    }));
  }, []);

  // ── Loop de render ──────────────────────────────────────────────────────
  const startLoop = useCallback((canvas) => {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const phases = LINE_DNA.map(d => d.phase);
    let prevTime = performance.now();
    let W = canvas.width;
    let H = canvas.height;

    // Canvas secundario para el afterglow fósforo
    const ghost = document.createElement('canvas');
    ghost.width = W;
    ghost.height = H;
    const gCtx = ghost.getContext('2d');

    function tick(now) {
      rafRef.current = requestAnimationFrame(tick);

      const dt = Math.min((now - prevTime) / 16.67, 3); // delta normalizado a 60fps
      prevTime = now;
      timeRef.current += dt;

      const ST = stateRef.current;
      const rawL = levelRef.current;
      const wave = waveformRef.current;
      const pal = PALETTES[ST] || PALETTES.idle;

      // ── Resync dimensiones (motion.div puede animar su tamaño) ────────
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nW = Math.round(rect.width * dpr);
        const nH = Math.round(rect.height * dpr);
        if (nW !== W || nH !== H) {
          W = canvas.width = ghost.width = nW;
          H = canvas.height = ghost.height = nH;
          initParticles(W, H);
        }
      }

      // ── Suavizado asimétrico: attack rápido, decay lento ──────────────
      // Da la sensación de que las ondas "saltan" con la voz y bajan suaves
      const alpha = rawL > smoothRef.current ? 0.22 : 0.055;
      smoothRef.current = expSmooth(smoothRef.current, rawL, alpha);
      const sl = smoothRef.current;

      // ── Amplitud base por estado ───────────────────────────────────────
      const t0 = timeRef.current;
      let baseAmp;
      switch (ST) {
        case 'speaking':
          // Respira con el TTS. Mínimo siempre visible + impulso del nivel.
          // El seno lento añade una pulsación orgánica aunque el audio sea plano.
          baseAmp = 0.048 + sl * 0.30 + Math.abs(Math.sin(t0 * 0.018)) * 0.022;
          break;
        case 'listening':
          // Más sensible al micrófono — rango más amplio
          baseAmp = 0.038 + sl * 0.36 + Math.abs(Math.sin(t0 * 0.022)) * 0.018;
          break;
        case 'processing':
          // Pulso autónomo tipo "pensando" — sube y baja suavemente
          baseAmp = 0.042 + Math.abs(Math.sin(t0 * 0.028)) * 0.10;
          break;
        default: // idle
          // Respiración mínima, siempre presente
          baseAmp = 0.030 + Math.abs(Math.sin(t0 * 0.014)) * 0.022;
          break;
      }

      // ── Afterglow fósforo ──────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(ghost, 0, 0);
      // Más trail en speaking para el efecto dorado persistente
      const fadeA = ST === 'speaking' ? 0.20 : 0.27;
      ctx.fillStyle = `rgba(8,10,15,${fadeA})`;
      ctx.fillRect(0, 0, W, H);

      const cy = H / 2;

      // ── Líneas ────────────────────────────────────────────────────────
      for (let li = 0; li < LINE_DNA.length; li++) {
        const d = LINE_DNA[li];
        phases[li] += d.speed * 0.014 * dt;

        // Amplitud de esta línea: escala con el nivel proporcional a su ar
        const reactivity = 1 + (d.ar * sl * 3.2);
        const amp = H * baseAmp * d.amp * reactivity;

        // Opacidad: en idle baja, sube con el nivel en otros estados
        const opBoost = ST === 'idle' ? 0.52 : (0.72 + sl * 0.28);
        const opacity = d.op * opBoost;

        // Grosor protagonista crece con el nivel
        const lw = d.role === 'protagonist'
          ? d.w * (1 + sl * 0.5)
          : d.w;

        ctx.beginPath();
        ctx.lineWidth = lw;
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = gradient(ctx, W, pal, d.role);

        // Protagonista usa waveform real si existe y hay señal
        const useWave = (
          d.role === 'protagonist' &&
          wave instanceof Float32Array &&
          wave.length > 8 &&
          sl > 0.01
        );

        const steps = Math.min(W, 512);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = t * W;
          let py;

          if (useWave) {
            // ── Audio real sample-a-sample ─────────────────────────────
            const idx = Math.floor(t * (wave.length - 1));
            const sample = wave[idx] ?? 0;
            // Waveform viene -1..1. Multiplicamos por amp para llenar el canvas.
            // Factor 3.0 porque el RMS del shimmer voice suele ser bajo.
            py = cy + sample * amp * 3.0;
          } else {
            // ── Síntesis orgánica ──────────────────────────────────────
            // Tres capas de senos para naturalidad, más un micro-tremolo
            // que crece con el nivel para dar nerviosismo de voz real.
            const f = d.freq;
            const ph = phases[li];
            const s1 = Math.sin(t * Math.PI * 2 * f * 3.0 + ph);
            const s2 = Math.sin(t * Math.PI * 2 * f * 7.3 + ph * 1.31) * 0.26;
            const s3 = Math.sin(t * Math.PI * 2 * f * 13.7 + ph * 0.69) * 0.12;
            const tremolo = ST !== 'idle'
              ? Math.sin(t * Math.PI * 2 * f * 31 + ph * 3.8) * 0.07 * sl
              : 0;
            // Envolvente: cero en los bordes → sin click visual
            const env = Math.sin(t * Math.PI);
            py = cy + (s1 + s2 + s3 + tremolo) * amp * env;
          }

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        // Glow: protagonista siempre, ecos sólo cuando hay señal
        if (d.role === 'protagonist') {
          ctx.shadowColor = pal.glow;
          ctx.shadowBlur = 12 + sl * 36;
        } else if ((d.role === 'echo' || d.role === 'shadow') && sl > 0.25) {
          ctx.shadowColor = pal.glow;
          ctx.shadowBlur = 3 + sl * 10;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // ── Partículas ─────────────────────────────────────────────────────
      // Sólo en listening/speaking. Densidad proporcional al nivel.
      if (ST !== 'idle') {
        const spawnRate = ST === 'speaking'
          ? 0.007 + sl * 0.020
          : 0.005 + sl * 0.025;

        for (const p of particlesRef.current) {
          p.x += p.vx * (1 + sl * 0.9) * dt;
          p.y += p.vy * dt;
          p.life += spawnRate * dt;

          if (p.life > p.maxLife || p.x < 0 || p.x > W) {
            p.x = Math.random() * W;
            p.y = cy + (Math.random() - 0.5) * H * 0.35;
            p.vx = (Math.random() - 0.5) * 1.5;
            p.vy = (Math.random() - 0.5) * 1.0;
            p.life = 0;
            p.maxLife = 0.5 + Math.random() * 1.0;
            p.size = 0.8 + Math.random() * 2.5;
          }

          const pt = p.life / p.maxLife;
          const fade = Math.sin(pt * Math.PI) * (0.45 + sl * 0.55);
          ctx.globalAlpha = fade * 0.78;
          ctx.fillStyle = pal.particle;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + sl * 0.7), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // ── Guardar frame para el afterglow del próximo tick ───────────────

      gCtx.clearRect(0, 0, W, H);
      gCtx.drawImage(canvas, 0, 0);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [initParticles]);

  // ── Setup: esperar dimensiones reales con retry ─────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    let ro, retryRaf;

    function tryInit() {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        retryRaf = requestAnimationFrame(tryInit);
        return;
      }
      // Cancelar loop anterior si existía (evitar doble loop)
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      initParticles(canvas.width, canvas.height);
      startLoop(canvas);
    }

    ro = new ResizeObserver(() => {
      // Cuando el padre cambia de tamaño (ej: motion.div expandiendo su flex)
      // reiniciamos el loop con las nuevas dimensiones
      if (retryRaf) cancelAnimationFrame(retryRaf);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      tryInit();
    });
    ro.observe(canvas.parentElement || canvas);
    tryInit();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (retryRaf) cancelAnimationFrame(retryRaf);
      if (ro) ro.disconnect();
      rafRef.current = null;
    };
  }, [startLoop, initParticles]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',  // no bloquea clics a los botones encima
      }}
      aria-hidden="true"
    />
  );
}
