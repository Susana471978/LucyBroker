# SECURITY BASELINE

## Principios
- No secretos hardcodeados.
- Tokens Gmail cifrados con Fernet (ENCRYPTION_KEY).
- Logs sin datos sensibles.
- Rate limit básico por IP.
- CSRF en OAuth.

## Cifrado de Tokens Gmail
- `ENCRYPTION_KEY` debe ser una clave Fernet válida.
- Se cifra antes de persistir en MongoDB.
- La validación de cifrado se realiza al consultar el token.

## JWT
- JWT usa `JWT_SECRET` desde entorno.
- Si no está definido, se genera un secreto efímero en runtime (solo entorno dev).
- Tokens expiran automáticamente vía `exp`.

## CSRF OAuth
- Middleware valida `X-CSRF-Token` contra cookie `csrf_token` o query param `state`.
- Solo aplica a rutas `/api/oauth*` y métodos mutables.

## Logs
- Formato: [TIMESTAMP] [MODULE] [LEVEL] message
- No se loguean tokens ni payloads sensibles.

## Riesgos Conocidos
- Falta de almacenamiento seguro para rate-limit distribuido.
- Redis se valida solo si se configura `REDIS_URL` y librería disponible.
- Gmail token storage requiere colección `gmail_tokens` con `token` y `expires_at`.