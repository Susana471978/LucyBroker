# Lucy — Arquitectura Técnica

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Tailwind + Framer Motion, PWA |
| Backend | FastAPI + Python 3.11, async/await |
| Base de datos | MongoDB Atlas |
| Auth | JWT (24h) + Google OAuth2 + Fernet encryption |
| TTS | OpenAI shimmer (tts-1) |
| Infra | IONOS VPS, nginx, systemd, Let's Encrypt |

## Estructura del backend
backend/
├── server.py          # App principal, auth, middleware
├── api/
│   ├── assistant.py   # Motor conversacional (1577 líneas — ver roadmap)
│   ├── gmail.py       # Integración Gmail OAuth
│   ├── calendar.py    # Integración Google Calendar
│   ├── billing.py     # Stripe webhooks y planes
│   ├── contacts.py    # CRM de contactos
│   ├── tasks.py       # Gestión de tareas
│   ├── habits.py      # Seguimiento de hábitos
│   ├── reminders.py   # Recordatorios
│   ├── alerts.py      # Alertas proactivas
│   ├── memory.py      # Memoria contextual
│   └── vip_companies.py # Empresas prioritarias
├── core/
│   ├── settings.py    # Configuración por entorno
│   └── plans.py       # Definición de planes Stripe
├── services/
│   ├── rules_engine.py     # Priorización de emails
│   ├── gmail_reader.py     # Lectura Gmail
│   ├── google_auth.py      # OAuth token management
│   ├── token_encryption.py # Fernet encryption
│   ├── tts_service.py      # Text-to-speech
│   └── ai_service.py       # OpenAI client
└── utils/
├── logger.py      # Logging + security events
├── rate_limit.py  # Rate limiting middleware
├── csrf.py        # CSRF protection
└── crypto.py      # Utilidades criptográficas
Roadmap de modularización — assistant.py
assistant.py (1577 líneas) será dividido en Q2 2026:
Módulo nuevoContenidoLíneas aprox.assistant/context_builders.py_build_inbox_context, _build_calendar_context, etc.~200assistant/intent_detection.pyis*_intent, _detect_nav_intent~200assistant/email_handler.pyFlujo completo email por voz~300assistant/calendar_handler.pyCreación/lectura de eventos~200assistant/briefing_handler.pyBriefing matutino~150assistant/router.pyEndpoints FastAPI + orquestador~300
Seguridad — estado actual
Ver SECURITY_ROADMAP.md
