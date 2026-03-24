import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LUCY_PRESENTATION = "Hola, soy Lucy, tu secretaria ejecutiva y asistente personal impulsada por inteligencia artificial. Voy a ayudarte a organizar tu día, gestionar tus correos, tus hábitos y liberar tu mente para lo que realmente importa. ¿Por dónde empezamos?";

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
        ring.style.borderColor = 'rgba(0,180,216,0.8)';
      });
      el.addEventListener('mouseleave', () => {
        cursor.style.transform = 'scale(1)';
        ring.style.transform = 'scale(1)';
        ring.style.borderColor = 'rgba(0,180,216,0.4)';
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
          --black: #000000; --deep: #041220; --surface: #081828;
          --ocean: #00B4D8; --ocean-light: #4DD9F0; --ocean-dim: rgba(0,180,216,0.15);
          --gold: #C9B27C; --gold-light: #D4BC88;
          --silver: #E0F7FA; --silver-dim: rgba(224,247,250,0.55); --silver-faint: rgba(224,247,250,0.08);
          background: var(--black); color: var(--silver);
          font-family: 'DM Sans', sans-serif; font-weight: 300;
          overflow-x: hidden; cursor: none; min-height: 100vh;
        }
        .lp-cursor { position: fixed; width: 8px; height: 8px; background: #00B4D8; border-radius: 50%; pointer-events: none; z-index: 9999; transition: transform 0.15s ease; mix-blend-mode: difference; }
        .lp-cursor-ring { position: fixed; width: 32px; height: 32px; border: 1px solid rgba(0,180,216,0.4); border-radius: 50%; pointer-events: none; z-index: 9998; transition: border-color 0.3s, transform 0.3s; }
        .lp-wrap::before { content: ''; position: fixed; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events: none; z-index: 1000; opacity: 0.25; }

        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 2rem 4rem; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(to bottom, rgba(0,0,0,0.97), transparent); }
        .lp-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 300; letter-spacing: 0.15em; color: var(--silver); cursor: pointer; }
        .lp-logo span { color: var(--ocean); }
        .lp-nav-links { display: flex; align-items: center; gap: 3rem; list-style: none; }
        .lp-nav-links a { text-decoration: none; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--silver-dim); transition: color 0.3s; cursor: none; }
        .lp-nav-links a:hover { color: var(--ocean); }
        .lp-nav-cta { padding: 0.6rem 1.8rem !important; border: 1px solid rgba(0,180,216,0.35) !important; color: var(--ocean) !important; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; cursor: none; transition: all 0.3s; }
        .lp-nav-cta:hover { background: rgba(0,180,216,0.1) !important; border-color: var(--ocean) !important; }

        .lp-hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8rem 2rem 6rem; position: relative; overflow: hidden; }
        .lp-hero::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 700px; height: 700px; background: radial-gradient(ellipse, rgba(0,180,216,0.04) 0%, transparent 70%); pointer-events: none; }
        .lp-eyebrow { font-size: 0.72rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--ocean); margin-bottom: 2.5rem; opacity: 0; animation: lp-fadeUp 0.8s ease 0.2s forwards; }
        .lp-h1 { font-family: 'Cormorant Garamond', serif; font-size: clamp(4.5rem, 12vw, 10rem); font-weight: 300; line-height: 0.9; letter-spacing: -0.02em; color: var(--silver); opacity: 0; animation: lp-fadeUp 0.9s ease 0.35s forwards; }
        .lp-h1 em { font-style: italic; color: var(--gold); }
        .lp-subtitle { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.2rem, 2.5vw, 1.8rem); font-weight: 300; font-style: italic; color: var(--silver-dim); margin-top: 1.8rem; margin-bottom: 4rem; opacity: 0; animation: lp-fadeUp 0.9s ease 0.5s forwards; }
        .lp-actions { display: flex; gap: 1.5rem; align-items: center; opacity: 0; animation: lp-fadeUp 0.9s ease 0.65s forwards; }
        .lp-btn-primary { padding: 1rem 3rem; background: var(--gold); color: #000000; font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; border: none; cursor: none; transition: all 0.3s ease; }
        .lp-btn-primary:hover { background: var(--gold-light); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(201,178,124,0.25); }
        .lp-btn-secondary { font-size: 0.78rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--silver-dim); background: none; border: none; display: flex; align-items: center; gap: 0.5rem; transition: color 0.3s; cursor: none; }
        .lp-btn-secondary:hover { color: var(--silver); }
        .lp-btn-secondary::after { content: '→'; }

        .lp-wave { width: 1px; height: 100px; background: linear-gradient(to bottom, transparent, rgba(0,180,216,0.3), transparent); margin: 0 auto; }
        .lp-section-label { font-size: 0.7rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--ocean); text-align: center; }

        .lp-voice { padding: 8rem 4rem; display: flex; flex-direction: column; align-items: center; gap: 3rem; }
        .lp-voice-circle { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; cursor: none; }
        .lp-voice-ring { position: absolute; border-radius: 50%; border: 1px solid rgba(0,180,216,0.2); animation: lp-pulse 3s ease infinite; }
        .lp-voice-ring:nth-child(1) { width: 100%; height: 100%; }
        .lp-voice-ring:nth-child(2) { width: 70%; height: 70%; animation-delay: 0.6s; border-color: rgba(0,180,216,0.35); }
        .lp-voice-ring:nth-child(3) { width: 42%; height: 42%; animation-delay: 1.2s; border-color: rgba(0,180,216,0.55); }
        .lp-voice-circle.playing .lp-voice-ring { animation-duration: 0.9s !important; border-color: rgba(201,178,124,0.4); }
        .lp-voice-center { width: 56px; height: 56px; background: rgba(0,180,216,0.1); border: 1px solid rgba(0,180,216,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1; transition: all 0.3s; }
        .lp-voice-circle:hover .lp-voice-center { background: rgba(0,180,216,0.18); border-color: var(--ocean); }
        .lp-voice-circle.playing .lp-voice-center { background: rgba(201,178,124,0.15); border-color: var(--gold); box-shadow: 0 0 20px rgba(201,178,124,0.15); }
        .lp-voice-hint { font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(224,247,250,0.3); text-align: center; transition: color 0.3s; margin-top: -1.5rem; }
        .lp-voice-hint.playing { color: rgba(201,178,124,0.6); }
        .lp-spin { animation: lp-spin-anim 1s linear infinite; }
        @keyframes lp-spin-anim { to { transform: rotate(360deg); } }

        .lp-conversation { max-width: 580px; width: 100%; display: flex; flex-direction: column; gap: 1.5rem; }
        .lp-msg { display: flex; flex-direction: column; gap: 0.4rem; opacity: 0; transform: translateY(10px); animation: lp-fadeUp 0.6s ease forwards; }
        .lp-msg:nth-child(1) { animation-delay: 0.3s; }
        .lp-msg:nth-child(2) { animation-delay: 1s; }
        .lp-msg:nth-child(3) { animation-delay: 1.8s; }
        .lp-msg:nth-child(4) { animation-delay: 2.6s; }
        .lp-msg-who { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--silver-dim); }
        .lp-msg-who.lucy { color: var(--gold); }
        .lp-msg-text { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 300; line-height: 1.5; color: var(--silver); padding: 1.2rem 1.8rem; border-left: 1px solid rgba(0,180,216,0.1); }
        .lp-msg-lucy { border-left-color: rgba(201,178,124,0.3); background: linear-gradient(to right, rgba(201,178,124,0.03), transparent); }

        .lp-features { padding: 8rem 4rem; max-width: 1200px; margin: 0 auto; }
        .lp-features-header { text-align: center; margin-bottom: 5rem; }
        .lp-features-header h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 300; line-height: 1.1; margin-top: 1.5rem; color: var(--silver); }
        .lp-features-header h2 em { font-style: italic; color: var(--gold); }
        .lp-features-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: rgba(0,180,216,0.08); }
        .feature-card { background: #000000; padding: 3rem 2.5rem; position: relative; overflow: hidden; transition: background 0.4s; }
        .feature-card::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(to right, transparent, var(--ocean), transparent); opacity: 0; transition: opacity 0.4s; }
        .feature-card:hover { background: var(--deep); }
        .feature-card:hover::after { opacity: 1; }
        .lp-feature-num { font-family: 'Cormorant Garamond', serif; font-size: 3.5rem; font-weight: 300; color: rgba(0,180,216,0.08); line-height: 1; margin-bottom: 2rem; transition: color 0.4s; }
        .feature-card:hover .lp-feature-num { color: rgba(0,180,216,0.18); }
        .lp-feature-title { font-size: 0.82rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--silver); margin-bottom: 1rem; font-weight: 500; }
        .lp-feature-desc { font-size: 0.88rem; line-height: 1.75; color: var(--silver-dim); }

        .lp-quote { padding: 10rem 4rem; text-align: center; position: relative; }
        .lp-quote::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 800px; height: 400px; background: radial-gradient(ellipse, rgba(0,180,216,0.03) 0%, transparent 70%); }
        .lp-quote-mark { font-family: 'Cormorant Garamond', serif; font-size: 8rem; line-height: 0.5; color: var(--ocean); opacity: 0.2; display: block; margin-bottom: 2rem; }
        .lp-quote blockquote { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 300; font-style: italic; line-height: 1.4; color: var(--silver); max-width: 860px; margin: 0 auto; position: relative; z-index: 1; }
        .lp-gold-line { width: 40px; height: 1px; background: var(--ocean); margin: 3rem auto 0; opacity: 0.4; }

        .lp-pricing { padding: 8rem 4rem; max-width: 860px; margin: 0 auto; text-align: center; }
        .lp-pricing h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 300; margin: 1.5rem 0 5rem; color: var(--silver); }
        .lp-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(0,180,216,0.08); }
        .pricing-card { background: #000000; padding: 3.5rem 3rem; text-align: left; }
        .pricing-card.featured { background: var(--deep); position: relative; }
        .pricing-card.featured::before { content: 'Nuevo'; position: absolute; top: 0; left: 50%; transform: translateX(-50%) translateY(-50%); background: var(--gold); color: #000000; font-size: 0.62rem; letter-spacing: 0.15em; text-transform: uppercase; padding: 0.3rem 1rem; font-weight: 500; }
        .lp-pricing-name { font-size: 0.68rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ocean); margin-bottom: 1.5rem; }
        .lp-pricing-price { font-family: 'Cormorant Garamond', serif; font-size: 4.5rem; font-weight: 300; line-height: 1; color: var(--silver); margin-bottom: 0.4rem; }
        .lp-pricing-price span { font-size: 1.3rem; color: var(--silver-dim); }
        .lp-pricing-period { font-size: 0.78rem; color: var(--silver-dim); margin-bottom: 2.5rem; }
        .lp-pricing-features { list-style: none; display: flex; flex-direction: column; gap: 0.9rem; margin-bottom: 2.5rem; }
        .lp-pricing-features li { font-size: 0.85rem; color: var(--silver-dim); display: flex; align-items: center; gap: 0.75rem; }
        .lp-pricing-features li::before { content: '—'; color: var(--ocean); opacity: 0.5; flex-shrink: 0; }
        .lp-pricing-btn { display: block; width: 100%; padding: 0.9rem; text-align: center; font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; background: none; border: 1px solid rgba(0,180,216,0.2); color: var(--silver-dim); transition: all 0.3s; cursor: none; font-family: 'DM Sans', sans-serif; }
        .lp-pricing-btn:hover, .pricing-card.featured .lp-pricing-btn { background: var(--gold); border-color: var(--gold); color: #000000; }
        .lp-pricing-bundle { margin-top: 2.5rem; padding: 1.5rem 2rem; background: rgba(0,180,216,0.03); border: 1px solid rgba(0,180,216,0.1); text-align: center; }
        .lp-pricing-bundle p { font-size: 0.85rem; color: var(--silver-dim); line-height: 1.7; }
        .lp-pricing-bundle strong { color: var(--gold); font-weight: 500; }

        .lp-cta { padding: 10rem 4rem; text-align: center; border-top: 1px solid rgba(0,180,216,0.08); }
        .lp-cta h2 { font-family: 'Cormorant Garamond', serif; font-size: clamp(3rem, 7vw, 6.5rem); font-weight: 300; line-height: 1; margin: 1.5rem 0 2rem; color: var(--silver); }
        .lp-cta h2 em { font-style: italic; color: var(--gold); }
        .lp-cta p { font-size: 0.95rem; color: var(--silver-dim); margin-bottom: 3.5rem; max-width: 460px; margin-left: auto; margin-right: auto; line-height: 1.8; }

        .lp-footer { padding: 3rem 4rem; border-top: 1px solid rgba(0,180,216,0.08); display: flex; align-items: center; justify-content: space-between; }
        .lp-footer-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; font-weight: 300; letter-spacing: 0.15em; color: var(--silver-dim); }
        .lp-footer-logo span { color: var(--ocean); }
        .lp-footer p { font-size: 0.72rem; color: rgba(224,247,250,0.2); letter-spacing: 0.05em; }

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

        <section className="lp-hero">
          <p className="lp-eyebrow">Secretaria ejecutiva y asistente personal con IA</p>
          <h1 className="lp-h1">Hola,<br />soy <em>Lucy.</em></h1>
          <p className="lp-subtitle">Tu día, ordenado. Tu mente, libre.</p>
          <div className="lp-actions">
            <button className="lp-btn-primary" onClick={() => navigate('/auth')}>Probar gratis 4 horas</button>
            <button className="lp-btn-secondary" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>Ver cómo funciona</button>
          </div>
        </section>

        <div className="lp-wave" />

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
                <svg className="lp-spin" viewBox="0 0 24 24" fill="none" stroke="#00B4D8" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
              ) : micState === 'playing' ? (
                <svg viewBox="0 0 24 24" fill="#C9B27C" style={{ width: 18, height: 18 }}>
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="#00B4D8" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
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
              <div className="lp-msg-text lp-msg-lucy">"Buenos días. Tienes 18 correos nuevos, 3 requieren respuesta urgente. Hoy tienes dos reuniones: a las 11 con Sara y a las 17 con Pedro. Tus hábitos de hoy: agua y ejercicio pendientes. ¿Empezamos?"</div>
            </div>
            <div className="lp-msg">
              <span className="lp-msg-who">Tú</span>
              <div className="lp-msg-text">"Sí. Y recuérdame comprar comida para Ocean a las 6."</div>
            </div>
            <div className="lp-msg">
              <span className="lp-msg-who lucy">Lucy</span>
              <div className="lp-msg-text lp-msg-lucy">"Listo. Te recordaré comprar comida para Ocean hoy a las 18:00. Primer correo prioritario: de Sara García — propuesta de colaboración para el primer trimestre..."</div>
            </div>
          </div>
        </section>

        <div className="lp-wave" />

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