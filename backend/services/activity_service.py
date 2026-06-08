from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from backend.models import ActivityLog
from backend.utils.logger import get_logger

logger = get_logger("activity_service")


async def log_action(db, user_id: str, user_name: str, accion: str,
                     correo_id: str = "", correo_asunto: str = "",
                     correo_de: str = "", categoria: str = "",
                     prioridad: str = "", notas: str = "") -> bool:
    try:
        now = datetime.now(timezone.utc)
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "user_name": user_name,
            "fecha": now.strftime("%Y-%m-%d"),
            "hora": now.strftime("%H:%M:%S"),
            "accion": accion,
            "correo_id": correo_id,
            "correo_asunto": correo_asunto,
            "correo_de": correo_de,
            "categoria": categoria,
            "prioridad": prioridad,
            "notas": notas,
        }
        await db.activity_logs.insert_one(doc)
        return True
    except Exception as e:
        logger.error("Error logging action: %s", e)
        return False


async def get_logs_by_date(db, fecha: Optional[str] = None,
                           user_id: Optional[str] = None) -> List[dict]:
    try:
        if not fecha:
            fecha = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        query = {"fecha": fecha}
        if user_id:
            query["user_id"] = user_id
        cursor = db.activity_logs.find(query, {"_id": 0}).sort("hora", 1)
        return await cursor.to_list(length=500)
    except Exception as e:
        logger.error("Error fetching logs: %s", e)
        return []


def generate_csv(logs: List[dict]) -> str:
    output = io.StringIO()
    campos = ["fecha", "hora", "user_name", "accion", "correo_asunto",
              "correo_de", "categoria", "prioridad", "notas"]
    writer = csv.DictWriter(output, fieldnames=campos, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(logs)
    return output.getvalue()


def generate_pdf(logs: List[dict], fecha: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from io import BytesIO

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    elements = []

    # Colores
    GOLD = colors.HexColor('#C9B27C')
    BLACK = colors.HexColor('#030305')
    DARK = colors.HexColor('#1a1a1f')
    LIGHT = colors.HexColor('#F3F3EE')
    MUTED = colors.HexColor('#888880')

    # Título
    title_style = ParagraphStyle('title', fontName='Helvetica-Bold',
        fontSize=22, textColor=GOLD, spaceAfter=4)
    sub_style = ParagraphStyle('sub', fontName='Helvetica',
        fontSize=9, textColor=MUTED, spaceAfter=20, leading=14)
    label_style = ParagraphStyle('label', fontName='Helvetica-Bold',
        fontSize=7, textColor=GOLD, spaceBefore=16, spaceAfter=6,
        borderPadding=(0,0,4,0))

    elements.append(Paragraph("OBJETIVA.", title_style))
    elements.append(Paragraph(f"Informe de actividad · {fecha}", sub_style))
    elements.append(Spacer(1, 0.3*cm))

    # Resumen
    por_accion = {}
    por_usuario = {}
    for log in logs:
        a = log.get("accion", "OTRO")
        u = log.get("user_name", "—")
        por_accion[a] = por_accion.get(a, 0) + 1
        por_usuario[u] = por_usuario.get(u, 0) + 1

    elements.append(Paragraph("RESUMEN DEL DÍA", label_style))

    resumen_data = [["Acción", "Total"]]
    for accion, total in sorted(por_accion.items(), key=lambda x: -x[1]):
        resumen_data.append([accion, str(total)])
    resumen_data.append(["TOTAL ACCIONES", str(len(logs))])

    t = Table(resumen_data, colWidths=[12*cm, 4*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK),
        ('TEXTCOLOR', (0,0), (-1,0), GOLD),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.HexColor('#0a0a0f'), colors.HexColor('#030305')]),
        ('TEXTCOLOR', (0,1), (-1,-2), LIGHT),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#1a140a')),
        ('TEXTCOLOR', (0,-1), (-1,-1), GOLD),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#2a2010')),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('ALIGN', (1,0), (1,-1), 'CENTER'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.5*cm))

    # Detalle
    elements.append(Paragraph("DETALLE DE ACTIVIDAD", label_style))

    if logs:
        detail_data = [["Hora", "Usuario", "Acción", "Asunto", "Categoría"]]
        for log in logs:
            asunto = log.get("correo_asunto", "")[:45] + ("..." if len(log.get("correo_asunto","")) > 45 else "")
            detail_data.append([
                log.get("hora", "")[:5],
                log.get("user_name", "")[:15],
                log.get("accion", ""),
                asunto,
                log.get("categoria", ""),
            ])

        dt = Table(detail_data, colWidths=[1.5*cm, 3*cm, 3*cm, 7*cm, 2.5*cm])
        dt.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), DARK),
            ('TEXTCOLOR', (0,0), (-1,0), GOLD),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 7),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#0a0a0f'), colors.HexColor('#030305')]),
            ('TEXTCOLOR', (0,1), (-1,-1), LIGHT),
            ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#1a1a1f')),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        elements.append(dt)
    else:
        elements.append(Paragraph("Sin actividad registrada para esta fecha.", sub_style))

    # Footer
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(
        f"Objetiva Broker · Correduría de Seguros · Santa Cruz de Tenerife · Generado el {fecha}",
        ParagraphStyle('footer', fontName='Helvetica', fontSize=7, textColor=MUTED, alignment=1)
    ))

    doc.build(elements)
    return buffer.getvalue()


def generate_summary(logs: List[dict], fecha: str) -> dict:
    total = len(logs)
    por_accion = {}
    por_usuario = {}
    por_categoria = {}

    for log in logs:
        accion = log.get("accion", "OTRO")
        usuario = log.get("user_name", "Desconocido")
        categoria = log.get("categoria", "OTRO")

        por_accion[accion] = por_accion.get(accion, 0) + 1
        por_usuario[usuario] = por_usuario.get(usuario, 0) + 1
        if categoria:
            por_categoria[categoria] = por_categoria.get(categoria, 0) + 1

    return {
        "fecha": fecha,
        "total_acciones": total,
        "por_accion": por_accion,
        "por_usuario": por_usuario,
        "por_categoria": por_categoria,
        "logs": logs,
    }
