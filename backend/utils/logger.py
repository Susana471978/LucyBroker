from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional


class UTCFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=timezone.utc)
        return dt.strftime(datefmt or "%Y-%m-%dT%H:%M:%SZ")


def configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    formatter = UTCFormatter("[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s")
    handler.setFormatter(formatter)

    root = logging.getLogger()
    if not root.handlers:
        root.addHandler(handler)
    root.setLevel(level)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    return logging.getLogger(name)


# Inicializar logging por defecto
configure_logging()

# Logger principal del sistema
logger = get_logger("emailsystem")

import json

security_logger = get_logger("emailsystem.security")

def log_security_event(event: str, details: dict, level: str = "warning") -> None:
    """Log structured security events for auditing."""
    record = {
        "event": event,
        **details,
    }
    msg = json.dumps(record, default=str)
    if level == "critical":
        security_logger.critical(msg)
    elif level == "error":
        security_logger.error(msg)
    elif level == "info":
        security_logger.info(msg)
    else:
        security_logger.warning(msg)
