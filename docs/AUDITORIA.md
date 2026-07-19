# Auditoría técnica — Lucy Broker

> **Estado verificado el 19 de julio de 2026, commit `7d675a0`.**
> Contrastado contra el código del repositorio y contra producción.
> Esta revisión sustituye a `AUDITORIA_LUCY_SECRETARIA.md`, cuyas
> secciones de despliegue e integraciones contenían conclusiones erróneas.

| Campo | Valor |
|---|---|
| Repositorio | `Susana471978/LucyBroker` (rama `main`) |
| Producción | `/var/www/lucy-broker-repo` · `lucy-broker.objetivabroker.es` |
| Base de datos | MongoDB Atlas, compartida con desarrollo |

---

## 1. Estructura

### Backend

```text
backend/
├── __init__.py  config.py  main.py
├── db.py  (NUEVO)         models.py       server.py  (642 líneas)
├── requirements.txt  requirements_clean.txt  requirements_minimal.txt
├── server.py.bak  server_auth_block.py
├── services/
│   ├── activity_service.py   ai_service.py
│   ├── email_service.py      imap_client.py
│   ├── mensajes_service.py  (NUEVO)
│   ├── processor.py          push_service.py
│   ├── rules_engine.py       scoring_service.py
└── utils/
    └── crypto.py  csrf.py  logger.py  rate_limit.py  response.py

sincronizar_cron.py   (NUEVO, raíz del repo)
```

Pendientes de limpieza: `server.py.bak`, `server_auth_block.py`, los dos
`requirements` alternativos y `frontend/vite.config.js.bak`.

### Frontend

React sobre Vite. El build se genera en `frontend/build/` por override
explícito de `outDir`, no en el `dist/` por defecto.

---

## 2. Backend (FastAPI)

### Endpoints activos

28 rutas bajo `/api`, más `/health` y `/metrics` fuera del router.

| Método y ruta | Auth | Notas |
|---|---|---|
| `POST /api/auth/register` | Pública | |
| `POST /api/auth/login` | Pública | |
| `POST /api/auth/refresh` | Cookie | |
| `POST /api/auth/logout` | Sesión | |
| `GET /api/auth/users` | Admin | |
| `PUT /api/auth/users/{id}/role` | Admin | |
| `POST /api/auth/admin/create-user` | Admin | |
| `GET /api/auth/me` | Sesión | |
| `PUT /api/auth/language` | Sesión | |
| `GET /api/emails` | Sesión | **Filtro `canal` (NUEVO)**. Lee de Mongo |
| `POST /api/emails/sincronizar` | Sesión | **NUEVO** — IMAP → Mongo |
| `POST /api/mensajes/ingesta` | Clave de servicio | **NUEVO** — entrada omnicanal |
| `PATCH /api/emails/{id}/estado` | Sesión | **NUEVO** — nuevo/leído/respondido/archivado |
| `GET /api/emails/{id}` | Sesión | |
| `GET /api/emails/stats/summary` | Sesión | |
| `POST /api/ai/chat` | Sesión | |
| `POST /api/ai/summarize` | Sesión | |
| `POST /api/ai/draft-reply` | Sesión | Corregido: faltaba el `return` |
| `GET /api/` · `GET /api/health` | Mixta | |
| `POST /api/log/accion` | Sesión | |
| `GET /api/log/{informe,global,pdf,csv}` | Admin | |
| `POST /api/push/{subscribe,unsubscribe,send}` | Sesión | Sin colección en Atlas |

### Ingesta omnicanal

`POST /api/mensajes/ingesta` es la vía por la que entran mensajes que no
vienen de IMAP. Se autentica con clave de servicio (cabecera
`X-Ingesta-Key`, comparada con `hmac.compare_digest` contra `INGESTA_KEY`)
porque quien llama es otro proceso, no una persona con sesión iniciada.
Devuelve `503` si la clave no está configurada y `401` si no coincide.

El id se deriva de un SHA-1 sobre canal, contacto, cuerpo y marca temporal,
con prefijo del canal: `web-fed47130d7d0c047`.

### Modelo de datos

`CanalEnum`: `email`, `whatsapp`, `web`, `formulario`, `telefono`.

`EmailEvent` conserva el nombre por compatibilidad, pero incorpora `canal`
con default `email`, de modo que los registros anteriores siguen siendo
válidos.

En `imap_client.py` el id pasó del número de secuencia IMAP a un hash del
`Message-ID`: el número de secuencia se renumera al borrar correos, lo que
provocaba colisiones.

### Colecciones en Atlas

| Colección | Docs | Uso |
|---|---|---|
| `mensajes` | 24 | Bandeja omnicanal (20 email + 4 web). Índices: `id` único, `canal`, `estado` |
| `users` | 8 | Cuentas y roles |
| `activity_logs` | 46 | Auditoría de acciones |
| `emails` | 0 | Huérfana, sustituida por `mensajes`. Candidata a borrado |

`push_subscriptions` no existe pese a haber endpoints de push activos.

### Variables de entorno

19 en producción. **No existe `backend/.env.example`.**

- Infraestructura: `ENV`, `MONGO_URL`, `DB_NAME`
- Seguridad: `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `RATE_LIMIT_REQUESTS`
- Correo: `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`
- IA: `GROQ_API_KEY`
- Mensajería: `TWILIO_*` (4)
- Push: `VAPID_*` (3)
- **`INGESTA_KEY`** — NUEVA, clave de servicio para la ingesta

> `IMAP_PASSWORD` contiene espacios y `VAPID_PRIVATE_KEY` es un PEM
> multilínea. Systemd los lee bien; `source` y `xargs` no. No entrecomillar
> el fichero: systemd no admite comillas.

### Servicio systemd

```ini
WorkingDirectory=/var/www/lucy-broker-repo
EnvironmentFile=/var/www/lucy-broker-repo/backend/.env
ExecStart=/var/www/lucy-broker-repo/venv/bin/uvicorn backend.server:app \
          --host 127.0.0.1 --port 8000
```

### Integraciones

| Integración | Estado | Detalle |
|---|---|---|
| IMAP | Activa | `produccion@objetivabroker.com` |
| Groq | Activa con límite | `llama-3.3-70b-versatile`. Cuota diaria agotada (99.155/100.000) |
| asistente-api | Activa | **NUEVA** — publica solicitudes de reunión vía ingesta |
| Web Push / VAPID | Parcial | Endpoints presentes, sin colección |
| WhatsApp / Twilio | Sin implementar | Variables definidas, sin rutas |
| Gmail / Calendar | Sin implementar | El frontend llama a rutas inexistentes |

---

## 3. Frontend

### Rutas

Dos productos conviven en el mismo bundle:

- **Broker**: `/broker/briefing`, `/broker/bandeja`, `/admin/users`
- **App Lucy**: `/app` y sus 12 subrutas (envueltas en `VoiceProvider`)
- **Públicas**: `/`, `/auth`, `/pricing`, más redirecciones

Esta convivencia es la principal fuente de código muerto del frontend.

### Bandeja omnicanal

`CANAL_COLORS` alineado con `CanalEnum`. La versión anterior definía
`llamada`, canal inexistente en el modelo, y el badge estaba hardcodeado
a "Email".

| Canal | Color | Etiqueta |
|---|---|---|
| `email` | `#7BA7C9` | Email |
| `whatsapp` | `#5FAD7A` | WhatsApp |
| `web` | `#C9A96E` | Web |
| `formulario` | `#A98BC9` | Formulario |
| `telefono` | `#C97B7B` | Teléfono |

`getCanal()` aplica fallback para canales desconocidos.

### Service worker

Registrado desde `frontend/src/registerSW.js`. Cachea raíz, `index.html`,
`manifest.json` y assets estáticos; excluye `/api/`.

> ⚠️ **Tras cada despliegue sirve el bundle anterior** hasta que se
> desregistra. Durante esta revisión provocó un falso negativo. Validar
> siempre en ventana privada o desregistrar antes.

### Auth

JWT emitido en `server.py`, almacenado en `localStorage` (`auth_token`),
enviado por `Authorization: Bearer` más cookies de sesión.
Roles: `director`, `admin`, `agent`.

---

## 4. Flujo de datos de la bandeja

El cambio de arquitectura más relevante: **la bandeja dejó de leer IMAP en
directo y pasó a leer de Mongo.**

### Escritura

- IMAP → `sincronizar_imap()` → enriquecimiento Groq → `guardar_mensaje()` → `mensajes`
- asistente-api → `POST /api/mensajes/ingesta` → `guardar_mensaje()` → `mensajes`

`guardar_mensaje()` usa `$setOnInsert`: nunca sobrescribe. El
enriquecimiento cuesta llamadas al modelo y el estado de lectura se
perdería. Por eso una segunda sincronización devuelve `0 nuevos`, que es
correcto y no un fallo.

### Lectura

`GET /api/emails` → `get_enriched_emails()` → `listar_mensajes()` → Mongo,
ordenado por prioridad.

**La UI nunca toca IMAP. Los correos aparecen solo tras sincronizar.**

### Sincronización programada

`sincronizar_cron.py` llama al servicio directamente, sin pasar por HTTP:
el endpoint exige sesión de usuario y un proceso automático no la tiene.
Carga `backend/.env` con parser propio por lo dicho en §2.

```cron
0 8,11,14,17,20 * * 1-6  cd /var/www/lucy-broker-repo && \
    venv/bin/python sincronizar_cron.py >> /var/log/lucy/sincronizar.log 2>&1
```

Cinco pasadas diarias, L–S. **La frecuencia la limita la cuota de Groq**,
no la necesidad funcional: a ~1.500 tokens por correo, el límite de 100.000
da para unos 66 correos diarios. Rotación semanal en
`/etc/logrotate.d/lucy-sincronizar`.

### Degradación ante fallo del modelo

Ante un `429`, `processor.py` recurre a `_fallback()`: clasificación por
palabras clave sobre el asunto. El mensaje se guarda igualmente y aparece
en la bandeja. **No se pierde correo, pero no queda registro de qué
mensajes se clasificaron sin modelo** (ver §6).

---

## 5. Despliegue

| Componente | Ubicación |
|---|---|
| Repo en el VPS | `/var/www/lucy-broker-repo` |
| Servicio | `lucy-broker.service` → uvicorn `127.0.0.1:8000` |
| Frontend servido | `/var/www/lucy-broker` (nginx) |
| Dominio | `lucy-broker.objetivabroker.es` |
| Asistente web | `/opt/asistente-api` → uvicorn `127.0.0.1:8020`, usuario `asistente` |

### Procedimiento

1. `git pull` en `/var/www/lucy-broker-repo`
2. `venv/bin/pip install -r backend/requirements.txt` (falla en `emergentintegrations`, sin consecuencias)
3. `npm run build` en `frontend/` → `frontend/build/`
4. `rsync -a --delete frontend/build/ /var/www/lucy-broker/`
5. `systemctl restart lucy-broker`
6. **Desregistrar el service worker antes de validar visualmente**

### Conexión con el asistente virtual

`core/lucy_client.py` en asistente-api publica las solicitudes de reunión
en la bandeja. El envío es **deliberadamente no bloqueante**: si Lucy no
está configurada o no responde, se registra y el asistente sigue
funcionando. El usuario recibe su confirmación en cualquier caso.

Con `LUCY_INGESTA_URL` vacía el cliente no hace nada y lo anota en el log
— mismo patrón que el SMTP del informe diario de ObjSin. Esto permitió
desplegar el código antes de que existiera el destino.

Usa `127.0.0.1:8000` en lugar del dominio: ambos servicios están en la
misma máquina.

---

## 6. Deuda técnica

### Requiere atención

| Asunto | Detalle | Prioridad |
|---|---|---|
| Rotación de credenciales de Atlas | Pendiente desde antes de esta sesión | **Alta** |
| Cuota de Groq | Límite diario alcanzado. Condiciona la frecuencia de sync. Valorar Dev Tier | **Alta** |
| Sin marca de enriquecimiento | Los mensajes clasificados por reglas ante un 429 no se distinguen de los procesados por IA. Nadie los reprocesa | Media |
| `emergentintegrations==0.1.0` | Paquete inexistente en PyPI. Hace fallar `pip install` | Media |
| Caché del service worker | Sin versionado. Sirve bundles obsoletos | Media |
| Registro de origen desconocido | Entrada "Luis Perez", no atribuible a las pruebas | Media |
| Colección `emails` vacía | Confirmar y eliminar | Baja |
| Ficheros `.bak` | `server.py.bak`, `vite.config.js.bak`, requirements duplicados | Baja |
| Sin `backend/.env.example` | 19 variables sin documentar | Baja |

### Funcionalidad incompleta

- **WhatsApp**: credenciales Twilio definidas, sin rutas ni webhook. `CanalEnum` ya lo contempla
- **Formulario**: canal previsto, sin productor
- **Gmail / Calendar**: el frontend llama a rutas que el backend no expone
- **Push**: endpoints activos, colección inexistente
- **Dos productos en un bundle**: broker de Objetiva + app personal de Lucy

### Cerrado el 19 de julio de 2026

| Asunto | Resolución |
|---|---|
| `config.py` no leía claves con alias | `BaseModel` no resuelve alias; `groq_api_key` valía siempre `None` |
| `ai_service` a `None` y tres `return` ausentes | Toda la IA respondía 503 o `null` |
| Nivel 3 del asistente caído | Groq retiró `llama-4-scout`; sustituido por `llama-3.3-70b-versatile` |
| Id IMAP inestable | Del número de secuencia al hash del `Message-ID` |
| Solicitudes de reunión perdidas | Ingesta conectada y verificada end-to-end |
| Canal no visible en la bandeja | Badge dinámico alineado con `CanalEnum` |
| Sincronización sin automatizar | `sincronizar_cron.py` + cron cada 3 horas |
