from fastapi import APIRouter, Depends
from exec_app.models import (
    SessionRestoreIn,
    SessionRestoreOut,
    SessionResetIn,
    SessionUpdateIn,
    OkResponse,
)
from exec_app.security import require_internal_key
from exec_app.services.sessions import (
    restore_or_create_session,
    reset_session,
    update_session_fields,
)

router = APIRouter(
    prefix="/v1/session",
    tags=["session"],
)


# =========================================================
# RESTORE OR CREATE SESSION
# =========================================================
@router.post(
    "/restore",
    response_model=SessionRestoreOut,
    dependencies=[Depends(require_internal_key)],
)
async def restore_session(payload: SessionRestoreIn):
    """
    Restaura la sesión si existe y no está expirada.
    Si no existe, la crea.
    """
    restored, session = await restore_or_create_session(payload.user_id)
    return SessionRestoreOut(
        restored=restored,
        session=session,
    )


# =========================================================
# RESET SESSION
# =========================================================
@router.post(
    "/reset",
    response_model=OkResponse,
    dependencies=[Depends(require_internal_key)],
)
async def reset_session_route(payload: SessionResetIn):
    """
    Elimina completamente la sesión del usuario.
    """
    await reset_session(payload.user_id)
    return OkResponse(ok=True)


# =========================================================
# UPDATE SESSION (Memoria contextual)
# =========================================================
@router.post(
    "/update",
    response_model=OkResponse,
    dependencies=[Depends(require_internal_key)],
)
async def update_session(payload: SessionUpdateIn):
    """
    Actualiza campos específicos de la sesión:
    - tone_preference
    - current_email_id
    - last_draft_content
    - last_action
    """
    await update_session_fields(
        user_id=payload.user_id,
        fields=payload.fields,
    )
    return OkResponse(ok=True)
