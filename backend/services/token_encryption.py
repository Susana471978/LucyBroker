# backend/services/token_encryption.py

"""
Encrypts and decrypts OAuth tokens stored in MongoDB using Fernet (AES-128-CBC).

Usage:
    from backend.services.token_encryption import encrypt_tokens, decrypt_tokens

    # Before saving to DB:
    encrypted = encrypt_tokens(tokens_dict)

    # After reading from DB:
    decrypted = decrypt_tokens(encrypted_dict)

If ENCRYPTION_KEY is not set, tokens pass through unmodified (backward compatible).
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

from backend.utils.logger import logger

# Fields within the tokens dict that contain sensitive values
_SENSITIVE_FIELDS = ("token", "refresh_token", "client_secret")

# Marker to identify already-encrypted values
_ENCRYPTED_PREFIX = "enc:"

_fernet = None
_initialized = False


def _get_fernet():
    """Lazy-init Fernet cipher from ENCRYPTION_KEY env var."""
    global _fernet, _initialized

    if _initialized:
        return _fernet

    _initialized = True
    key = os.environ.get("ENCRYPTION_KEY", "")

    if not key:
        logger.warning(
            "ENCRYPTION_KEY not set — OAuth tokens will be stored in PLAINTEXT. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
        return None

    try:
        from cryptography.fernet import Fernet
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
        return _fernet
    except Exception:
        logger.exception("Invalid ENCRYPTION_KEY — tokens will be stored in plaintext")
        return None


def encrypt_tokens(tokens: Dict[str, Any]) -> Dict[str, Any]:
    """
    Encrypt sensitive fields in a tokens dict before storing to MongoDB.
    Returns a new dict (does not mutate the original).
    """
    f = _get_fernet()
    if f is None or not tokens:
        return tokens

    result = dict(tokens)

    for field in _SENSITIVE_FIELDS:
        value = result.get(field)
        if value and isinstance(value, str) and not value.startswith(_ENCRYPTED_PREFIX):
            try:
                encrypted = f.encrypt(value.encode()).decode()
                result[field] = f"{_ENCRYPTED_PREFIX}{encrypted}"
            except Exception:
                logger.exception("Failed to encrypt field '%s'", field)

    return result


def decrypt_tokens(tokens: Dict[str, Any]) -> Dict[str, Any]:
    """
    Decrypt sensitive fields in a tokens dict after reading from MongoDB.
    Returns a new dict (does not mutate the original).
    Handles plaintext values gracefully (backward compatible).
    """
    f = _get_fernet()
    if f is None or not tokens:
        return tokens

    result = dict(tokens)

    for field in _SENSITIVE_FIELDS:
        value = result.get(field)
        if value and isinstance(value, str) and value.startswith(_ENCRYPTED_PREFIX):
            try:
                encrypted_data = value[len(_ENCRYPTED_PREFIX):]
                decrypted = f.decrypt(encrypted_data.encode()).decode()
                result[field] = decrypted
            except Exception:
                logger.exception(
                    "Failed to decrypt field '%s' — token may be corrupted or key changed", field
                )

    return result