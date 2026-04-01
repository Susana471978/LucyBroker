import React, { useRef, useEffect } from "react";
import useMicrophoneLevel from "../hooks/useMicrophoneLevel";
import useAudioLevelFromTTS from "../hooks/useAudioLevelFromTTS";

const LINES = [
  { id:'A', yBase:0.5, freq:[1.1,2.3,0.5],  phase:[0,1.2,2.8],   spd:[0.28,0.19,0.11], ampMul: 1.00, width:3.5, colorMode:'gold-white',  hasParticles:false },
  { id:'B', yBase:0.5, freq:[1.3,2.7,0.6],  phase:[0.8,2.1,4.2], spd:[0.34,0.23,0.14], ampMul: 0.82, width:1.8, colorMode:'gold-dim',    hasParticles:false },
  { id:'C', yBase:0.5, freq:[1.8,4.1,0.9],  phase:[1.6,3.4,0.7], spd:[0.52,0.38,0.21], ampMul: 0.65, width:1.0, colorMode:'gold-faint',  hasParticles:true,  particleOffset:-1 },
  { id:'D', yBase:0.5, freq:[1.8,4.1,0.9],  phase:[1.6,3.4,0.7], spd:[0.52,0.38,0.21], ampMul:-0.65, width:1.0, colorMode:'gold-faint',  hasParticles:true,  particleOffset: 1 },
  { id:'E', yBase:0.5, freq:[2.9,6.3,1.2],  phase:[2.3,0.9,3.1], spd:[0.71,0.55,0.29], ampMul: 0.42, width:0.5, colorMode:'white-ghost', hasParticles:true,  particleOffset:-1 },
  { id:'F', yBase:0.5, freq:[2.9,6.3,1.2],  phase:[2.3,0.9,3.1], spd:[0.71,0.55,0.29], ampMul:-0.42, width:0.5, colorMode:'white-ghost', hasParticles:true,  particleOffset: 1 },
  { id:'G', yBase:0.5, freq:[0.6,1.1,0.3],  phase:[3.1,1.8,0.4], spd:[0.15,0.09,0.06], ampMul: 0.90, width:1.2, colorMode:'deep-glow',   hasParticles:false },
  { id:'H', yBase:0.5, freq:[0.6,1.1,0.3],  phase:[3.1,1.8,0.4], spd:[0.15,0.09,0.06], ampMul:-0.90, width:1.2, colorMode:'deep-glow',   hasParticles:false },
];

const DRAW_ORDER = ['G','H','E','F','C','D','B','A'];

const COLOR_THEMES = {
  'gold-white':  { peak:[255,245,200], mid:[220,185,90],  dim:[140,105,30] },
  'gold-dim':    { peak:[240,210,120], mid:[190,155,60],  dim:[100,75,15]  },
  'gold-faint':  { peak:[210,180,100], mid:[160,125,45],  dim:[80,58,10]   },
  'white-ghost': { peak:[255,252,240], mid:[200,195,175], dim:[90,85,70]   },
  'deep-glow':   { peak:[180,145,60],  mid:[100,78,20],   dim:[40,30,5]    },
};

const STATE_CFG = {
  idle:       { amp:0.14, spdMul:0.5  },
  listening:  { amp:0.52, spdMul:1.1  },
  processing: { amp:0.38, spdMul:1.4  },
  speaking:   { amp:0.68, spdMul:0.9  },
};

const STATE_COLORS = {
  idle:       { peak:[180,150,70],  mid:[100,78,25],  dim:[45,34,8]   },
  listening:  { peak:[0,220,250],   mid:[0,155,190],  dim:[0,60,90]   },
  processing: { peak:[170,150,255], mid:[100,85,200], dim:[40,32,100] },
  speaking:   { peak:[255,245,200], mid:[220,185,90], dim:[140,105,30]},
};

const lerp  = (a, b, t) => a + (b - a) * t;
const lerpC = (a, b, t) => [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)];
const rgb   = (c, a = 1) => `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;

const PTS = 100;

export default function LucyPulseCanvas({ state = "idle", isListening = false }) {
  const canvasRef = useRef(null);
  const micLevel = useMicrophoneLevel(isListening);
  const { level: ttsLevel, waveform } = useAudioLevelFromTTS();
  const micRef      = useRef(0);
  const ttsRef      = useRef(0);
  const waveformRef = useRef(null);
  const stateRef    = useRef(state);

  useEffect(() => { micRef.current = micLevel; },      [micLevel]);
  useEffect(() => { ttsRef.current = ttsLevel; },      [ttsLevel]);
  useEffect(() => { waveformRef.current = waveform; }, [waveform]);
  useEffect(() => { stateRef.current = state; },       [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H;
    let time = 0, amp = 0.06, targetAmp = 0.06, procT = 0;
    let animId;
    let curPeak = [...STATE_COLORS.idle.peak];
    let curMid  = [...STATE_COLORS.idle.mid];
    let curDim  = [...STATE_COLORS.idle.dim];

    const partPools = {};
    LINES.forEach(l => {
      if (l.hasParticles) {
        partPools[l.id] = Array.from({ length: 18 }, () => ({
          nx: Math.random(), life: Math.random(),
          sz: Math.random() * 1.4 + 0.4,
          vx: (Math.random() - 0.5) * 0.0003,
        }));
      }
    });

    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width  = r.width  * devicePixelRatio;
      canvas.height = r.height * devicePixelRatio;
      W = r.width;
      H = r.height;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    function getLineY(line, nx, t, spdMul) {
      let y = 0;
      for (let i = 0; i < line.freq.length; i++) {
        y += Math.sin(nx * line.freq[i] * Math.PI * 2 + t * line.spd[i] * spdMul + line.phase[i]) / (i + 1);
      }
      y = y * 0.55;
      const wf = waveformRef.current;
      if (stateRef.current === 'speaking' && wf && wf.length > 0) {
        const idx = Math.floor(nx * wf.length) % wf.length;
        y = y * 0.65 + wf[idx] * 0.35 * Math.sign(line.ampMul);
      }
      return (line.yBase + y * amp * line.ampMul) * H;
    }

    function buildPoints(line, spdMul) {
      const pts = [];
      for (let i = 0; i <= PTS; i++) {
        const nx = i / PTS;
        pts.push({ x: nx * W, y: getLineY(line, nx, time, spdMul), nx });
      }
      return pts;
    }

    function drawLine(line, spdMul) {
      const pts = buildPoints(line, spdMul);
      let minY = Infinity, maxY = -Infinity;
      for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
      const yRange = maxY - minY || 1;
      const cm   = COLOR_THEMES[line.colorMode];
      const peak = lerpC(cm.peak, curPeak, 0.5);
      const mid  = lerpC(cm.mid,  curMid,  0.5);
      const dim  = lerpC(cm.dim,  curDim,  0.5);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i+1].x) / 2;
        const my = (pts[i].y + pts[i+1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);

      const grad = ctx.createLinearGradient(0, 0, W, 0);
      for (let i = 0; i <= 10; i++) {
        const nx   = i / 10;
        const pidx = Math.min(PTS - 1, Math.floor(nx * PTS));
        const t    = line.ampMul >= 0
          ? 1 - (pts[pidx].y - minY) / yRange
          : (pts[pidx].y - minY) / yRange;
        let col;
        if      (t < 0.40) col = lerpC(dim,  mid,  t / 0.40);
        else if (t < 0.78) col = lerpC(mid,  peak, (t - 0.40) / 0.38);
        else               col = lerpC(peak, [255,255,255], (t - 0.78) / 0.22);
        grad.addColorStop(nx, rgb(col, 0.25 + t * 0.75));
      }

      const volBoost = stateRef.current === 'speaking'
        ? 1 + ttsRef.current * 2.0
        : stateRef.current === 'listening'
          ? 1 + micRef.current * 1.5
          : 1;

      ctx.strokeStyle = grad;
      ctx.lineWidth   = line.width * (0.7 + amp * 3.5) * volBoost;
      ctx.shadowColor = rgb(peak, 0.6);
      ctx.shadowBlur  = line.id === 'A' ? 18 + amp * 30 : ['G','H'].includes(line.id) ? 12 : 6;
      ctx.stroke();
      ctx.restore();

      if (line.hasParticles && amp > 0.08) {
        const pool = partPools[line.id];
        for (const p of pool) {
          p.nx  += p.vx + 0.0006;
          if (p.nx > 1 || p.nx < 0) { p.nx = Math.random(); p.life = Math.random() * 0.5 + 0.3; }
          p.life -= 0.004 + Math.random() * 0.003;
          if (p.life <= 0) { p.nx = Math.random(); p.life = 0.4 + Math.random() * 0.6; p.sz = Math.random() * 1.6 + 0.4; }
          const py   = getLineY(line, p.nx, time, spdMul);
          const pidx = Math.min(PTS - 1, Math.floor(p.nx * PTS));
          const t2   = line.ampMul >= 0
            ? 1 - (pts[pidx]?.y - minY) / yRange
            : (pts[pidx]?.y - minY) / yRange;
          const a = p.life * Math.min(1, amp / 0.12) * (0.4 + t2 * 0.6);
          if (a < 0.05) continue;
          ctx.save();
          ctx.shadowColor = rgb(peak);
          ctx.shadowBlur  = 8 + p.sz * 4;
          ctx.globalAlpha = a;
          ctx.fillStyle   = rgb(lerpC(mid, peak, t2));
          ctx.beginPath();
          ctx.arc(p.nx * W, py + (line.particleOffset || 0) * p.sz * 2, p.sz, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    function draw() {
      time += 0.016;
      const s  = stateRef.current;
      const sc = STATE_CFG[s] || STATE_CFG.idle;
      if (s === 'listening') {
        targetAmp = sc.amp * (0.4 + micRef.current * 0.6);
      } else if (s === 'speaking') {
        targetAmp = sc.amp * (0.35 + ttsRef.current * 0.65);
      } else if (s === 'processing') {
        procT    += 0.07;
        targetAmp = sc.amp + Math.sin(procT) * 0.08;
      } else {
        targetAmp = sc.amp;
      }
      amp = lerp(amp, targetAmp, 0.06);
      const audioLevel = s === 'speaking' ? ttsRef.current : s === 'listening' ? micRef.current : 0;
      const spdMul = sc.spdMul * (1 + audioLevel * 0.7);
      const cc = STATE_COLORS[s] || STATE_COLORS.idle;
      const f  = 0.04;
      curPeak = lerpC(curPeak, cc.peak, f);
      curMid  = lerpC(curMid,  cc.mid,  f);
      curDim  = lerpC(curDim,  cc.dim,  f);
      ctx.clearRect(0, 0, W, H);
      for (const id of DRAW_ORDER) {
        const line = LINES.find(l => l.id === id);
        if (line) drawLine(line, spdMul);
      }
      animId = requestAnimationFrame(draw);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
