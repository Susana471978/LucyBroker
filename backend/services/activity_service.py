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
