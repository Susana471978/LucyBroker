#!/usr/bin/env python3
"""Sincronizacion IMAP -> Mongo para cron.

La bandeja lee de Mongo, asi que sin este paso los correos nuevos no
aparecen. Llama al servicio directamente, sin pasar por HTTP: el
endpoint /api/emails/sincronizar exige sesion de usuario y un proceso
automatico no la tiene.

Carga el .env con un parser propio en vez de delegar en el shell:
IMAP_PASSWORD lleva espacios y VAPID_PRIVATE_KEY es PEM multilinea, y
ni `source` ni `xargs` los respetan. Systemd si los lee bien, asi que
el fichero se deja tal cual esta.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("sincronizar_cron")


def cargar_env(ruta: Path) -> int:
    """Carga KEY=VALOR en os.environ. El valor se toma literal."""
    if not ruta.exists():
        logger.error("No se encuentra el fichero de entorno: %s", ruta)
        return 0
    cargadas = 0
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, _, valor = linea.partition("=")
        clave = clave.strip()
        if clave:
            os.environ.setdefault(clave, valor)
            cargadas += 1
    return cargadas


async def main() -> int:
    cargadas = cargar_env(RAIZ / "backend" / ".env")
    logger.info("Variables de entorno cargadas: %s", cargadas)

    for obligatoria in ("MONGO_URL", "DB_NAME", "IMAP_HOST", "IMAP_USER"):
        if not os.environ.get(obligatoria):
            logger.error("Falta la variable %s; se aborta", obligatoria)
            return 1

    from backend.services.email_service import sincronizar_imap

    try:
        resultado = await sincronizar_imap()
    except Exception:
        logger.exception("Fallo la sincronizacion IMAP")
        return 1

    logger.info("Sincronizacion completada: %s", resultado)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
