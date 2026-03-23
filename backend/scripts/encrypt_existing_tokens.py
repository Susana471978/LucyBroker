#!/usr/bin/env python3
# backend/scripts/encrypt_existing_tokens.py
#
# One-time migration: encrypts existing plaintext OAuth tokens in MongoDB.
# Safe to run multiple times — skips already-encrypted tokens (enc: prefix).
#
# Usage:
#   cd /opt/emailsystem
#   source .venv/bin/activate
#   python -m backend.scripts.encrypt_existing_tokens

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from dotenv import load_dotenv
load_dotenv()

from backend.core.database import db
from backend.services.token_encryption import encrypt_tokens
from backend.utils.logger import logger


async def migrate():
    if not os.environ.get("ENCRYPTION_KEY"):
        print("ERROR: ENCRYPTION_KEY not set in .env")
        print("Generate one with:")
        print('  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"')
        sys.exit(1)

    count = 0
    skipped = 0

    cursor = db.users.find(
        {"$or": [
            {"gmail_tokens": {"$exists": True}},
            {"calendar_tokens": {"$exists": True}},
        ]},
        {"id": 1, "gmail_tokens": 1, "calendar_tokens": 1, "email": 1},
    )

    async for user in cursor:
        updates = {}

        for field in ("gmail_tokens", "calendar_tokens"):
            tokens = user.get(field)
            if not tokens or not tokens.get("token"):
                continue

            # Check if already encrypted
            if tokens.get("token", "").startswith("enc:"):
                skipped += 1
                continue

            encrypted = encrypt_tokens(tokens)
            updates[field] = encrypted

        if updates:
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": updates},
            )
            count += 1
            print(f"  Encrypted tokens for user {user.get('email', user['id'])}")

    print(f"\nDone. Encrypted: {count} users. Skipped (already encrypted): {skipped}")


if __name__ == "__main__":
    asyncio.run(migrate())