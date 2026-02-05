# ARCHITECTURE v1

## Visión General
Backend basado en FastAPI con capa de servicios y contratos de datos. Frontend permanece sin cambios (solo consumo de API).

```
┌──────────────┐        ┌────────────────────┐        ┌───────────────────┐
│  Frontend    │  HTTP  │ FastAPI (API)      │  Calls │ Services Layer    │
│  React       ├───────►│ /api/*             ├───────►│ email_service     │
└──────────────┘        │ /health /metrics   │        │ rules_engine      │
                         └─────────┬──────────┘        │ ai_service        │
                                   │                   └─────────┬────────┘
                                   │                             │
                                   ▼                             ▼
                           ┌───────────────┐             ┌────────────────┐
                           │ MongoDB       │             │ External APIs   │
                           │ users, tokens │             │ Gmail, LLM      │
                           └───────────────┘             └────────────────┘
```

## Flujo OAuth (Módulo 01)
1. Frontend inicia OAuth y obtiene `state`.
2. Backend valida CSRF (header + cookie o `state`).
3. Backend intercambia `code` por tokens en Gmail.
4. Tokens se cifran y almacenan en MongoDB.
5. Respuesta normalizada disponible bajo formato estándar.

## Flujo Gmail
1. Backend recupera token cifrado desde MongoDB.
2. Se descifra en memoria (nunca se loguea).
3. Se valida expiración; si caducado, se refresca.
4. Se realizan consultas a Gmail y se normalizan eventos.

## Modelo de Datos (resumen)
- users: credenciales básicas, idioma, timestamps.
- gmail_tokens: token cifrado, refresh token cifrado, expiración.
- emails (futuro): representación normalizada de mensajes.

## Riesgos Conocidos
- Rate limit in-memory (no distribuido) en múltiples instancias.
- Validación OAuth CSRF habilitada solo en rutas `/api/oauth*`.
- Respuesta estándar requiere `X-Response-Format: standard` para evitar ruptura de clientes legacy.