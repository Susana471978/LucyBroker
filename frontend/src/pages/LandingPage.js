import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroImage from '../assets/Objetiva.png';

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

    document.querySelectorAll('.feature-card, blockquote').forEach((el) => {
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
          --champagne: #E8D5A3;
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
          color: rgba(232,213,163,0.8);
          transition: 0.3s;
          white-space: nowrap;
        }

        .lp-nav-links a:hover {
          color: var(--champagne);
        }

        .lp-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2rem;
          letter-spacing: 0.2em;
          color: var(--gold);
          cursor: pointer;
          text-shadow: 0 0 12px rgba(201,178,124,0.28), 0 0 28px rgba(201,178,124,0.20);
          transition: color .28s ease, text-shadow .28s ease, transform .28s ease;
        }

        .lp-logo span {
          color: var(--champagne);
          text-shadow: 0 0 14px rgba(232,213,163,0.34);
        }

        .lp-logo:hover {
          color: var(--champagne);
          text-shadow: 0 0 16px rgba(201,178,124,0.44), 0 0 34px rgba(201,178,124,0.28);
          transform: translateY(-1px);
        }

        .lp-logo-sub {
          font-size: 9px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(201,178,124,0.5);
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 300;
          display: block;
          margin-top: 2px;
        }

        .lp-nav-cta {
          padding: 0.78rem 1.75rem;
          border: 1px solid rgba(201,178,124,0.42);
          border-radius: 2px;
          color: var(--champagne);
          background: rgba(3,3,5,0.6);
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          cursor: pointer;
          position: relative;
          box-shadow: 0 0 0 1px rgba(201,178,124,0.08) inset, 0 0 10px rgba(201,178,124,0.10);
          transition: border-color .28s ease, box-shadow .28s ease, transform .28s ease, color .28s ease, background .28s ease;
        }

        .lp-nav-cta:hover {
          border-color: rgba(201,178,124,0.88);
          color: #FFF7E8;
          background: rgba(201,178,124,0.08);
          box-shadow: 0 0 0 1px rgba(201,178,124,0.14) inset, 0 0 14px rgba(201,178,124,0.26), 0 0 30px rgba(201,178,124,0.16);
          transform: translateY(-1px);
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
          opacity: 0.85;
          filter: sepia(0.4) saturate(0.6) hue-rotate(5deg) brightness(0.85);
        }

        .hero-content {
          position: relative;
          z-index: 10;
          max-width: 600px;
        }

        .lp-eyebrow {
          font-size: 9px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--gold);
          opacity: 0.7;
          margin-bottom: 1.2rem;
          display: block;
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
          font-size: 1rem;
          line-height: 1.75;
          color: var(--gray);
          margin-bottom: 3rem;
          max-width: 420px;
        }

        .btn-main {
          padding: 0.88rem 2rem;
          border: 1px solid rgba(201,178,124,0.5);
          border-radius: 2px;
          color: var(--champagne);
          background: rgba(3,3,5,0.5);
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 0 0 1px rgba(201,178,124,0.08) inset, 0 0 14px rgba(201,178,124,0.12);
          transition: all .28s ease;
        }

        .btn-main:hover {
          border-color: rgba(201,178,124,0.88);
          color: #FFF7E8;
          background: rgba(201,178,124,0.08);
          box-shadow: 0 0 0 1px rgba(201,178,124,0.14) inset, 0 0 20px rgba(201,178,124,0.22), 0 0 40px rgba(201,178,124,0.14);
          transform: translateY(-1px);
        }

        /* ══ DIVIDER ══ */
        .lp-wave {
          width: 1px;
          height: 100px;
          background: linear-gradient(to bottom, transparent, rgba(201,178,124,0.3), transparent);
          margin: 0 auto;
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

        /* ══ STATS ══ */
        .lp-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(201,178,124,0.1);
          border: 1px solid rgba(201,178,124,0.1);
          margin-bottom: 8rem;
        }

        .lp-stat {
          padding: 3rem 2rem;
          background: #030305;
          text-align: center;
        }

        .lp-stat-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 3.5rem;
          font-weight: 300;
          color: var(--gold);
          line-height: 1;
          margin-bottom: 0.5rem;
        }

        .lp-stat-label {
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
        }

        /* ══ FEATURES ══ */
        .lp-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(201,178,124,0.08);
          margin-top: 4rem;
        }

        .feature-card {
          background: #030305;
          padding: 3.5rem 2.5rem;
          transition: background .28s ease;
          position: relative;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(201,178,124,0);
          transition: background .28s ease;
        }

        .feature-card:hover {
          background: rgba(201,178,124,0.04);
        }

        .feature-card:hover::before {
          background: rgba(201,178,124,0.5);
        }

        .feature-card.priority {
          background: rgba(201,178,124,0.03);
        }

        .feature-card.priority::before {
          background: rgba(201,178,124,0.3);
        }

        .lp-feature-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 2.5rem;
          color: rgba(201,178,124,0.25);
          margin-bottom: 1.5rem;
          transition: color .28s ease;
        }

        .feature-card:hover .lp-feature-num,
        .feature-card.priority .lp-feature-num {
          color: rgba(201,178,124,0.6);
        }

        .lp-feature-tag {
          display: inline-block;
          font-size: 8px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--gold);
          border: 1px solid rgba(201,178,124,0.3);
          padding: 3px 8px;
          border-radius: 1px;
          margin-bottom: 1rem;
        }

        .lp-feature-title {
          font-size: 0.8rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 1rem;
          color: #F4F4F0;
        }

        .lp-feature-desc {
          font-size: 0.88rem;
          color: rgba(255,255,255,0.5);
          line-height: 1.8;
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
          color: #F3F3EE;
          text-align: center;
          margin: 0 auto;
          max-width: 900px;
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
          border-top: 1px solid rgba(201,178,124,0.08);
          border-bottom: 1px solid rgba(201,178,124,0.08);
        }

        .lp-quote-mark {
          display: block;
          font-family: 'Cormorant Garamond', serif;
          font-size: 7rem;
          line-height: 0.7;
          color: rgba(201,178,124,0.12);
          margin-bottom: 1.2rem;
        }

        .lp-quote blockquote {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(1.6rem,3.1vw,2.9rem);
          font-style: italic;
          font-weight: 300;
          line-height: 1.55;
          color: #F3F3EE;
          max-width: 1000px;
          margin: 0 auto;
        }

        /* ══ CTA FINAL ══ */
        .lp-cta-section {
          text-align: center;
          padding: 10rem 10%;
        }

        .lp-cta-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(2.8rem, 5vw, 4.5rem);
          font-weight: 300;
          color: #F3F3EE;
          margin-bottom: 1.5rem;
          line-height: 1.05;
        }

        .lp-cta-headline em {
          font-style: italic;
          color: var(--gold);
        }

        .lp-cta-sub {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.45);
          margin-bottom: 3rem;
          line-height: 1.7;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        /* ══ FOOTER ══ */
        .lp-footer {
          padding: 3rem 10%;
          border-top: 1px solid rgba(201,178,124,0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        /* ══ RESPONSIVE ══ */
        @media (max-width: 1024px) {
          .lp-nav { padding: 2rem 6%; }
          .lp-nav-links { gap: 1.4rem; }
          .lp-hero { padding: 0 6%; }
          .lp-features-grid { grid-template-columns: 1fr 1fr; }
          .lp-stats { grid-template-columns: 1fr 1fr; }
          .section-padding, .lp-quote, .lp-footer { padding-left: 6%; padding-right: 6%; }
        }

        @media (max-width: 768px) {
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-stats { grid-template-columns: 1fr; }
          .lp-nav { padding: calc(1rem + env(safe-area-inset-top)) 4% 1rem; }
          .lp-nav-links { gap: 1rem; }
          .lp-nav-links a { font-size: 0.58rem; letter-spacing: 0.14em; }
          .lp-logo { font-size: 1.6rem; letter-spacing: 0.14em; }
          .lp-nav-cta { padding: 0.68rem 0.95rem; font-size: 0.56rem; }
          .lp-hero {
            min-height: 100svh;
            height: auto;
            padding: calc(8.4rem + env(safe-area-inset-top)) 6% 4rem;
            align-items: flex-start;
          }
          .hero-img-container {
            position: absolute; right: 0; top: 0;
            width: 100%; height: 80%; z-index: 1; overflow: hidden;
          }
          .hero-img {
            width: 100%; height: 100%; object-fit: cover;
            object-position: 68% top;
            mask-image: linear-gradient(to left, black 56%, transparent 100%);
            opacity: 0.25;
          }
          .hero-content { max-width: 100%; }
          .lp-h1 { font-size: clamp(2.5rem, 12vw, 4rem); line-height: 0.96; margin-bottom: 1rem; }
          .hero-subtext { font-size: 0.95rem; max-width: 92%; margin-bottom: 2rem; }
          .section-padding { padding: 6rem 5%; }
          .lp-footer { flex-direction: column; gap: 1rem; text-align: center; padding-left: 5%; padding-right: 5%; }
        }
      `}</style>

      <div className="lp-wrap">
        <GoldParticles />

        {/* NAV */}
        <nav className="lp-nav">
          <div onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="lp-logo">OBJETIVA<span>.</span></div>
            <span className="lp-logo-sub">Correduría de Seguros</span>
          </div>

          <ul className="lp-nav-links">
            <li><a href="#funciones">Funciones</a></li>
            <li><a href="#contacto">Contacto</a></li>
            <li>
              <button className="lp-nav-cta" onClick={() => navigate('/auth')}>
                Acceder
              </button>
            </li>
          </ul>
        </nav>

        {/* HERO */}
        <section className="lp-hero">
          <div className="hero-content">
            <span className="lp-eyebrow">Inteligencia artificial para corredurías</span>
            <h1 className="lp-h1">
              La bandeja<br />
              inteligente para<br />
              tu <em>correduría.</em>
            </h1>

            <p className="hero-subtext">
              Objetiva clasifica, prioriza y redacta respuestas a los correos de tu equipo. Los siniestros siempre primero. El resto, en orden.
            </p>

            <button type="button" className="btn-main" onClick={() => navigate('/auth')}>
              Solicitar acceso
            </button>
          </div>

          <div className="hero-img-container">
            <img src={HeroImage} alt="Objetiva" className="hero-img" />
          </div>
        </section>

        <div className="lp-wave" />

        {/* STATS */}
        <section className="section-padding" style={{ paddingBottom: '0' }}>
          <div className="lp-stats">
            <div className="lp-stat">
              <div className="lp-stat-num">-3h</div>
              <div className="lp-stat-label">de trabajo administrativo al día</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-num">100%</div>
              <div className="lp-stat-label">de correos clasificados al instante</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-num">0</div>
              <div className="lp-stat-label">siniestros urgentes sin respuesta</div>
            </div>
          </div>
        </section>

        <div className="lp-wave" />

        {/* FEATURES */}
        <section className="section-padding" id="funciones">
          <div className="lp-features-header">
            <span className="label">Capacidades</span>
            <h2 className="lp-features-headline">
              Diseñada para el ritmo<br />
              <em>real de una correduría.</em>
            </h2>
          </div>

          <div className="lp-features-grid">
            {[
              {
                num: '01',
                tag: 'Prioridad máxima',
                title: 'Siniestros primero',
                desc: 'Objetiva detecta y escala automáticamente cualquier comunicación relacionada con siniestros. Nunca más un siniestro urgente enterrado en la bandeja.',
                priority: true,
              },
              {
                num: '02',
                tag: 'Prioridad alta',
                title: 'Solicitudes de clientes',
                desc: 'Las peticiones de clientes se clasifican y priorizan por urgencia. Objetiva extrae el nombre, número de póliza y tipo de consulta de cada correo.',
                priority: true,
              },
              {
                num: '03',
                tag: 'Gestión documental',
                title: 'Documentación y pólizas',
                desc: 'Correos con pólizas adjuntas, renovaciones y documentación quedan organizados y listos para gestionar, sin perder ningún archivo importante.',
                priority: false,
              },
              {
                num: '04',
                tag: 'IA generativa',
                title: 'Borradores automáticos',
                desc: 'Objetiva redacta dos opciones de respuesta para cada correo, adaptadas al tono de tu correduría. Tu equipo edita y envía en segundos.',
                priority: false,
              },
              {
                num: '05',
                tag: 'Alertas inteligentes',
                title: 'Recordatorios de seguimiento',
                desc: 'Si un correo tiene fecha límite o requiere respuesta urgente, Objetiva crea un recordatorio automático para que nada quede sin atender.',
                priority: false,
              },
              {
                num: '06',
                tag: 'Panel unificado',
                title: 'Bandeja centralizada',
                desc: 'Todo el equipo ve la misma bandeja ordenada por prioridad, con el score de urgencia visible en cada correo. Sin emails perdidos, sin duplicados.',
                priority: false,
              },
            ].map(({ num, tag, title, desc, priority }) => (
              <div className={`feature-card${priority ? ' priority' : ''}`} key={num}>
                <div className="lp-feature-num">{num}</div>
                {priority && <div className="lp-feature-tag">{tag}</div>}
                <div className="lp-feature-title">{title}</div>
                <p className="lp-feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* QUOTE */}
        <section className="lp-quote">
          <span className="lp-quote-mark">"</span>
          <blockquote>
            En una correduría, cada minuto que se pierde en clasificar correos es un minuto que no se dedica al cliente.
            Objetiva devuelve ese tiempo.
          </blockquote>
        </section>

        {/* CTA FINAL */}
        <section className="lp-cta-section" id="contacto">
          <h2 className="lp-cta-headline">
            Tu equipo merece<br />
            trabajar con <em>claridad.</em>
          </h2>
          <p className="lp-cta-sub">
            Objetiva está diseñada para corredurías que quieren responder más rápido, cometer menos errores y dedicar su tiempo a lo que importa.
          </p>
          <button type="button" className="btn-main" onClick={() => navigate('/auth')}>
            Solicitar acceso
          </button>
        </section>

        {/* FOOTER */}
        <footer className="lp-footer">
          <div>
            <div className="lp-logo" style={{ fontSize: '1.4rem' }}>OBJETIVA<span>.</span></div>
            <span className="lp-logo-sub">Correduría de Seguros</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>
            © 2026 Syntexia Solutions · Objetiva · España
          </p>
        </footer>
      </div>
    </>
  );
}
