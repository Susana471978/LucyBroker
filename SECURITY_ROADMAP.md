# Lucy — Security Roadmap

## Estado: Abril 2026

### Completado
- [x] Security headers nginx (HSTS, CSP, X-Frame-Options, etc.)
- [x] CORS estricto por entorno (prod/dev)
- [x] Rate limiting global (100 req/60s por IP)
- [x] JWT TTL reducido a 24h
- [x] Fernet encryption para tokens OAuth en MongoDB
- [x] CSRF middleware activo
- [x] TLS 1.2/1.3 únicamente

### Planificado — Sprint Q2 2026

#### Auth hardening completo
- [ ] Refresh token (7 días, rotación en cada uso)
- [ ] Access token reducido a 15 minutos
- [ ] Migrar almacenamiento de token: localStorage → httpOnly cookie
- [ ] Endpoint POST /auth/refresh en backend
- [ ] Interceptor axios: renovación silenciosa en 401

#### Endpoints sensibles
- [ ] Rate limiting diferenciado: /auth/* → 10 req/min, /api/tts/* → 20 req/min
- [ ] IP whitelist MongoDB Atlas (solo VPS IONOS 94.143.140.114)

#### Auditoría
- [ ] Logging estructurado de seguridad (accesos, 401s, rate limit hits)
- [ ] Rotación de clave Fernet con re-cifrado de tokens existentes
