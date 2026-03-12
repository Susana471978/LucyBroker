from __future__ import annotations

from backend.models import EmailEvent, PriorityResult


def calculate_priority(email: EmailEvent, contact_memory: dict | None = None) -> PriorityResult:
    """Executive Priority Engine v2 — Deterministic + Overrides + Explainable"""

    score = 50
    rules = []
    explanations = []

    subject_lower = (email.subject or "").lower()
    body_lower = (email.body or "").lower()
    from_email_lower = (email.from_email or "").lower()

    # =====================================================
    # 🔴 1. HARD OVERRIDES (si se activan, dominan todo)
    # =====================================================

    payment_failure_keywords = [
        "payment failed",
        "card declined",
        "failed invoice",
        "subscription expired",
        "cuenta suspendida",
        "acción requerida",
    ]

    security_keywords = [
        "security alert",
        "new sign-in",
        "suspicious activity",
        "password reset",
        "verify your account",
        "unrecognized login",
    ]

    for kw in payment_failure_keywords:
        if kw in subject_lower or kw in body_lower:
            return PriorityResult(
                priority_score=95,
                priority_label="PRIORITARIO",
                explain="Pago fallido o problema de suscripción detectado",
                rule_hits=[f"PAYMENT_OVERRIDE:{kw}"],
                version="2.0",
            )

    for kw in security_keywords:
        if kw in subject_lower or kw in body_lower:
            return PriorityResult(
                priority_score=95,
                priority_label="PRIORITARIO",
                explain="Alerta de seguridad detectada",
                rule_hits=[f"SECURITY_OVERRIDE:{kw}"],
                version="2.0",
            )

    # =====================================================
    # 🟡 2. NEWSLETTER DETECTOR (penalización fuerte)
    # =====================================================

    newsletter_signals = 0

    newsletter_keywords = [
        "unsubscribe",
        "newsletter",
        "suscríbete",
        "view in browser",
        "manage preferences",
        "promoción",
        "oferta",
        "descuento",
        "sale",
    ]

    for kw in newsletter_keywords:
        if kw in subject_lower or kw in body_lower:
            newsletter_signals += 1
            rules.append(f"NEWSLETTER_SIGNAL:{kw}")

    if "noreply" in from_email_lower or "no-reply" in from_email_lower:
        newsletter_signals += 1
        rules.append("AUTOMATED_SENDER")

    if newsletter_signals >= 2:
        score -= 40
        explanations.append("Detectado como posible newsletter/promoción masiva")

    # =====================================================
    # 🟢 3. SCORING BASE INTELIGENTE
    # =====================================================

    urgent_keywords = [
        "urgente", "urgent", "asap", "inmediato",
        "escalación", "escalation"
    ]

    for kw in urgent_keywords:
        if kw in subject_lower or kw in body_lower:
            score += 20
            rules.append(f"URGENT_KEYWORD:{kw}")
            explanations.append(f"Contiene palabra urgente: '{kw}'")
            break

    deadline_keywords = [
        "deadline", "vencimiento", "fecha límite",
        "before", "expires", "vence"
    ]

    for kw in deadline_keywords:
        if kw in subject_lower or kw in body_lower:
            score += 15
            rules.append(f"DEADLINE_MENTION:{kw}")
            explanations.append("Menciona fecha límite")
            break

    action_keywords = [
        "firma", "sign", "aprobar", "approve",
        "confirmar", "confirm", "revisar", "review"
    ]

    for kw in action_keywords:
        if kw in body_lower:
            score += 15
            rules.append(f"ACTION_REQUIRED:{kw}")
            explanations.append("Requiere acción directa")
            break

    financial_keywords = [
        "factura", "invoice", "pago", "payment",
        "contrato", "contract"
    ]

    for kw in financial_keywords:
        if kw in subject_lower or kw in body_lower:
            score += 15
            rules.append(f"FINANCIAL_CONTENT:{kw}")
            explanations.append("Contenido financiero")
            break

    if email.has_attachments:
        score += 5
        rules.append("HAS_ATTACHMENTS")
        explanations.append("Incluye adjuntos")

    # =====================================================
    # 🟣 4. RELATIONAL CONTACT BOOST (memoria por contacto)
    # =====================================================

    if contact_memory:

        interaction_count = contact_memory.get("interaction_count", 0)
        is_vip = contact_memory.get("is_vip", False)
        has_pending = contact_memory.get("has_pending_action", False)
        topics = contact_memory.get("topics", [])

        # VIP manual
        if is_vip:
            score += 25
            rules.append("CONTACT_VIP")
            explanations.append("Contacto marcado como VIP")

        # VIP automático
        if interaction_count >= 10:
            score += 15
            rules.append("CONTACT_FREQUENT")
            explanations.append("Contacto frecuente")

        if interaction_count >= 20:
            score += 10
            rules.append("CONTACT_HIGH_FREQUENCY")

        # Acción pendiente con ese contacto
        if has_pending:
            score += 20
            rules.append("CONTACT_PENDING_ACTION")
            explanations.append("Existe acción pendiente con este contacto")

        # Coincidencia con temas habituales
        for topic in topics:
            if topic.lower() in subject_lower:
                score += 10
                rules.append(f"TOPIC_MATCH:{topic}")
                explanations.append("Coincide con tema habitual del contacto")
                break

    # =====================================================
    # 🟠 5. CONVERSATION CONTEXT BOOST
    # =====================================================

    if subject_lower.startswith("re:") or subject_lower.startswith("fw:"):
        score += 8
        rules.append("ACTIVE_THREAD")
        explanations.append("Parte de una conversación activa")

    # =====================================================
    # 🔵 6. NORMALIZACIÓN
    # =====================================================

    score = max(0, min(100, score))

    if score >= 75:
        label = "PRIORITARIO"
    elif score >= 45:
        label = "SEGUIMIENTO"
    else:
        label = "INFO"

    if not explanations:
        explanations.append("Correo estándar sin indicadores críticos")

    return PriorityResult(
        priority_score=score,
        priority_label=label,
        explain=" | ".join(explanations),
        rule_hits=rules,
        version="2.1",
    )