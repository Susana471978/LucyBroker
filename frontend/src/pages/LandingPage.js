import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LUCY_PRESENTATION = "Hola, soy Lucy, tu secretaria ejecutiva impulsada por inteligencia artificial. Voy a ayudarte a organizar tu día, gestionar tus correos y liberar tu mente para lo que realmente importa. ¿Por dónde empezamos?";

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
  const [micState, setMicState] = useState('idle'); // idle | loading | playing

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
      const res = await fetch('https://ecs.syntexia-solutions.es/api/tts', {
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
        audio.onended = () => { setMicState('idle'); audioRef.current = null; };
        audio.onerror = () => { setMicState('idle'); audioRef.current = null; };
        await audio.play();
        setMicState('playing');
      } else {
        throw new Error('TTS failed');
      }
    } catch {
      // Fallback Web Speech API
      const utterance = new SpeechSynthesisUtterance(LUCY_PRESENTATION);
      utterance.lang = 'es-ES';
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find(v => v.lang.startsWith('es') && v.name.toLowerCase().includes('female'))
        || voices.find(v => v.lang.startsWith('es'));
      if (esVoice) utterance.voice = esVoice;
      utterance.onend = () => setMicState('idle');
      utterance.onerror = () => setMicState('idle');
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setMicState('playing');
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
        ring.style.borderColor = 'rgba(196,163,90,0.8)';
      });
      el.addEventListener('mouseleave', () => {
        cursor.style.transform = 'scale(1)';
        ring.style.transform = 'scale(1)';
        ring.style.borderColor = 'rgba(196,163,90,0.4)';
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
          --black: #060608; --deep: #0A0A10; --surface: #0F0F18;
          --gold: #C4A35A; --gold-light: #D4B878; --gold-dim: rgba(196,163,90,0.15);
          --white: #F0EDE8; --white-dim: rgba(240,237,232,0.55); --white-faint: rgba(240,237,232,0.08);
          background: var(--black); color: var(--white);
          font-family: 'DM Sans', sans-serif; font-weight: 300;
          overflow-x: hidden; cursor: none; min-height: 100vh;
        }
        .lp-cursor { position: fixed; width: 8px; height: 8px; background: #C4A35A; border-radius: 50%; pointer-events: none; z-index: 9999; transition: transform 0.15s ease; mix-blend-mode: difference; }
        .lp-cursor-ring { position: fixed; width: 32px; height: 32px; border: 1px solid rgba(196,163,90,0.4); border-radius: 50%; pointer-events: none; z-index: 9998; transition: border-color 0.3s, transform 0.3s; }
        .lp-wrap::before { content: ''; position: fixed; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events: none; z-index: 1000; opacity: 0.35; }

        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 2rem 4rem; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(to bottom, rgba(6,6,8,0.97), transparent); }
        .lp-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 300; letter-spacing: 0.15em; color: #F0EDE8; cursor: pointer; }
        .lp-logo span { color: #C4A35A; }
        .lp-nav-links { display: flex; align-items: center; gap: 3rem; list-style: none; }
        .lp-nav-links a { text-decoration: none; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(240,237,232,0.55); transition: color 0.3s; cursor: none; }
        .lp-nav-links a:hover { color: #C4A35A; }
        .lp-nav-cta { padding: 0.6rem 1.8rem !important; border: 1px solid rgba(196,163,90,0.4) !important; color: #C4A35A !important; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; cursor: none; transition: all 0.3s; }
        .lp-nav-cta:hover { background: rgba(196,163,90,0.15) !important; border-color: #C4A35A !important; }

        .lp-hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8rem 2rem 6rem; position: relative; overflow: hidden; }
        .lp-hero::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 700px; height: 700px; background: radial-gradient(ellipse, rgba(196,163,90,0.05) 0%, transparent 70%); pointer-events: none; }
        .lp-eyebrow { font-size: 0.72rem; letter-spacing: 0.25em; text-transform: uppercase; color: #C4A35A; margin-bottom: 2.5rem; opacity: 0; animation: lp-fadeUp 0.8s ease 0.2s forwards; }
        .lp-h1 { font-family: 'Cormorant Garamond', serif; font-size: clamp(4.5rem, 12vw, 10rem); font-weight: 300; line-height: 0.9; letter-spacing: -0.02em; color: #F0EDE8; opacity: 0; animation: lp-fadeUp 0.9s ease 0.35s forwards; }
        .lp-h1 em { font-style: italic; color: #D4B878; }
        .lp-subtitle { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.2rem, 2.5vw, 1.8rem); font-weight: 300; font-style: italic; color: rgba(240,237,232,0.55); margin-top: 1.8rem; margin-bottom: 4rem; opacity: 0; animation: lp-fadeUp 0.9s ease 0.5s forwards; }
        .lp-actions { display: flex; gap: 1.5rem; align-items: center; opacity: 0; animation: lp-fadeUp 0.9s ease 0.65s forwards; }
        .lp-btn-primary { padding: 1rem 3rem; background: #C4A35A; color: #060608; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; border: none; cursor: none; transition: all 0.3s ease; }
        .lp-btn-primary:hover { background: #D4B878; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(196,163,90,0.3); }
        .lp-btn-secondary { font-size: 0.78rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(240,237,232,0.55); background: none; border: none; display: flex; align-items: center; gap: 0.5rem; transition: color 0.3s; cursor: none; }
        .lp-btn-secondary:hover { color: #F0EDE8; }
        .lp-btn-secondary::after { content: '→'; }

        .lp-wave { width: 1px; height: 100px; background: linear-gradient(to bottom, transparent, rgba(196,163,90,0.4), transparent); margin: 0 auto; }
        .lp-section-label { font-size: 0.7rem; letter-spacing: 0.3em; text-transform: uppercase; color: #C4A35A; text-align: center; }

        /* ── Voice ── */
        .lp-voice { padding: 8rem 4rem; display: flex; flex-direction: column; align-items: center; gap: 3rem; }
        .lp-voice-circle { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; cursor: none; }
        .lp-voice-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(196,163,90,0.2); animation: lp-pulse 3s ease infinite; }
        .lp-voice-ring:nth-child(1) { width: 100%; height: 100%; }
        .lp-voice-ring:nth-child(2) { width: 70%; height: 70%; animation-delay: 0.6s; border-color: rgba(196,163,90,0.35); }
        .lp-voice-ring:nth-child(3) { width: 42%; height: 42%; animation-delay: 1.2s; border-color: rgba(196,163,90,0.55); }
        .lp-voice-circle.playing .lp-voice-ring { animation-duration: 0.9s !important; border-color: rgba(196,163,90,0.5); }
        .lp-voice-center { width: 56px; height: 56px; background: rgba(196,163,90,0.15); border: 1px solid rgba(196,163,90,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1; transition: all 0.3s; }
        .lp-voice-circle:hover .lp-voice-center { background: rgba(196,163,90,0.25); border-color: #C4A35A; }
        .lp-voice-circle.playing .lp-voice-center { background: rgba(196,163,90,0.28); border-color: #D4B878; box-shadow: 0 0 20px rgba(196,163,90,0.2); }
        .lp-voice-hint { font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(240,237,232,0.3); text-align: center; transition: color 0.3s; margin-top: -1.5rem; }
        .lp-voice-hint.playing { color: rgba(196,163,90,0.6); }
        .lp-spin { animation: lp-spin-anim 1s linear infinite; }
        @keyframes lp-spin-anim { to { transform: rotate(360deg); } }

        .lp-conversation { max-width: 580px; width: 100%; display: flex; flex-direction: column; gap: 1.5rem; }
        .lp-msg { display: flex; flex-direction: column; gap: 0.4rem; opacity: 0; transform: translateY(10px); animation: lp-fadeUp 0.6s ease forwards; }
        .lp-msg:nth-child(1) { animation-delay: 0.3s; }
        .lp-msg:nth-child(2) { animation-delay: 1s; }
        .lp-msg:nth-child(3) { animation-delay: 1.8s; }
        .lp-msg:nth-child(4) { animation-delay: 2.6s; }
        .lp-msg-who { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(240,237,232,0.55); }
        .lp-msg-who.lucy { color: #C4A35A; }
        .lp-msg-text { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 300; line-height: 1.5; color: #F0EDE8; padding: 1.2rem 1.8rem; border-left: 1px solid rgba(240,237,232,0.08); }
        .lp-msg-lucy { border-left-color: rgba(196,163,90,0.35); background: linear-gradient(to right, rgba(196,163,90,0.04), transparent); }

        .lp-features { padding: 8rem 4rem; max-width: 1200px; margin: 0 auto; }
        .lp-features-header { text-align: center; margin-bottom: 5rem; }
        .lp-features-header h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 300; line-height: 1.1; margin-top: 1.5rem; }
        .lp-features-header h2 em { font-style: italic; color: #D4B878; }
        .lp-features-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: rgba(240,237,232,0.08); }
        .feature-card { background: #060608; padding: 3rem 2.5rem; position: relative; overflow: hidden; transition: background 0.4s; }
        .feature-card::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(to right, transparent, #C4A35A, transparent); opacity: 0; transition: opacity 0.4s; }
        .feature-card:hover { background: #0F0F18; }
        .feature-card:hover::after { opacity: 1; }
        .lp-feature-num { font-family: 'Cormorant Garamond', serif; font-size: 3.5rem; font-weight: 300; color: rgba(240,237,232,0.08); line-height: 1; margin-bottom: 2rem; transition: color 0.4s; }
        .feature-card:hover .lp-feature-num { color: rgba(196,163,90,0.15); }
        .lp-feature-title { font-size: 0.82rem; letter-spacing: 0.1em; text-transform: uppercase; color: #F0EDE8; margin-bottom: 1rem; font-weight: 500; }
        .lp-feature-desc { font-size: 0.88rem; line-height: 1.75; color: rgba(240,237,232,0.55); }

        .lp-quote { padding: 10rem 4rem; text-align: center; position: relative; }
        .lp-quote::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 800px; height: 400px; background: radial-gradient(ellipse, rgba(196,163,90,0.04) 0%, transparent 70%); }
        .lp-quote-mark { font-family: 'Cormorant Garamond', serif; font-size: 8rem; line-height: 0.5; color: #C4A35A; opacity: 0.25; display: block; margin-bottom: 2rem; }
        .lp-quote blockquote { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 300; font-style: italic; line-height: 1.4; color: #F0EDE8; max-width: 860px; margin: 0 auto; position: relative; z-index: 1; }
        .lp-gold-line { width: 40px; height: 1px; background: #C4A35A; margin: 3rem auto 0; opacity: 0.5; }

        .lp-pricing { padding: 8rem 4rem; max-width: 860px; margin: 0 auto; text-align: center; }
        .lp-pricing h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 300; margin: 1.5rem 0 5rem; }
        .lp-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(240,237,232,0.08); }
        .pricing-card { background: #060608; padding: 3.5rem 3rem; text-align: left; }
        .pricing-card.featured { background: #0F0F18; position: relative; }
        .pricing-card.featured::before { content: 'Recomendado'; position: absolute; top: 0; left: 50%; transform: translateX(-50%) translateY(-50%); background: #C4A35A; color: #060608; font-size: 0.62rem; letter-spacing: 0.15em; text-transform: uppercase; padding: 0.3rem 1rem; font-weight: 500; }
        .lp-pricing-name { font-size: 0.68rem; letter-spacing: 0.22em; text-transform: uppercase; color: #C4A35A; margin-bottom: 1.5rem; }
        .lp-pricing-price { font-family: 'Cormorant Garamond', serif; font-size: 4.5rem; font-weight: 300; line-height: 1; color: #F0EDE8; margin-bottom: 0.4rem; }
        .lp-pricing-price span { font-size: 1.3rem; color: rgba(240,237,232,0.55); }
        .lp-pricing-period { font-size: 0.78rem; color: rgba(240,237,232,0.55); margin-bottom: 2.5rem; }
        .lp-pricing-features { list-style: none; display: flex; flex-direction: column; gap: 0.9rem; margin-bottom: 2.5rem; }
        .lp-pricing-features li { font-size: 0.85rem; color: rgba(240,237,232,0.55); display: flex; align-items: center; gap: 0.75rem; }
        .lp-pricing-features li::before { content: '—'; color: #C4A35A; opacity: 0.5; flex-shrink: 0; }
        .lp-pricing-btn { display: block; width: 100%; padding: 0.9rem; text-align: center; font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; background: none; border: 1px solid rgba(196,163,90,0.25); color: rgba(240,237,232,0.55); transition: all 0.3s; cursor: none; font-family: 'DM Sans', sans-serif; }
        .lp-pricing-btn:hover, .pricing-card.featured .lp-pricing-btn { background: #C4A35A; border-color: #C4A35A; color: #060608; }

        .lp-cta { padding: 10rem 4rem; text-align: center; border-top: 1px solid rgba(240,237,232,0.08); }
        .lp-cta h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(3rem, 7vw, 6.5rem); font-weight: 300; line-height: 1; margin: 1.5rem 0 2rem; }
        .lp-cta h2 em { font-style: italic; color: #D4B878; }
        .lp-cta p { font-size: 0.95rem; color: rgba(240,237,232,0.55); margin-bottom: 3.5rem; max-width: 460px; margin-left: auto; margin-right: auto; line-height: 1.8; }

        .lp-footer { padding: 3rem 4rem; border-top: 1px solid rgba(240,237,232,0.08); display: flex; align-items: center; justify-content: space-between; }
        .lp-footer-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 300; letter-spacing: 0.15em; color: rgba(240,237,232,0.55); }
        .lp-footer-logo span { color: #C4A35A; }
        .lp-footer p { font-size: 0.72rem; color: rgba(240,237,232,0.25); letter-spacing: 0.05em; }

        @keyframes lp-fadeUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes lp-pulse { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.05); opacity: 0.25; } }

        @media (max-width: 768px) {
          .lp-nav { padding: 1.5rem 2rem; }
          .lp-nav-links { display: none; }
          .lp-features-grid, .lp-pricing-grid { grid-template-columns: 1fr; }
          .lp-features, .lp-voice, .lp-pricing, .lp-quote, .lp-cta { padding: 5rem 2rem; }
          .lp-footer { flex-direction: column; gap: 1rem; text-align: center; }
        }
      `}</style>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <div className="lp-wrap">

        <nav className="lp-nav">
          <div className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Lucy<span>.</span></div>
          <ul className="lp-nav-links">
            <li><a href="#features">Funciones</a></li>
            <li><a href="#pricing">Precios</a></li>
            <li><button className="lp-nav-cta" onClick={() => navigate('/auth')}>Acceder</button></li>
          </ul>
        </nav>

        {/* Hero — sin "Descubrir" */}
        <section className="lp-hero">
          <p className="lp-eyebrow">Secretaria ejecutiva con inteligencia artificial</p>
          <h1 className="lp-h1">Hola,<br />soy <em>Lucy.</em></h1>
          <p className="lp-subtitle">Tu día, ordenado. Tu mente, libre.</p>
          <div className="lp-actions">
            <button className="lp-btn-primary" onClick={() => navigate('/auth')}>Comenzar ahora</button>
            <button className="lp-btn-secondary" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>Ver cómo funciona</button>
          </div>
        </section>

        <div className="lp-wave" />

        {/* Voice demo — botón interactivo */}
        <section className="lp-voice" id="demo">
          <p className="lp-section-label">Experiencia de voz</p>

          <div
            className={`lp-voice-circle${micState === 'playing' ? ' playing' : ''}`}
            onClick={handleMicClick}
          >
            <div className="lp-voice-ring" />
            <div className="lp-voice-ring" />
            <div className="lp-voice-ring" />
            <div className="lp-voice-center">
              {micState === 'loading' ? (
                <svg className="lp-spin" viewBox="0 0 24 24" fill="none" stroke="#C4A35A" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : micState === 'playing' ? (
                <svg viewBox="0 0 24 24" fill="#D4B878" style={{ width: 18, height: 18 }}>
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="#C4A35A" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
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
            <div className="lp-msg">
              <span className="lp-msg-who">Tú</span>
              <div className="lp-msg-text">"Lucy, buenos días."</div>
            </div>
            <div className="lp-msg">
              <span className="lp-msg-who lucy">Lucy</span>
              <div className="lp-msg-text lp-msg-lucy">"Buenos días, Susana. Tienes 18 correos nuevos. 3 requieren respuesta urgente. Hoy tienes dos reuniones: a las 11 con Sara y a las 17 con Pedro. ¿Empezamos?"</div>
            </div>
            <div className="lp-msg">
              <span className="lp-msg-who">Tú</span>
              <div className="lp-msg-text">"Sí. Y responde a Pedro confirmando la reunión."</div>
            </div>
            <div className="lp-msg">
              <span className="lp-msg-who lucy">Lucy</span>
              <div className="lp-msg-text lp-msg-lucy">"Hecho. Respuesta enviada. Primer correo prioritario: de Sara García — propuesta de colaboración para el primer trimestre..."</div>
            </div>
          </div>
        </section>

        <div className="lp-wave" />

        <section className="lp-features" id="features">
          <div className="lp-features-header">
            <p className="lp-section-label">Capacidades</p>
            <h2>Una nueva forma de gestionar tu tiempo,<br /><em>tus correos y tus decisiones.</em></h2>
          </div>
          <div className="lp-features-grid">
            {[
              ['01', 'Briefing Matutino', 'Cada mañana, Lucy te resume lo esencial: correos, reuniones y alertas. Sin abrir el ordenador.'],
              ['02', 'Correo Inteligente', 'Lee, resume, prioriza y responde correos por voz. Lucy aprende tu estilo y lo replica.'],
              ['03', 'Gestión de Agenda', 'Crea, mueve y cancela reuniones. Lucy sincroniza con tu calendario y avisa con tiempo.'],
              ['04', 'Memoria Relacional', 'Lucy recuerda quién es importante para ti, cómo prefieres comunicarte y qué priorizas.'],
              ['05', 'Modo Manos Libres', 'En el coche, corriendo o en casa. Lucy opera solo con tu voz, sin necesidad de pantalla.'],
              ['06', 'Aprendizaje Continuo', 'Cuanto más la usas, mejor te conoce. Lucy se adapta a tus hábitos y mejora cada día.'],
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
          <blockquote>En un mundo saturado de notificaciones, Lucy representa una nueva forma de relacionarse con la tecnología. Más natural. Más humana. Profundamente orientada a la eficiencia.</blockquote>
          <div className="lp-gold-line" />
        </section>

        <section className="lp-pricing" id="pricing">
          <p className="lp-section-label">Planes</p>
          <h2>Invierte en tu tiempo.</h2>
          <div className="lp-pricing-grid">
            <div className="pricing-card">
              <div className="lp-pricing-name">Esencial</div>
              <div className="lp-pricing-price"><span>€</span>29</div>
              <div className="lp-pricing-period">por mes · facturación anual</div>
              <ul className="lp-pricing-features">
                {['Gestión de correo con IA', 'Briefing diario por voz', 'Memoria de contactos', 'Modo manos libres', '1 cuenta de correo'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <button className="lp-pricing-btn" onClick={() => navigate('/auth')}>Empezar gratis 14 días</button>
            </div>
            <div className="pricing-card featured">
              <div className="lp-pricing-name">Ejecutivo</div>
              <div className="lp-pricing-price"><span>€</span>79</div>
              <div className="lp-pricing-period">por mes · facturación anual</div>
              <ul className="lp-pricing-features">
                {['Todo lo del plan Esencial', 'Gestión de agenda completa', 'Resumen de documentos', 'Integración CRM', 'Respuestas automáticas', 'Soporte prioritario'].map(f => <li key={f}>{f}</li>)}
              </ul>
              <button className="lp-pricing-btn" onClick={() => navigate('/auth')}>Empezar gratis 14 días</button>
            </div>
          </div>
        </section>

        <section className="lp-cta">
          <p className="lp-section-label">Únete</p>
          <h2>Tu día empieza<br />con <em>Lucy.</em></h2>
          <p>Di "Lucy, buenos días" y descubre lo que es trabajar con claridad total desde el primer minuto.</p>
          <button className="lp-btn-primary" onClick={() => navigate('/auth')}>Comenzar ahora — es gratis</button>
        </section>

        <footer className="lp-footer">
          <div className="lp-footer-logo">Lucy<span>.</span></div>
          <p>© 2026 Lucy · Secretaria Virtual Inteligente · España</p>
        </footer>

      </div>
    </>
  );
}