import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroImage from '../assets/Lucy.png';

const LUCY_PRESENTATION =
  "Hola, soy Lucy, tu secretaria ejecutiva y asistente personal impulsada por inteligencia artificial. Voy a ayudarte a organizar tu día, gestionar tus correos, tus hábitos y liberar tu mente para lo que realmente importa. ¿Por dónde empezamos?";

/* ─── Golden particles canvas ────────────────────────── */
function GoldParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.2 - 0.1,
        opacity: Math.random() * 0.5 + 0.1,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;
        p.pulse += 0.015;
        const o = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));

        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,178,124,${o})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,178,124,${o * 0.15})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.7,
      }}
    />
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const mxRef = useRef(0);
  const myRef = useRef(0);
  const rxRef = useRef(0);
  const ryRef = useRef(0);
  const rafRef = useRef(null);
  const audioRef = useRef(null);
  const [micState, setMicState] = useState('idle');

  const handleMicClick = async () => {
    if (micState === 'loading') return;

    if (micState === 'playing') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis?.cancel();
      setMicState('idle');
      return;
    }

    setMicState('loading');

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('https://lucy.syntexia-solutions.es/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: LUCY_PRESENTATION }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setMicState('idle');
          audioRef.current = null;
          URL.revokeObjectURL(url);
        };
        await audio.play();
        setMicState('playing');
      } else {
        throw new Error('TTS failed');
      }
    } catch {
      console.error('TTS unavailable');
      setMicState('idle');
    }
  };

  useEffect(() => {
    const cursor = cursorRef.current;
    const ring = ringRef.current;
    if (!cursor || !ring) return;

    const onMove = (e) => {
      mxRef.current = e.clientX;
      myRef.current = e.clientY;
      cursor.style.left = e.clientX - 4 + 'px';
      cursor.style.top = e.clientY - 4 + 'px';
    };

    const animateRing = () => {
      rxRef.current += (mxRef.current - rxRef.current - 16) * 0.12;
      ryRef.current += (myRef.current - ryRef.current - 16) * 0.12;
      ring.style.left = rxRef.current + 'px';
      ring.style.top = ryRef.current + 'px';
      rafRef.current = requestAnimationFrame(animateRing);
    };

    document.addEventListener('mousemove', onMove);
    rafRef.current = requestAnimationFrame(animateRing);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.opacity = '1';
            e.target.style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.feature-card, blockquote, .pricing-card').forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      observer.observe(el);
    });

    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={cursorRef} className="lp-cursor" />
      <div ref={ringRef} className="lp-cursor-ring" />

      <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Plus+Jakarta+Sans:wght@200;300;400;500&display=swap');

      .lp-wrap * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      .lp-wrap {
        --black: #030305;
        --gold: #C9B27C;
        --silver: #ffffff;
        --gray: rgba(255,255,255,0.6);
        background: var(--black);
        color: var(--silver);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-weight: 300;
        overflow-x: hidden;
        min-height: 100vh;
        position: relative;
      }
      
      .lp-cursor {
        position: fixed;
        width: 8px;
        height: 8px;
        background: var(--gold);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        mix-blend-mode: difference;
      }
      
      .lp-cursor-ring {
        position: fixed;
        width: 32px;
        height: 32px;
        border: 1px solid rgba(201,178,124,0.3);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9998;
      }
      
      /* ══ NAV ══ */
      .lp-nav {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        padding: 2.5rem 10%;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .lp-nav-links {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        gap: 2.8rem;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      
      .lp-nav-links li {
        display: flex;
        align-items: center;
      }
      
      .lp-nav-links a {
        text-decoration: none;
        font-size: 0.7rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #EAF4FF;
        transition: 0.3s;
        white-space: nowrap;
      }
      
      .lp-nav-links a:hover {
        color: #FFFFFF;
      }
      
      .lp-logo {
        font-family: 'Cormorant Garamond', serif;
        font-size: 2rem;
        letter-spacing: 0.2em;
        color: #9FCCFF;
        cursor: pointer;
        text-shadow: 0 0 12px rgba(120,190,255,0.28), 0 0 28px rgba(54,126,255,0.20), 0 0 48px rgba(54,126,255,0.12);
        transition: color .28s ease, text-shadow .28s ease, transform .28s ease;
      }
      
      .lp-logo span {
        color: #CBE4FF;
        text-shadow: 0 0 14px rgba(120,190,255,0.34), 0 0 30px rgba(54,126,255,0.24);
      }
      
      .lp-logo:hover {
        color: #DDF0FF;
        text-shadow: 0 0 16px rgba(120,190,255,0.34), 0 0 34px rgba(54,126,255,0.24), 0 0 56px rgba(54,126,255,0.16);
        transform: translateY(-1px);
      }
      
      .lp-nav-cta {
        padding: 0.78rem 1.75rem;
        border: 1px solid rgba(88,160,255,0.42);
        border-radius: 999px;
        color: #EAF4FF;
        background: linear-gradient(180deg, rgba(7,12,24,0.92) 0%, rgba(4,8,18,0.88) 100%);
        font-size: 0.68rem;
        font-weight: 500;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        position: relative;
        box-shadow: 0 0 0 1px rgba(90,170,255,0.10) inset, 0 0 10px rgba(54,126,255,0.22), 0 0 22px rgba(54,126,255,0.18);
        transition: border-color .28s ease, box-shadow .28s ease, transform .28s ease, color .28s ease, background .28s ease;
      }
      
      .lp-nav-cta:hover {
        border-color: rgba(201,178,124,0.88);
        color: #FFF7E8;
        background: linear-gradient(180deg, rgba(24,18,10,0.96) 0%, rgba(14,10,6,0.92) 100%);
        box-shadow: 0 0 0 1px rgba(201,178,124,0.14) inset, 0 0 14px rgba(201,178,124,0.26), 0 0 30px rgba(201,178,124,0.20), 0 0 52px rgba(201,178,124,0.14);
        transform: translateY(-1px);
      }
      
      .lp-nav-cta:active {
        transform: translateY(0);
      }
      
      /* ══ HERO ══ */
      .lp-hero {
        height: 100vh;
        display: flex;
        align-items: center;
        padding: 0 10%;
        position: relative;
        z-index: 10;
      }
      
      .hero-img-container {
        position: absolute;
        right: 0;
        top: 0;
        width: 75%;
        height: 100%;
        z-index: 1;
      }
      
      .hero-img {
        object-position: 78% center;
        width: 100%;
        height: 100%;
        object-fit: cover;
        mask-image: linear-gradient(to left, black 65%, transparent 100%);
        opacity: 0.9;
      }
      
      .hero-content {
        position: relative;
        z-index: 10;
        max-width: 600px;
      }
      
      .lp-h1 {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(2.8rem,6vw,4.5rem);
        line-height: 1;
        font-weight: 300;
        margin-bottom: 1.5rem;
      }
      
      .lp-h1 em {
        font-style: italic;
        color: var(--gold);
      }
      
      .hero-subtext {
        font-size: 1.1rem;
        line-height: 1.65;
        color: var(--gray);
        margin-bottom: 3rem;
        max-width: 400px;
      }
      
      .btn-main {
        padding: 0.78rem 1.75rem;
        border: 1px solid rgba(88,160,255,0.42);
        border-radius: 999px;
        color: #EAF4FF;
        background: linear-gradient(180deg, rgba(7,12,24,0.92) 0%, rgba(4,8,18,0.88) 100%);
        font-size: 0.68rem;
        font-weight: 500;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        position: relative;
        box-shadow: 0 0 0 1px rgba(90,170,255,0.10) inset, 0 0 10px rgba(54,126,255,0.22), 0 0 22px rgba(54,126,255,0.18);
        transition: border-color .28s ease, box-shadow .28s ease, transform .28s ease, color .28s ease, background .28s ease;
      }
      
      .btn-main:hover {
        border-color: rgba(201,178,124,0.88);
        color: #FFF7E8;
        background: linear-gradient(180deg, rgba(24,18,10,0.96) 0%, rgba(14,10,6,0.92) 100%);
        box-shadow: 0 0 0 1px rgba(201,178,124,0.14) inset, 0 0 14px rgba(201,178,124,0.26), 0 0 30px rgba(201,178,124,0.20), 0 0 52px rgba(201,178,124,0.14);
        transform: translateY(-1px);
      }
      
      /* ══ SECTIONS ══ */
      .section-padding {
        padding: 8rem 10%;
        position: relative;
        z-index: 2;
      }
      
      .label {
        color: var(--gold);
        text-transform: uppercase;
        letter-spacing: 0.4em;
        font-size: 0.7rem;
        margin-bottom: 2rem;
        display: block;
      }
      
      .lp-wave {
        width: 1px;
        height: 100px;
        background: linear-gradient(to bottom, transparent, rgba(201,178,124,0.3), transparent);
        margin: 0 auto;
      }
      
      /* ══ VOICE DEMO ══ */
      .lp-voice {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3rem;
        background: #030305;
      }
      
      .lp-voice-circle {
        position: relative;
        width: 220px;
        height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      
      .lp-voice-ring {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
      }
      
      .lp-voice-ring:nth-child(1) {
        width: 100%;
        height: 100%;
        border: 1px solid rgba(88,160,255,0.16);
        box-shadow: 0 0 24px rgba(54,126,255,0.10), inset 0 0 18px rgba(54,126,255,0.05);
        animation: lpOrbPulse 4.2s ease-in-out infinite;
      }
      
      .lp-voice-ring:nth-child(2) {
        width: 74%;
        height: 74%;
        border: 1px solid rgba(118,186,255,0.20);
        box-shadow: 0 0 18px rgba(88,160,255,0.14), inset 0 0 12px rgba(88,160,255,0.08);
        animation: lpOrbPulse 3.4s ease-in-out infinite reverse;
      }
      
      .lp-voice-ring:nth-child(3) {
        width: 48%;
        height: 48%;
        border: 1px solid rgba(160,215,255,0.22);
        box-shadow: 0 0 14px rgba(118,186,255,0.18), inset 0 0 10px rgba(118,186,255,0.10);
        animation: lpOrbPulse 2.8s ease-in-out infinite;
      }
      
      @keyframes lpOrbPulse {
        0%,100% { transform: scale(1); opacity: 0.42; }
        50% { transform: scale(1.06); opacity: 0.88; }
      }
      
      .lp-voice-center {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        background: radial-gradient(circle at 35% 30%, rgba(170,220,255,0.95) 0%, rgba(88,160,255,0.82) 22%, rgba(32,84,190,0.52) 48%, rgba(8,18,42,0.94) 100%);
        border: 1px solid rgba(160,215,255,0.38);
        box-shadow: 0 0 18px rgba(88,160,255,0.30), 0 0 42px rgba(54,126,255,0.22), inset 0 0 18px rgba(255,255,255,0.10);
        transition: transform .3s ease, box-shadow .3s ease, border-color .3s ease;
        overflow: hidden;
      }
      
      .lp-voice-center::before {
        content: '';
        position: absolute;
        inset: 10px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(215,240,255,0.92) 0%, rgba(120,190,255,0.34) 38%, rgba(12,22,46,0) 72%);
        filter: blur(2px);
        opacity: 0.95;
      }
      
      .lp-voice-center::after {
        content: '';
        position: absolute;
        width: 120%;
        height: 120%;
        border-radius: 50%;
        background: conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(170,220,255,0.22) 90deg, rgba(255,255,255,0) 180deg, rgba(88,160,255,0.18) 270deg, rgba(255,255,255,0) 360deg);
        animation: lpOrbRotate 8s linear infinite;
        mix-blend-mode: screen;
        opacity: 0.65;
      }
      
      @keyframes lpOrbRotate {
        to { transform: rotate(360deg); }
      }
      
      .lp-voice-circle:hover .lp-voice-center {
        transform: scale(1.04);
        border-color: rgba(188,228,255,0.62);
        box-shadow: 0 0 22px rgba(118,186,255,0.38), 0 0 56px rgba(54,126,255,0.28), inset 0 0 22px rgba(255,255,255,0.14);
      }
      
      .lp-voice-circle.playing .lp-voice-center {
        animation: lpOrbSpeaking 1.2s ease-in-out infinite;
        border-color: rgba(201,178,124,0.58);
        box-shadow: 0 0 26px rgba(118,186,255,0.42), 0 0 70px rgba(54,126,255,0.30), 0 0 24px rgba(201,178,124,0.14), inset 0 0 24px rgba(255,255,255,0.16);
      }
      
      .lp-voice-circle.playing .lp-voice-ring:nth-child(1) {
        border-color: rgba(201,178,124,0.20);
        box-shadow: 0 0 28px rgba(54,126,255,0.14), 0 0 18px rgba(201,178,124,0.08);
        animation-duration: 2.2s;
      }
      
      .lp-voice-circle.playing .lp-voice-ring:nth-child(2) {
        border-color: rgba(160,215,255,0.28);
        animation-duration: 1.8s;
      }
      
      .lp-voice-circle.playing .lp-voice-ring:nth-child(3) {
        border-color: rgba(201,178,124,0.28);
        animation-duration: 1.4s;
      }
      
      @keyframes lpOrbSpeaking {
        0%,100% { transform: scale(1); }
        30% { transform: scale(1.06); }
        60% { transform: scale(0.98); }
      }
      
      .lp-voice-hint {
        font-size: 0.68rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(234,244,255,0.42);
        text-align: center;
        margin-top: -1.2rem;
        transition: color .28s ease;
      }
      
      .lp-voice-hint.playing {
        color: rgba(201,178,124,0.78);
      }
      
      .lp-conversation {
        max-width: 600px;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }
      
      .lp-msg {
        border-left: 1px solid rgba(201,178,124,0.2);
        padding-left: 2rem;
      }
      
      .lp-msg-who {
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--gold);
        margin-bottom: 0.5rem;
        display: block;
      }
      
      .lp-msg-text {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.3rem;
        font-weight: 300;
        line-height: 1.5;
      }
      
      /* ══ FEATURES ══ */
      .lp-features-grid {
        display: grid;
        grid-template-columns: repeat(3,1fr);
        gap: 1.15rem;
        background: transparent;
        margin-top: 4rem;
      }
      
      .feature-card {
        background: linear-gradient(180deg, rgba(7,12,24,0.92) 0%, rgba(4,8,18,0.88) 100%);
        padding: 4rem 2.5rem;
        transition: border-color .28s ease, box-shadow .28s ease, transform .28s ease, background .28s ease;
        border: 1px solid rgba(88,160,255,0.24);
        border-radius: 24px;
        box-shadow: 0 0 0 1px rgba(90,170,255,0.08) inset, 0 0 10px rgba(54,126,255,0.10), 0 0 22px rgba(54,126,255,0.08);
      }
      
      .feature-card:hover {
        background: linear-gradient(180deg, rgba(24,18,10,0.96) 0%, rgba(14,10,6,0.92) 100%);
        border-color: rgba(201,178,124,0.72);
        box-shadow: 0 0 0 1px rgba(201,178,124,0.12) inset, 0 0 14px rgba(201,178,124,0.18), 0 0 30px rgba(201,178,124,0.14), 0 0 52px rgba(201,178,124,0.10);
        transform: translateY(-3px);
      }
      
      .lp-feature-num {
        font-family: 'Cormorant Garamond', serif;
        font-size: 3rem;
        color: rgba(88,160,255,0.42);
        margin-bottom: 1.5rem;
        transition: color .28s ease;
      }
      
      .feature-card:hover .lp-feature-num {
        color: rgba(201,178,124,0.78);
      }
      
      .lp-feature-title {
        font-size: 0.8rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-bottom: 1rem;
        color: #F4F8FF;
        transition: color .28s ease;
      }
      
      .feature-card:hover .lp-feature-title {
        color: #FFF7E8;
      }
      
      .lp-feature-desc {
        font-size: 0.9rem;
        color: rgba(234,244,255,0.68);
        line-height: 1.7;
        transition: color .28s ease;
      }
      
      .feature-card:hover .lp-feature-desc {
        color: rgba(255,247,232,0.78);
      }
      
      .lp-features-header {
        text-align: center;
        margin-bottom: 4.5rem;
      }
      
      .lp-features-headline {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(2.1rem,4.2vw,3.8rem);
        font-weight: 300;
        line-height: 1.15;
        letter-spacing: -0.02em;
        color: #F3F7FF;
        text-align: center;
        margin: 0 auto;
        max-width: 1180px;
      }
      
      .lp-features-headline em {
        font-style: italic;
        color: var(--gold);
      }
      
      /* ══ QUOTE ══ */
      .lp-quote {
        text-align: center;
        padding: 8rem 10%;
        background: #030305;
      }
      
      .lp-quote-mark {
        display: block;
        font-family: 'Cormorant Garamond', serif;
        font-size: 7rem;
        line-height: 0.7;
        color: rgba(255,255,255,0.08);
        margin-bottom: 1.2rem;
      }
      
      .lp-quote blockquote {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(1.6rem,3.1vw,2.9rem);
        font-style: italic;
        font-weight: 300;
        line-height: 1.55;
        color: #F3F7FF;
        max-width: 1120px;
        margin: 0 auto;
      }
      
      /* ══ PRICING ══ */
      .lp-pricing-header {
        text-align: center;
        max-width: 860px;
        margin: 0 auto 3.8rem;
      }
      
      .lp-pricing-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(2.8rem, 5vw, 4.8rem);
        font-weight: 300;
        line-height: 1;
        color: #F4F7FF;
        margin-bottom: 1rem;
      }
      
      .lp-pricing-subtitle {
        color: rgba(228,238,255,0.55);
        font-size: 1rem;
        line-height: 1.75;
        max-width: 700px;
        margin: 0 auto;
      }
      
      .lp-bundle-note {
        margin: 1.8rem auto 0;
        padding: 1.2rem 1.6rem;
        max-width: 760px;
        border-radius: 22px;
        border: 1px solid rgba(88,160,255,0.16);
        background: linear-gradient(180deg, rgba(8,14,28,0.82) 0%, rgba(4,8,18,0.78) 100%);
        box-shadow: inset 0 0 0 1px rgba(90,170,255,0.05), 0 0 18px rgba(54,126,255,0.08);
      }
      
      .lp-bundle-note p {
        margin: 0;
        color: rgba(231,241,255,0.72);
        line-height: 1.65;
      }
      
      .lp-bundle-note strong {
        color: var(--gold);
        font-weight: 600;
      }
      
      .lp-pricing-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 22px;
        margin-top: 4rem;
      }
      
      .pricing-card {
        background: linear-gradient(180deg, rgba(5,10,20,0.94) 0%, rgba(3,6,12,0.97) 100%);
        padding: 3rem 2.25rem;
        text-align: left;
        border-radius: 28px;
        border: 1px solid rgba(88,160,255,0.16);
        box-shadow: inset 0 0 0 1px rgba(90,170,255,0.04), 0 0 18px rgba(20,72,180,0.08);
        transition: transform .28s ease, border-color .28s ease, box-shadow .28s ease;
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      
      .pricing-card:hover {
        transform: translateY(-3px);
        border-color: rgba(110,180,255,0.28);
        box-shadow: inset 0 0 0 1px rgba(90,170,255,0.06), 0 0 22px rgba(36,92,210,0.12);
      }
      
      .pricing-card.featured {
        background: linear-gradient(180deg, rgba(10,12,18,0.96) 0%, rgba(8,9,14,0.98) 100%);
        border: 1px solid rgba(201,178,124,0.34);
        box-shadow: inset 0 0 0 1px rgba(201,178,124,0.05), 0 0 24px rgba(201,178,124,0.08);
      }
      
      .pricing-card.featured:hover {
        border-color: rgba(201,178,124,0.50);
        box-shadow: inset 0 0 0 1px rgba(201,178,124,0.06), 0 0 30px rgba(201,178,124,0.12);
      }
      
      .lp-plan-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid rgba(201,178,124,0.24);
        background: rgba(201,178,124,0.07);
        color: var(--gold);
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        border-radius: 999px;
        padding: 0.7rem 1rem;
        margin-bottom: 1.4rem;
      }
      
      .lp-plan-name {
        color: #F7FAFF;
        font-size: 2rem;
        line-height: 1;
        font-weight: 600;
        letter-spacing: -0.03em;
        margin-bottom: 1rem;
      }
      
      .lp-pricing-price {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(3rem, 4.5vw, 4.4rem);
        line-height: 0.95;
        font-weight: 300;
        color: #F4F7FF;
        letter-spacing: -0.04em;
        margin: 0 0 2rem;
      }
      
      .lp-pricing-price span {
        font-size: 1.15rem;
        color: rgba(244,247,255,0.34);
        margin-left: 0.25rem;
      }
      
      .lp-pricing-features {
        list-style: none;
        margin: 0 0 2rem;
        font-size: 0.95rem;
        color: rgba(226,239,255,0.66);
        line-height: 1.7;
        display: flex;
        flex-direction: column;
        gap: 0.95rem;
        flex: 1;
      }
      
      .lp-pricing-features li::before {
        content: "— ";
        color: var(--gold);
      }
      
      .lp-pricing-button-featured {
        width: 100%;
        border: 1px solid rgba(201,178,124,0.78);
        color: #17120A;
        background: linear-gradient(180deg, rgba(214,193,137,1) 0%, rgba(201,178,124,1) 100%);
        box-shadow: inset 0 0 0 1px rgba(255,248,220,0.10), 0 0 12px rgba(201,178,124,0.18), 0 0 30px rgba(201,178,124,0.10);
      }
      
      .lp-pricing-button-featured:hover {
        color: #17120A;
        border-color: rgba(201,178,124,0.88);
        background: linear-gradient(180deg, rgba(220,199,143,1) 0%, rgba(201,178,124,1) 100%);
      }
      
      /* ══ FOOTER ══ */
      .lp-footer {
        padding: 4rem 10%;
        border-top: 1px solid rgba(255,255,255,0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      @media (max-width: 1024px) {
        .lp-nav {
          padding: 2rem 6%;
        }
      
        .lp-nav-links {
          gap: 1.4rem;
        }
      
        .lp-hero {
          padding: 0 6%;
        }
      
        .lp-features-grid {
          grid-template-columns: 1fr 1fr;
        }
      
        .lp-pricing-grid {
          grid-template-columns: 1fr;
        }
      
        .section-padding,
        .lp-quote,
        .lp-footer {
          padding-left: 6%;
          padding-right: 6%;
        }
      }
      
      @media (max-width: 768px) {
        .lp-features-grid {
          grid-template-columns: 1fr;
        }
      
        .lp-nav {
          padding: calc(1rem + env(safe-area-inset-top)) 5% 1rem;
        }
      
        .lp-nav-links {
          gap: 0.75rem;
        }
      
        .lp-nav-links a {
          display: none;
        }
      
        .lp-nav-cta {
          padding: 0.77rem 1.15rem;
          font-size: 0.62rem;
          letter-spacing: 0.12em;
        }
      
        .lp-hero {
          min-height: 100svh;
          height: auto;
          padding: calc(7.5rem + env(safe-area-inset-top)) 6% 4rem;
          align-items: flex-start;
        }
      
        .hero-img-container {
          width: 100%;
          height: 100%;
          opacity: 0.4;
        }
      
        .hero-img {
          object-fit: cover;
          object-position: center top;
          mask-image: linear-gradient(to left, black 52%, transparent 100%);
          -webkit-mask-image: linear-gradient(to left, black 52%, transparent 100%);
        }
      
        .hero-content {
          max-width: 100%;
        }
      
        .lp-h1 {
          font-size: clamp(2.5rem, 12vw, 4rem);
          line-height: 0.96;
          margin-bottom: 1rem;
        }
      
        .hero-subtext {
          font-size: 0.98rem;
          line-height: 1.65;
          max-width: 100%;
          margin-bottom: 2rem;
        }
      
        .section-padding {
          padding: 6rem 5%;
        }
      
        .lp-footer {
          flex-direction: column;
          gap: 1rem;
          text-align: center;
          padding-left: 5%;
          padding-right: 5%;
        }
      }      
      `}</style>

      <div className="lp-wrap">
        <GoldParticles />

        <nav className="lp-nav">
          <div
            className="lp-logo"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            LUCY<span>.</span>
          </div>

          <ul className="lp-nav-links">
            <li><a href="#features">Funciones</a></li>
            <li><a href="#pricing">Planes</a></li>
            <li>
              <button
                className="lp-nav-cta"
                style={{ width: '100%', marginTop: 'auto' }}
                onClick={() => navigate('/pricing')}
              >
                Acceder
              </button>
            </li>
          </ul>
        </nav>

        <section className="lp-hero">
          <div className="hero-content">
            <h1 className="lp-h1">
              La asistente<br />
              que transforma<br />
              tu <em>día.</em>
            </h1>

            <p className="hero-subtext">
              Secretaría ejecutiva e inteligencia personal diseñada para el máximo enfoque.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                position: 'relative',
                zIndex: 20,
              }}
            >
              <button
                type="button"
                className="btn-main"
                onClick={() => navigate('/pricing')}
              >
                Probar gratis 4 horas
              </button>
            </div>
          </div>

          <div className="hero-img-container">
            <img src={HeroImage} alt="Lucy Asistente" className="hero-img" />
          </div>
        </section>

        <div className="lp-wave" />

        <section className="section-padding lp-voice" id="demo">
          <span className="label">Experiencia de voz</span>

          <div
            className={`lp-voice-circle${micState === 'playing' ? ' playing' : ''}`}
            onClick={handleMicClick}
          >
            <div className="lp-voice-ring" />
            <div className="lp-voice-ring" />
            <div className="lp-voice-ring" />

            <div className="lp-voice-center">
              {micState === 'playing' ? (
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.95)',
                    boxShadow: '0 0 18px rgba(255,255,255,0.45)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'rgba(220,240,255,0.9)',
                    boxShadow: '0 0 14px rgba(118,186,255,0.35)',
                  }}
                />
              )}
            </div>
          </div>

          <p className={`lp-voice-hint${micState === 'playing' ? ' playing' : ''}`}>
            {micState === 'idle' && 'Pulsa para conocer a Lucy'}
            {micState === 'loading' && 'Lucy se está preparando...'}
            {micState === 'playing' && 'Pulsa para detener'}
          </p>

          <div className="lp-conversation">
            <div className="lp-msg">
              <span className="lp-msg-who">Tú</span>
              <div className="lp-msg-text">"Lucy, buenos días."</div>
            </div>

            <div className="lp-msg">
              <span className="lp-msg-who" style={{ color: 'var(--gold)' }}>Lucy</span>
              <div className="lp-msg-text">
                "Hola. Soy Lucy. Inteligencia ejecutiva diseñada para aportar claridad, orden y enfoque a tu día. Cuando quieras, empezamos."
              </div>
            </div>

            <div className="lp-msg">
              <span className="lp-msg-who">Tú</span>
              <div className="lp-msg-text">"Perfecto. Empecemos."</div>
            </div>
          </div>
        </section >

        <div className="lp-wave" />

        <section className="section-padding" id="features">
          <div className="lp-features-header">
            <span className="label">Capacidades</span>
            <h2 className="lp-features-headline">
              Una nueva forma de gestionar tu tiempo,
              <br />
              <em>tu trabajo y tu vida personal.</em>
            </h2>
          </div>

          <div className="lp-features-grid">
            {[
              ['01', 'Briefing Matutino', 'Lucy te resume lo esencial: correos, reuniones y tareas sin abrir el ordenador.'],
              ['02', 'Correo Inteligente', 'Lee, resume y prioriza emails por voz. Lucy aprende tu estilo de respuesta.'],
              ['03', 'Gestión de Agenda', 'Crea y mueve reuniones de forma natural. Sincronización total en tiempo real.'],
              ['04', 'Memoria Personal', 'Recuerda contactos, ideas y notas importantes. Todo accesible al instante.'],
              ['05', 'Hábitos y Salud', 'Seguimiento de hidratación, ejercicio y pausas. Lucy cuida de tu racha diaria.'],
              ['06', 'Manos Libres', 'Diseñada para operar mientras conduces, caminas o cocinas. Solo tu voz.'],
            ].map(([num, title, desc]) => (
              <div className="feature-card" key={num}>
                <div className="lp-feature-num">{num}</div>
                <div className="lp-feature-title">{title}</div>
                <p className="lp-feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-quote">
          <span className="lp-quote-mark">"</span>
          <blockquote>
            En un mundo saturado de notificaciones, Lucy representa una nueva forma de relacionarse con la tecnología.
            Más natural. Más humana. Profundamente orientada a la eficiencia.
          </blockquote>
        </section>

        <section className="section-padding" id="pricing">
          <div className="lp-pricing-header">
            <span className="label">Planes</span>
            <h2 className="lp-pricing-title">Invierte en tu tiempo.</h2>
            <p className="lp-pricing-subtitle">
              Elige el nivel de asistencia que necesitas para ganar claridad, foco y ejecución en tu día a día.
            </p>

            <div className="lp-bundle-note">
              <p>
                <strong>Lucy Completa</strong> — Ambos productos desde <strong>€25/mes</strong> con 25% de descuento
              </p>
            </div>
          </div>

          <div className="lp-pricing-grid">
            <div className="pricing-card">
              <div className="lp-plan-name">Básico</div>
              <div className="lp-pricing-price">19€<span>/mes</span></div>
              <ul className="lp-pricing-features">
                <li>Briefing matutino con IA</li>
                <li>Priorización inteligente de emails</li>
                <li>Resúmenes de correo</li>
                <li>1 cuenta de email</li>
              </ul>
              <button
                className="lp-nav-cta"
                style={{ width: '100%', marginTop: 'auto' }}
                onClick={() => navigate('/pricing')}
              >
                Comenzar ahora
              </button>
            </div>

            <div className="pricing-card featured">
              <div className="lp-plan-badge">Más popular</div>
              <div className="lp-plan-name">Pro</div>
              <div className="lp-pricing-price">29€<span>/mes</span></div>
              <ul className="lp-pricing-features">
                <li>Briefing matutino con IA</li>
                <li>Priorización inteligente de emails</li>
                <li>Resúmenes de correo</li>
                <li>1 cuenta de email</li>
                <li>Integración Google Calendar</li>
                <li>Gestión de tareas</li>
                <li>Comandos de voz (Hola Lucy)</li>
              </ul>
              <button
                className="lp-nav-cta lp-pricing-button-featured"
                style={{ width: '100%', marginTop: 'auto' }}
                onClick={() => navigate('/pricing')}
              >
                Elegir plan
              </button>
            </div>

            <div className="pricing-card">
              <div className="lp-plan-name">Business</div>
              <div className="lp-pricing-price">49€<span>/mes</span></div>
              <ul className="lp-pricing-features">
                <li>Briefing matutino con IA</li>
                <li>Priorización inteligente de emails</li>
                <li>Resúmenes de correo</li>
                <li>1 cuenta de email</li>
                <li>Integración Google Calendar</li>
                <li>Gestión de tareas</li>
                <li>Comandos de voz (Hola Lucy)</li>
                <li>Hasta 3 cuentas de email</li>
                <li>CRM de contactos inteligente</li>
                <li>Respuestas automáticas</li>
              </ul>
              <button
                className="lp-nav-cta"
                style={{ width: '100%', marginTop: 'auto' }}
                onClick={() => navigate('/pricing')}
              >
                Comenzar ahora
              </button>
            </div>
          </div>
        </section>

        <section className="section-padding centered" style={{ paddingBottom: '12rem', textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: 'Cormorant Garamond',
              fontSize: '4.5rem',
              fontWeight: '300',
              marginBottom: '2rem',
            }}
          >
            Tu día empieza con <em>Lucy.</em>
          </h2>
        </section>

        <footer className="lp-footer">
          <div className="lp-logo">LUCY<span>.</span></div>
          <p style={{ fontSize: '0.7rem', color: 'var(--gray)' }}>
            © 2026 Lucy AI · Secretaría Ejecutiva · España
          </p>
        </footer>
      </div >
    </>
  );
}