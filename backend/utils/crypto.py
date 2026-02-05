from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from backend.config import settings


def _get_fernet() -> Fernet:
    if not settings.encryption_key:
        raise ValueError("ENCRYPTION_KEY not configured")
    return Fernet(settings.encryption_key)


def encrypt_token(token: str) -> str:
    fernet = _get_fernet()
    return fernet.encrypt(token.encode()).decode()


def decrypt_token(token_encrypted: str) -> str:
    fernet = _get_fernet()
    return fernet.decrypt(token_encrypted.encode()).decode()


def is_encrypted_token_valid(token_encrypted: str) -> bool:
    try:
        decrypt_token(token_encrypted)
        return True
    except (InvalidToken, ValueError):
        return False