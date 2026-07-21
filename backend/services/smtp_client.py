from __future__ import annotations

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from backend.config import settings
from backend.utils.logger import get_logger

logger = get_logger("smtp_client")


def send_email(to: str, subject: str, body: str, html: bool = False) -> bool:
    """Envía un correo usando las credenciales SMTP resueltas en settings
    (que a su vez vienen de Clavex, con fallback al .env)."""
    if not settings.smtp_user or not settings.smtp_password:
        logger.error("No hay credenciales SMTP configuradas (ni en Clavex ni en .env)")
        return False

    msg = MIMEMultipart()
    msg["From"] = settings.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html" if html else "plain"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, [to], msg.as_string())
        logger.info("Correo enviado a %s: %s", to, subject)
        return True
    except Exception as e:
        logger.error("Error enviando correo a %s: %s", to, e)
        return False
