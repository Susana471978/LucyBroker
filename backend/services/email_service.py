from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from backend.models import EmailAttachment, EmailEvent, EnrichedEmail
from backend.services.rules_engine import calculate_priority
from backend.utils.crypto import is_encrypted_token_valid


MOCK_EMAILS: List[EmailEvent] = [
    EmailEvent(
        id="email-001",
        thread_id="thread-001",
        from_name="Carlos Mendoza",
        from_email="carlos.mendoza@acme.com",
        subject="URGENTE: Revisión contrato Q1 - Firma requerida hoy",
        date="2026-01-15T09:30:00Z",
        snippet="Necesitamos tu firma antes de las 5pm para cerrar el acuerdo con el cliente principal...",
        body="""Hola,

Necesitamos tu firma antes de las 5pm para cerrar el acuerdo con el cliente principal. El contrato ya fue revisado por legal y finanzas.

Puntos clave:
- Valor total: $250,000 USD
- Duración: 12 meses
- Cláusula de renovación automática

Por favor revisa el documento adjunto y confirma tu aprobación lo antes posible.

Saludos,
Carlos Mendoza
Director Comercial""",
        labels=["importante", "contratos"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-001", name="Contrato_Q1_2026.pdf", size=2456789, mime_type="application/pdf"),
            EmailAttachment(id="att-002", name="Anexo_Legal.docx", size=156234, mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ],
    ),
    EmailEvent(
        id="email-002",
        thread_id="thread-002",
        from_name="Ana García",
        from_email="ana.garcia@techstart.io",
        subject="Propuesta colaboración estratégica - TechStart",
        date="2026-01-15T08:15:00Z",
        snippet="Me gustaría explorar una posible alianza entre nuestras empresas para el mercado LATAM...",
        body="""Estimado/a,

Me gustaría explorar una posible alianza entre nuestras empresas para el mercado LATAM.

TechStart ha crecido un 300% este año y buscamos partners estratégicos para expandir nuestra oferta.

¿Podríamos agendar una llamada esta semana?

Adjunto nuestra presentación corporativa.

Saludos cordiales,
Ana García
CEO, TechStart""",
        labels=["negocios", "oportunidades"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-003", name="TechStart_Presentacion_2026.pdf", size=5678901, mime_type="application/pdf"),
        ],
    ),
    EmailEvent(
        id="email-003",
        thread_id="thread-003",
        from_name="Sistema de Pagos",
        from_email="noreply@pagos.empresa.com",
        subject="Factura #INV-2026-0142 - Vencimiento próximo",
        date="2026-01-14T16:45:00Z",
        snippet="Su factura por $12,500 vence en 3 días. Por favor realice el pago para evitar...",
        body="""Estimado cliente,

Le recordamos que su factura #INV-2026-0142 por un monto de $12,500 USD vence el 17 de enero de 2026.

Por favor realice el pago para evitar cargos por mora.

Puede pagar directamente en nuestro portal o transferencia bancaria.

Atentamente,
Sistema de Pagos Automático""",
        labels=["finanzas", "facturas"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-004", name="Factura_INV-2026-0142.pdf", size=234567, mime_type="application/pdf"),
        ],
    ),
    EmailEvent(
        id="email-004",
        thread_id="thread-004",
        from_name="Roberto Sánchez",
        from_email="roberto.sanchez@cliente-vip.com",
        subject="RE: Problema con el servicio - Escalación",
        date="2026-01-15T07:20:00Z",
        snippet="Llevamos 3 días sin resolver el problema. Si no tenemos solución hoy, evaluaremos alternativas...",
        body="""Buenos días,

Llevamos 3 días sin resolver el problema reportado. Nuestras operaciones están afectadas significativamente.

Si no tenemos una solución definitiva hoy antes de las 2pm, nos veremos obligados a evaluar alternativas y escalar con su dirección general.

Esperamos su respuesta urgente.

Roberto Sánchez
Director de Operaciones
Cliente VIP Corp""",
        labels=["soporte", "urgente", "escalación"],
    ),
    EmailEvent(
        id="email-005",
        thread_id="thread-005",
        from_name="Newsletter Tech",
        from_email="news@tech-weekly.com",
        subject="Top 10 tendencias tecnológicas para 2026",
        date="2026-01-14T10:00:00Z",
        snippet="Descubre las tendencias que dominarán el panorama tecnológico este año...",
        body="""¡Hola!

Esta semana te traemos las 10 tendencias tecnológicas más importantes para 2026:

1. IA Generativa en empresas
2. Computación cuántica práctica
3. Web3 y descentralización
4. Ciberseguridad con IA
5. Automatización inteligente
...

Lee el artículo completo en nuestro sitio.

Saludos,
El equipo de Tech Weekly""",
        labels=["newsletter", "información"],
    ),
    EmailEvent(
        id="email-006",
        thread_id="thread-006",
        from_name="María López",
        from_email="maria.lopez@rrhh.empresa.com",
        subject="Recordatorio: Evaluación de desempeño Q4",
        date="2026-01-13T14:30:00Z",
        snippet="Te recordamos completar tu autoevaluación antes del viernes...",
        body="""Hola,

Te recordamos que debes completar tu autoevaluación de desempeño Q4 antes del viernes 17 de enero.

Accede al portal de RRHH para completar el formulario.

Cualquier duda, estamos a tu disposición.

Saludos,
María López
Recursos Humanos""",
        labels=["rrhh", "interno"],
    ),
    EmailEvent(
        id="email-007",
        thread_id="thread-007",
        from_name="Pedro Martínez",
        from_email="pedro.martinez@proveedor.com",
        subject="Confirmación pedido #PO-2026-089",
        date="2026-01-14T11:20:00Z",
        snippet="Confirmamos la recepción de su orden de compra. Fecha estimada de entrega...",
        body="""Estimado cliente,

Confirmamos la recepción de su orden de compra #PO-2026-089.

Detalles:
- Productos: 50 unidades modelo X-500
- Valor total: $75,000 USD
- Fecha estimada entrega: 22 de enero 2026

El envío será coordinado con su departamento de logística.

Atentamente,
Pedro Martínez
Ventas Corporativas""",
        labels=["compras", "proveedores"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-005", name="Confirmacion_PO-2026-089.pdf", size=189234, mime_type="application/pdf"),
        ],
    ),
    EmailEvent(
        id="email-008",
        thread_id="thread-008",
        from_name="Alertas Sistema",
        from_email="alerts@monitoring.empresa.com",
        subject="[ALERTA] Uso de CPU alto en servidor PROD-01",
        date="2026-01-15T06:45:00Z",
        snippet="Se ha detectado uso de CPU superior al 90% en el servidor de producción...",
        body="""ALERTA DE SISTEMA

Servidor: PROD-01
Métrica: CPU Usage
Valor actual: 94%
Umbral: 90%
Hora detección: 06:45 UTC

Acción recomendada: Revisar procesos activos y escalar horizontalmente si es necesario.

Este es un mensaje automático del sistema de monitoreo.""",
        labels=["sistema", "alertas", "técnico"],
    ),
    EmailEvent(
        id="email-009",
        thread_id="thread-009",
        from_name="Laura Fernández",
        from_email="laura.fernandez@partner.com",
        subject="Reunión estratégica - Agenda confirmada",
        date="2026-01-14T09:00:00Z",
        snippet="Confirmo la reunión del jueves 16 a las 10am. Adjunto la agenda propuesta...",
        body="""Hola,

Confirmo nuestra reunión estratégica para el jueves 16 de enero a las 10:00am (hora local).

Agenda:
1. Revisión resultados Q4
2. Objetivos Q1 2026
3. Nuevas iniciativas conjuntas
4. Próximos pasos

Por favor confirma tu asistencia.

Saludos,
Laura Fernández""",
        labels=["reuniones", "partners"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-006", name="Agenda_Reunion_16Ene.docx", size=45678, mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ],
    ),
    EmailEvent(
        id="email-010",
        thread_id="thread-010",
        from_name="Promociones Empresa",
        from_email="promo@tienda-online.com",
        subject="¡50% de descuento solo por hoy!",
        date="2026-01-13T08:00:00Z",
        snippet="Aprovecha nuestra mega oferta de enero. Descuentos en toda la tienda...",
        body="""¡MEGA OFERTA DE ENERO!

Solo por hoy, 50% de descuento en todos los productos.

Usa el código: ENERO50

¡No te lo pierdas!

Términos y condiciones aplican.

Tienda Online""",
        labels=["promociones", "spam"],
    ),
    EmailEvent(
        id="email-011",
        thread_id="thread-011",
        from_name="Diego Torres",
        from_email="diego.torres@legal.empresa.com",
        subject="Revisión urgente: Cláusulas contrato Proyecto Delta",
        date="2026-01-15T10:15:00Z",
        snippet="Necesito tu feedback sobre las cláusulas 4.2 y 7.1 del contrato antes de enviarlo al cliente...",
        body="""Hola,

Necesito tu feedback urgente sobre las cláusulas 4.2 (responsabilidades) y 7.1 (penalizaciones) del contrato del Proyecto Delta.

El cliente espera la versión final hoy a las 3pm.

Las cláusulas en cuestión están resaltadas en el documento adjunto.

¿Puedes revisarlo en la próxima hora?

Gracias,
Diego Torres
Asesor Legal""",
        labels=["legal", "urgente", "contratos"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-007", name="Contrato_Proyecto_Delta_v3.pdf", size=3456789, mime_type="application/pdf"),
        ],
    ),
    EmailEvent(
        id="email-012",
        thread_id="thread-012",
        from_name="Soporte IT",
        from_email="soporte@it.empresa.com",
        subject="Ticket #IT-4521 resuelto",
        date="2026-01-14T15:30:00Z",
        snippet="Tu ticket sobre el acceso VPN ha sido resuelto. Por favor verifica...",
        body="""Hola,

Tu ticket #IT-4521 sobre problemas de acceso VPN ha sido resuelto.

Solución aplicada: Regeneración de certificados y actualización de configuración.

Por favor verifica que puedes conectarte correctamente y cierra el ticket si todo funciona.

Soporte IT""",
        labels=["it", "soporte", "resuelto"],
    ),
]


def get_enriched_emails() -> List[EnrichedEmail]:
    result = []
    for email in MOCK_EMAILS:
        priority = calculate_priority(email)
        result.append(EnrichedEmail(email=email, priority=priority))
    return sorted(result, key=lambda x: x.priority.priority_score, reverse=True)


def get_email_by_id(email_id: str) -> Optional[EmailEvent]:
    for email in MOCK_EMAILS:
        if email.id == email_id:
            return email
    return None


def get_email_stats() -> Dict[str, int]:
    emails = get_enriched_emails()
    return {
        "total": len(emails),
        "prioritarios": len([e for e in emails if e.priority.priority_label == "PRIORITARIO"]),
        "seguimiento": len([e for e in emails if e.priority.priority_label == "SEGUIMIENTO"]),
        "info": len([e for e in emails if e.priority.priority_label == "INFO"]),
        "with_attachments": len([e for e in emails if e.email.has_attachments]),
    }


async def get_gmail_token_status(db) -> Dict[str, Any]:
    token_doc = await db.gmail_tokens.find_one({}, {"_id": 0})
    if not token_doc:
        return {"status": "not_configured"}

    token_encrypted = token_doc.get("token")
    expires_at = token_doc.get("expires_at")
    if not token_encrypted:
        return {"status": "missing_token"}

    if not is_encrypted_token_valid(token_encrypted):
        return {"status": "invalid_encryption"}

    if expires_at:
        try:
            expiry = datetime.fromisoformat(expires_at)
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if expiry <= datetime.now(timezone.utc):
                return {"status": "expired", "expires_at": expiry.isoformat()}
            return {"status": "ok", "expires_at": expiry.isoformat()}
        except ValueError:
            return {"status": "invalid_expiry"}

    return {"status": "ok", "expires_at": None}