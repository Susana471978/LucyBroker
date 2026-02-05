from __future__ import annotations

from backend.models import EmailEvent, PriorityResult


def calculate_priority(email: EmailEvent) -> PriorityResult:
    """Calculate priority with explainable rules."""

    score = 50
    rules = []
    explanations = []

    subject_lower = email.subject.lower()
    body_lower = email.body.lower()
    from_email_lower = email.from_email.lower()

    urgent_keywords = ["urgente", "urgent", "asap", "inmediato", "hoy", "today", "escalación", "escalation"]
    for kw in urgent_keywords:
        if kw in subject_lower or kw in body_lower:
            score += 25
            rules.append(f"URGENT_KEYWORD:{kw}")
            explanations.append(f"Contiene palabra clave urgente: '{kw}'")
            break

    deadline_keywords = ["deadline", "vencimiento", "fecha límite", "antes de", "before", "expires", "vence"]
    for kw in deadline_keywords:
        if kw in subject_lower or kw in body_lower:
            score += 15
            rules.append(f"DEADLINE_MENTION:{kw}")
            explanations.append("Menciona una fecha límite o vencimiento")
            break

    vip_domains = ["cliente-vip", "partner", "vip", "premium"]
    for domain in vip_domains:
        if domain in from_email_lower:
            score += 20
            rules.append(f"VIP_SENDER:{domain}")
            explanations.append("Remitente de cuenta VIP o partner estratégico")
            break

    action_keywords = ["firma", "sign", "aprobar", "approve", "confirmar", "confirm", "revisar", "review"]
    for kw in action_keywords:
        if kw in body_lower:
            score += 15
            rules.append(f"ACTION_REQUIRED:{kw}")
            explanations.append(f"Requiere acción: '{kw}'")
            break

    financial_keywords = ["factura", "invoice", "pago", "payment", "contrato", "contract", "$"]
    for kw in financial_keywords:
        if kw in subject_lower or kw in body_lower:
            score += 10
            rules.append(f"FINANCIAL_CONTENT:{kw}")
            explanations.append("Contenido financiero o contractual")
            break

    if email.has_attachments:
        score += 5
        rules.append("HAS_ATTACHMENTS")
        explanations.append("Incluye documentos adjuntos")

    promo_keywords = ["newsletter", "promoción", "promo", "descuento", "oferta", "suscríbete", "unsubscribe"]
    for kw in promo_keywords:
        if kw in subject_lower or kw in body_lower or kw in email.labels:
            score -= 30
            rules.append(f"PROMOTIONAL:{kw}")
            explanations.append("Contenido promocional o newsletter")
            break

    if "noreply" in from_email_lower or "no-reply" in from_email_lower:
        score -= 10
        rules.append("AUTOMATED_SENDER")
        explanations.append("Mensaje automático del sistema")

    score = max(0, min(100, score))

    if score >= 70:
        label = "PRIORITARIO"
    elif score >= 40:
        label = "SEGUIMIENTO"
    else:
        label = "INFO"

    if not explanations:
        explanations.append("Correo estándar sin indicadores especiales de urgencia")

    return PriorityResult(
        priority_score=score,
        priority_label=label,
        explain=" | ".join(explanations),
        rule_hits=rules,
        version="1.0",
    )