import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LUCY_PRESENTATION = "Hola, soy Lucy, tu secretaria ejecutiva y asistente personal impulsada por inteligencia artificial. Voy a ayudarte a organizar tu día, gestionar tus correos, tus hábitos y liberar tu mente para lo que realmente importa. ¿Por dónde empezamos?";

/* ─── Golden particles canvas ─────────────────────────── */
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
      particles.forEach(p => {
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

        // Glow
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
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none', opacity: 0.7,
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
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
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
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: LUCY_PRESENTATION }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setMicState('idle'); audioRef.current = null; URL.revokeObjectURL(url); };
        audio.onerror = () => { setMicState('idle'); audioRef.current = null; URL.revokeObjectURL(url); };
        await audio.play();
        setMicState('playing');
      } else { throw new Error('TTS failed'); }
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
      cursor.style.left = (e.clientX - 4) + 'px';
      cursor.style.top = (e.clientY - 4) + 'px';
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

    const interactables = document.querySelectorAll('a, button');
    interactables.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.style.transform = 'scale(2.5)';
        ring.style.transform = 'scale(1.5)';
        ring.style.borderColor = 'rgba(201,178,124,0.8)';
      });
      el.addEventListener('mouseleave', () => {
        cursor.style.transform = 'scale(1)';
        ring.style.transform = 'scale(1)';
        ring.style.borderColor = 'rgba(201,178,124,0.3)';
      });
    });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card, blockquote, .pricing-card').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      observer.observe(el);
    });

    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      if (audioRef.current) { audioRef.current.pause(); }
      window.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <>
      <div ref={cursorRef} className="lp-cursor" />
      <div ref={ringRef} className="lp-cursor-ring" />

      <style>{`
        .lp-wrap * { margin: 0; padding: 0; box-sizing: border-box; }
        .lp-wrap {
          --black: #050508; --deep: #0a0f1a; --surface: #0d1525;
          --ocean: #00B4D8; --ocean-light: #4DD9F0; --ocean-dim: rgba(0,180,216,0.15);
          --gold: #C9B27C; --gold-light: #D4C08A; --gold-dim: rgba(201,178,124,0.15);
          --silver: #E0F7FA; --silver-dim: rgba(224,247,250,0.55); --silver-faint: rgba(224,247,250,0.08);
          background: var(--black); color: var(--silver);
          font-family: 'DM Sans', sans-serif; font-weight: 300;
          overflow-x: hidden; cursor: none; min-height: 100vh;
          position: relative;
        }
        .lp-cursor { position: fixed; width: 8px; height: 8px; background: var(--gold); border-radius: 50%; pointer-events: none; z-index: 9999; transition: transform 0.15s ease; mix-blend-mode: difference; }
        .lp-cursor-ring { position: fixed; width: 32px; height: 32px; border: 1px solid rgba(201,178,124,0.3); border-radius: 50%; pointer-events: none; z-index: 9998; transition: border-color 0.3s, transform 0.3s; }

        /* Subtle noise texture */
        .lp-wrap::before { content: ''; position: fixed; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events: none; z-index: 1; opacity: 0.3; }

        /* ══ NAV ══ */
        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 1.8rem 4rem; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(to bottom, rgba(5,5,8,0.98) 0%, rgba(5,5,8,0.7) 60%, transparent 100%); backdrop-filter: blur(12px); }
        .lp-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.6rem; font-weight: 300; letter-spacing: 0.15em; color: var(--silver); cursor: pointer; }
        .lp-logo span { color: var(--gold); }
        .lp-nav-links { display: flex; align-items: center; gap: 3rem; list-style: none; }
        .lp-nav-links a { text-decoration: none; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--silver-dim); transition: color 0.3s; cursor: none; }
        .lp-nav-links a:hover { color: var(--gold); }
        .lp-nav-cta { padding: 0.6rem 1.8rem !important; border: 1px solid rgba(201,178,124,0.3) !important; color: var(--gold) !important; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; cursor: none; transition: all 0.3s; }
        .lp-nav-cta:hover { background: rgba(201,178,124,0.08) !important; border-color: var(--gold) !important; }

        /* ══ HERO ══ */
        .lp-hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
        .lp-hero-bg { position: absolute; inset: 0; z-index: 0; }
        .lp-hero-img { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; opacity: 0.55; }
        .lp-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(5,5,8,0.5) 0%, rgba(5,5,8,0.2) 30%, rgba(5,5,8,0.6) 70%, rgba(5,5,8,0.98) 100%); }
        .lp-hero-overlay-left { position: absolute; inset: 0; background: linear-gradient(to right, rgba(5,5,8,0.9) 0%, transparent 60%); }
        .lp-hero-content { position: relative; z-index: 2; max-width: 700px; padding: 8rem 4rem 6rem; }
        .lp-eyebrow { font-size: 0.7rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--gold); margin-bottom: 2rem; opacity: 0; animation: lp-fadeUp 0.8s ease 0.2s forwards; }
        .lp-h1 { font-family: 'Cormorant Garamond', serif; font-size: clamp(3.5rem, 8vw, 6rem); font-weight: 300; line-height: 1; letter-spacing: -0.02em; color: var(--silver); opacity: 0; animation: lp-fadeUp 0.9s ease 0.35s forwards; }
        .lp-h1 em { font-style: italic; color: var(--gold); }
        .lp-subtitle { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.1rem, 2vw, 1.5rem); font-weight: 300; font-style: italic; color: var(--silver-dim); margin-top: 1.5rem; margin-bottom: 3.5rem; opacity: 0; animation: lp-fadeUp 0.9s ease 0.5s forwards; }
        .lp-actions { display: flex; gap: 1.5rem; align-items: center; opacity: 0; animation: lp-fadeUp 0.9s ease 0.65s forwards; }
        .lp-btn-primary { padding: 1rem 3rem; background: var(--gold); color: #050508; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; border: none; cursor: none; transition: all 0.3s ease; }
        .lp-btn-primary:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 8px 40px rgba(201,178,124,0.3); }
        .lp-btn-secondary { font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--silver-dim); background: none; border: none; display: flex; align-items: center; gap: 0.5rem; transition: color 0.3s; cursor: none; }
        .lp-btn-secondary:hover { color: var(--gold); }
        .lp-btn-secondary::after { content: '→'; }

        /* ══ DIVIDERS ══ */
        .lp-wave { width: 1px; height: 100px; background: linear-gradient(to bottom, transparent, rgba(201,178,124,0.25), transparent); margin: 0 auto; }
        .lp-section-label { font-size: 0.68rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--gold); text-align: center; }

        /* ══ VOICE DEMO ══ */
        .lp-voice { padding: 8rem 4rem; display: flex; flex-direction: column; align-items: center; gap: 3rem; position: relative; z-index: 2; }
        .lp-voice::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 600px; height: 600px; background: radial-gradient(ellipse, rgba(201,178,124,0.03) 0%, transparent 70%); pointer-events: none; }
        .lp-voice-circle { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; cursor: none; }
        .lp-voice-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(201,178,124,0.15); animation: lp-pulse 3s ease infinite; }
        .lp-voice-ring:nth-child(1) { width: 100%; height: 100%; }
        .lp-voice-ring:nth-child(2) { width: 70%; height: 70%; animation-delay: 0.6s; border-color: rgba(201,178,124,0.25); }
        .lp-voice-ring:nth-child(3) { width: 42%; height: 42%; animation-delay: 1.2s; border-color: rgba(201,178,124,0.4); }
        .lp-voice-circle.playing .lp-voice-ring { animation-duration: 0.9s !important; border-color: rgba(201,178,124,0.5); }
        .lp-voice-center { width: 56px; height: 56px; background: rgba(201,178,124,0.06); border: 1px solid rgba(201,178,124,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1; transition: all 0.3s; }
        .lp-voice-circle:hover .lp-voice-center { background: rgba(201,178,124,0.12); border-color: var(--gold); }
        .lp-voice-circle.playing .lp-voice-center { background: rgba(201,178,124,0.15); border-color: var(--gold); box-shadow: 0 0 30px rgba(201,178,124,0.2); }
        .lp-voice-hint { font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(224,247,250,0.25); text-align: center; transition: color 0.3s; margin-top: -1.5rem; }
        .lp-voice-hint.playing { color: rgba(201,178,124,0.6); }
        .lp-spin { animation: lp-spin-anim 1s linear infinite; }
        @keyframes lp-spin-anim { to { transform: rotate(360deg); } }

        .lp-conversation { max-width: 580px; width: 100%; display: flex; flex-direction: column; gap: 1.5rem; position: relative; z-index: 2; }
        .lp-msg { display: flex; flex-direction: column; gap: 0.4rem; opacity: 0; transform: translateY(10px); animation: lp-fadeUp 0.6s ease forwards; }
        .lp-msg:nth-child(1) { animation-delay: 0.3s; }
        .lp-msg:nth-child(2) { animation-delay: 1s; }
        .lp-msg:nth-child(3) { animation-delay: 1.8s; }
        .lp-msg:nth-child(4) { animation-delay: 2.6s; }
        .lp-msg-who { font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--silver-dim); }
        .lp-msg-who.lucy { color: var(--gold); }
        .lp-msg-text { font-family: 'Cormorant Garamond', serif; font-size: 1.25rem; font-weight: 300; line-height: 1.55; color: var(--silver); padding: 1.2rem 1.8rem; border-left: 1px solid rgba(201,178,124,0.08); }
        .lp-msg-lucy { border-left-color: rgba(201,178,124,0.3); background: linear-gradient(to right, rgba(201,178,124,0.04), transparent); }

        /* ══ FEATURES ══ */
        .lp-features { padding: 8rem 4rem; max-width: 1200px; margin: 0 auto; position: relative; z-index: 2; }
        .lp-features-header { text-align: center; margin-bottom: 5rem; }
        .lp-features-header h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(2.2rem, 4.5vw, 4rem); font-weight: 300; line-height: 1.15; margin-top: 1.5rem; color: var(--silver); }
        .lp-features-header h2 em { font-style: italic; color: var(--gold); }
        .lp-features-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: rgba(201,178,124,0.06); }
        .feature-card { background: var(--black); padding: 3rem 2.5rem; position: relative; overflow: hidden; transition: background 0.4s; }
        .feature-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(to right, transparent, rgba(201,178,124,0.15), transparent); }
        .feature-card::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(to right, transparent, var(--gold), transparent); opacity: 0; transition: opacity 0.4s; }
        .feature-card:hover { background: var(--deep); }
        .feature-card:hover::after { opacity: 0.5; }
        .lp-feature-num { font-family: 'Cormorant Garamond', serif; font-size: 3.5rem; font-weight: 300; color: rgba(201,178,124,0.07); line-height: 1; margin-bottom: 2rem; transition: color 0.4s; }
        .feature-card:hover .lp-feature-num { color: rgba(201,178,124,0.18); }
        .lp-feature-title { font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--silver); margin-bottom: 1rem; font-weight: 500; }
        .lp-feature-desc { font-size: 0.85rem; line-height: 1.8; color: var(--silver-dim); }

        /* ══ QUOTE ══ */
        .lp-quote { padding: 10rem 4rem; text-align: center; position: relative; z-index: 2; }
        .lp-quote::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 800px; height: 400px; background: radial-gradient(ellipse, rgba(201,178,124,0.03) 0%, transparent 70%); }
        .lp-quote-mark { font-family: 'Cormorant Garamond', serif; font-size: 8rem; line-height: 0.5; color: var(--gold); opacity: 0.15; display: block; margin-bottom: 2rem; }
        .lp-quote blockquote { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.6rem, 3.5vw, 2.6rem); font-weight: 300; font-style: italic; line-height: 1.45; color: var(--silver); max-width: 860px; margin: 0 auto; position: relative; z-index: 1; }
        .lp-gold-line { width: 40px; height: 1px; background: var(--gold); margin: 3rem auto 0; opacity: 0.3; }

        /* ══ PRICING ══ */
        .lp-pricing { padding: 8rem 4rem; max-width: 860px; margin: 0 auto; text-align: center; position: relative; z-index: 2; }
        .lp-pricing h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(2.2rem, 4.5vw, 3.8rem); font-weight: 300; margin: 1.5rem 0 5rem; color: var(--silver); }
        .lp-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(201,178,124,0.06); }
        .pricing-card { background: var(--black); padding: 3.5rem 3rem; text-align: left; transition: background 0.4s; }
        .pricing-card:hover { background: var(--deep); }
        .pricing-card.featured { background: var(--deep); position: relative; }
        .pricing-card.featured::before { content: 'Nuevo'; position: absolute; top: 0; left: 50%; transform: translateX(-50%) translateY(-50%); background: var(--gold); color: #050508; font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase; padding: 0.3rem 1rem; font-weight: 500; }
        .lp-pricing-name { font-size: 0.65rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); margin-bottom: 1.5rem; }
        .lp-pricing-price { font-family: 'Cormorant Garamond', serif; font-size: 4.5rem; font-weight: 300; line-height: 1; color: var(--silver); margin-bottom: 0.4rem; }
        .lp-pricing-price span { font-size: 1.2rem; color: var(--silver-dim); }
        .lp-pricing-period { font-size: 0.75rem; color: var(--silver-dim); margin-bottom: 2.5rem; }
        .lp-pricing-features { list-style: none; display: flex; flex-direction: column; gap: 0.9rem; margin-bottom: 2.5rem; }
        .lp-pricing-features li { font-size: 0.82rem; color: var(--silver-dim); display: flex; align-items: center; gap: 0.75rem; }
        .lp-pricing-features li::before { content: '—'; color: var(--gold); opacity: 0.4; flex-shrink: 0; }
        .lp-pricing-btn { display: block; width: 100%; padding: 0.9rem; text-align: center; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; background: none; border: 1px solid rgba(201,178,124,0.15); color: var(--silver-dim); transition: all 0.3s; cursor: none; font-family: 'DM Sans', sans-serif; }
        .lp-pricing-btn:hover { background: var(--gold); border-color: var(--gold); color: #050508; }
        .pricing-card.featured .lp-pricing-btn { background: rgba(201,178,124,0.1); border-color: rgba(201,178,124,0.3); color: var(--gold); }
        .pricing-card.featured .lp-pricing-btn:hover { background: var(--gold); color: #050508; }
        .lp-pricing-bundle { margin-top: 2.5rem; padding: 1.5rem 2rem; background: rgba(201,178,124,0.03); border: 1px solid rgba(201,178,124,0.08); text-align: center; }
        .lp-pricing-bundle p { font-size: 0.82rem; color: var(--silver-dim); line-height: 1.7; }
        .lp-pricing-bundle strong { color: var(--gold); font-weight: 500; }

        /* ══ CTA FINAL ══ */
        .lp-cta { padding: 10rem 4rem; text-align: center; position: relative; z-index: 2; border-top: 1px solid rgba(201,178,124,0.06); }
        .lp-cta::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 800px; height: 500px; background: radial-gradient(ellipse, rgba(201,178,124,0.04) 0%, transparent 70%); pointer-events: none; }
        .lp-cta h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(2.8rem, 6vw, 5.5rem); font-weight: 300; line-height: 1; margin: 1.5rem 0 2rem; color: var(--silver); position: relative; z-index: 1; }
        .lp-cta h2 em { font-style: italic; color: var(--gold); }
        .lp-cta p { font-size: 0.9rem; color: var(--silver-dim); margin-bottom: 3.5rem; max-width: 460px; margin-left: auto; margin-right: auto; line-height: 1.8; position: relative; z-index: 1; }

        /* ══ FOOTER ══ */
        .lp-footer { padding: 3rem 4rem; border-top: 1px solid rgba(201,178,124,0.06); display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 2; }
        .lp-footer-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 300; letter-spacing: 0.15em; color: var(--silver-dim); }
        .lp-footer-logo span { color: var(--gold); }
        .lp-footer p { font-size: 0.7rem; color: rgba(224,247,250,0.15); letter-spacing: 0.05em; }

        @keyframes lp-fadeUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes lp-pulse { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.05); opacity: 0.25; } }

        @media (max-width: 768px) {
          .lp-nav { padding: 1.2rem 1.5rem; }
          .lp-nav-links { display: none; }
          .lp-hero-content { padding: 7rem 2rem 4rem; }
          .lp-features-grid, .lp-pricing-grid { grid-template-columns: 1fr; }
          .lp-features, .lp-voice, .lp-pricing, .lp-quote, .lp-cta { padding: 5rem 2rem; }
          .lp-footer { flex-direction: column; gap: 1rem; text-align: center; }
          .lp-hero-overlay-left { background: linear-gradient(to right, rgba(5,5,8,0.95) 0%, rgba(5,5,8,0.4) 100%); }
        }
      `}</style>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <div className="lp-wrap">

        <GoldParticles />

        <nav className="lp-nav">
          <div className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Lucy<span>.</span></div>
          <ul className="lp-nav-links">
            <li><a href="#features">Funciones</a></li>
            <li><a href="#pricing">Precios</a></li>
            <li><button className="lp-nav-cta" onClick={() => navigate('/auth')}>Acceder</button></li>
          </ul>
        </nav>

        {/* ══ HERO with Lucy image ══ */}
        <section className="lp-hero">
          <div className="lp-hero-bg">
            <img src="/lucy-hero.png" alt="" className="lp-hero-img" />
            <div className="lp-hero-overlay" />
            <div className="lp-hero-overlay-left" />
          </div>
          <div className="lp-hero-content">
            <p className="lp-eyebrow">Secretaria ejecutiva y asistente personal con IA</p>
            <h1 className="lp-h1">La asistente ejecutiva<br />que transforma<br />tu <em>día.</em></h1>
            <p className="lp-subtitle">Tu asistente virtual de IA para optimizar tus tareas y gestionar tu negocio con elegancia y eficiencia.</p>
            <div className="lp-actions">
              <button className="lp-btn-primary" onClick={() => navigate('/auth')}>Probar gratis 4 horas</button>
              <button className="lp-btn-secondary" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>Ver cómo funciona</button>
            </div>
          </div>
        </section>

        <div className="lp-wave" />

        {/* ══ VOICE DEMO ══ */}
        <section className="lp-voice" id="demo">
          <p className="lp-section-label">Experiencia de voz</p>

          <div className={`lp-voice-circle${micState === 'playing' ? ' playing' : ''}`} onClick={handleMicClick}>
            <div className="lp-voice-ring" />
            <div className="lp-voice-ring" />
            <div className="lp-voice-ring" />
            <div className="lp-voice-center">
              {micState === 'loading' ? (
                <svg className="lp-spin" viewBox="0 0 24 24" fill="none" stroke="#C9B27C" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : micState === 'playing' ? (
                <svg viewBox="0 0 24 24" fill="#C9B27C" style={{ width: 18, height: 18 }}>
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="#C9B27C" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
                </svg>
              )}
            </div>
          </div>

          <p className={`lp-voice-hint${micState === 'playing' ? ' playing' : ''}`}>
            {micState === 'idle' && 'Pulsa para escuchar a Lucy'}
            {micState === 'loading' && 'Conectando...'}
            {micState === 'playing' && 'Pulsa para detener'}
          </p>

          <div className="lp-conversation">
            <div className="lp-msg"><span className="lp-msg-who">Tú</span><div className="lp-msg-text">"Lucy, buenos días."</div></div>
            <div className="lp-msg"><span className="lp-msg-who lucy">Lucy</span><div className="lp-msg-text lp-msg-lucy">"Buenos días. Tienes 18 correos nuevos, 3 requieren respuesta urgente. Hoy tienes dos reuniones: a las 11 con Sara y a las 17 con Pedro. Tus hábitos de hoy: agua y ejercicio pendientes. ¿Empezamos?"</div></div>
            <div className="lp-msg"><span className="lp-msg-who">Tú</span><div className="lp-msg-text">"Sí. Y recuérdame comprar comida para Ocean a las 6."</div></div>
            <div className="lp-msg"><span className="lp-msg-who lucy">Lucy</span><div className="lp-msg-text lp-msg-lucy">"Listo. Te recordaré comprar comida para Ocean hoy a las 18:00. Primer correo prioritario: de Sara García — propuesta de colaboración para el primer trimestre..."</div></div>
          </div>
        </section>

        <div className="lp-wave" />

        {/* ══ FEATURES ══ */}
        <section className="lp-features" id="features">
          <div className="lp-features-header">
            <p className="lp-section-label">Capacidades</p>
            <h2>Una nueva forma de gestionar tu tiempo,<br /><em>tu trabajo y tu vida personal.</em></h2>
          </div>
          <div className="lp-features-grid">
            {[
              ['01', 'Briefing Matutino', 'Cada mañana, Lucy te resume lo esencial: correos, reuniones, tareas y hábitos. Sin abrir el ordenador.'],
              ['02', 'Correo Inteligente', 'Lee, resume, prioriza y responde correos por voz. Lucy aprende tu estilo y lo replica.'],
              ['03', 'Gestión de Agenda', 'Crea, mueve y cancela reuniones. Lucy sincroniza con tu calendario y avisa con tiempo.'],
              ['04', 'Memoria Personal', 'Lucy recuerda tus preferencias, contactos importantes, ideas y notas. Todo accesible por voz.'],
              ['05', 'Hábitos y Recordatorios', 'Registra hábitos diarios, crea recordatorios por voz. Lucy te motiva a mantener tu racha.'],
              ['06', 'Modo Manos Libres', 'En el coche, corriendo o en casa. Lucy opera solo con tu voz, como Siri pero para tu trabajo y tu vida.'],
            ].map(([num, title, desc]) => (
              <div className="feature-card" key={num}>
                <div className="lp-feature-num">{num}</div>
                <div className="lp-feature-title">{title}</div>
                <p className="lp-feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══ QUOTE ══ */}
        <section className="lp-quote">
          <span className="lp-quote-mark">"</span>
          <blockquote>En un mundo saturado de notificaciones, Lucy representa una nueva forma de relacionarse con la tecnología. Más natural. Más humana. Profundamente orientada a la eficiencia.</blockquote>
          <div className="lp-gold-line" />
        </section>

        {/* ══ PRICING ══ */}
        <section className="lp-pricing" id="pricing">
          <p className="lp-section-label">Planes</p>
          <h2>Invierte en tu tiempo.</h2>
          <div className="lp-pricing-grid">
            <div className="pricing-card">
              <div className="lp-pricing-name">Secretaria Ejecutiva</div>
              <div className="lp-pricing-price"><span>desde €</span>19</div>
              <div className="lp-pricing-period">por mes</div>
              <ul className="lp-pricing-features">
                {['Briefing matutino con IA', 'Priorización inteligente de emails', 'Gestión de agenda y tareas', 'Comandos de voz (Hola Lucy)', 'CRM de contactos'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <button className="lp-pricing-btn" onClick={() => navigate('/pricing')}>Ver planes</button>
            </div>
            <div className="pricing-card featured">
              <div className="lp-pricing-name">Asistente Personal</div>
              <div className="lp-pricing-price"><span>desde €</span>14</div>
              <div className="lp-pricing-period">por mes</div>
              <ul className="lp-pricing-features">
                {['Recordatorios por voz y texto', 'Memoria personal persistente', 'Seguimiento de hábitos', 'Notas inteligentes', 'Alertas proactivas'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <button className="lp-pricing-btn" onClick={() => navigate('/pricing')}>Ver planes</button>
            </div>
          </div>
          <div className="lp-pricing-bundle">
            <p><strong>Lucy Completa</strong> — Ambos productos desde <strong>€25/mes</strong> con 25% de descuento</p>
          </div>
        </section>

        {/* ══ CTA FINAL ══ */}
        <section className="lp-cta">
          <p className="lp-section-label">Únete</p>
          <h2>Tu día empieza<br />con <em>Lucy.</em></h2>
          <p>Di "Lucy, buenos días" y descubre lo que es trabajar con claridad total desde el primer minuto.</p>
          <button className="lp-btn-primary" onClick={() => navigate('/auth')}>Probar gratis 4 horas</button>
        </section>

        <footer className="lp-footer">
          <div className="lp-footer-logo">Lucy<span>.</span></div>
          <p>© 2026 Lucy · Secretaria Ejecutiva y Asistente Personal con IA · España</p>
        </footer>

      </div>
    </>
  );
}