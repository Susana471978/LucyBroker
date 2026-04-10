import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { stopGlobalAudio } from '../../voice/useVoiceEngine';
import LucyPulseCanvas from '../LucyPulseCanvas';

const STATES_LIST = [
    { key: 'presente', label: 'PRESENTE' },
    { key: 'escuchando', label: 'ESCUCHANDO' },
    { key: 'hablando', label: 'HABLANDO' },
    { key: 'procesando', label: 'PROCESANDO' },
];

// ── Panel de confirmación de email ───────────────────────────────────
function EmailConfirmPanel({ pendingEmail, onConfirm, onCancel, sending }) {
    if (!pendingEmail) return null;

    const preview = pendingEmail.body?.length > 160
        ? pendingEmail.body.slice(0, 160) + '…'
        : pendingEmail.body || '';

    return (
        <motion.div
            key="email-confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="w-full"
            style={{
                borderRadius: '1px',
                border: '1px solid rgba(201,178,124,0.18)',
                background: 'rgba(201,178,124,0.04)',
                padding: '16px',
            }}
        >
            {/* Cabecera */}
            <div className="flex items-center gap-2 mb-3">
                <div style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: 'var(--champagne)',
                    boxShadow: '0 0 8px rgba(201,178,124,0.6)',
                    flexShrink: 0,
                }} />
                <span style={{
                    fontSize: '9px',
                    letterSpacing: '0.16em',
                    color: 'rgba(201,178,124,0.6)',
                    textTransform: 'uppercase',
                }}>
                    BORRADOR LISTO
                </span>
            </div>

            {/* Destinatario + asunto */}
            <div className="mb-2" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="flex items-baseline gap-2">
                    <span style={{
                        fontSize: '9px',
                        letterSpacing: '0.12em',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        minWidth: '50px',
                    }}>Para</span>
                    <span style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: '15px',
                        color: 'var(--text-primary)',
                    }}>
                        {pendingEmail.to_name || pendingEmail.to_email || '—'}
                    </span>
                    {pendingEmail.to_email && pendingEmail.to_name && (
                        <span style={{
                            fontSize: '11px',
                            color: 'var(--text-tertiary)',
                        }}>
                            {pendingEmail.to_email}
                        </span>
                    )}
                </div>
                <div className="flex items-baseline gap-2">
                    <span style={{
                        fontSize: '9px',
                        letterSpacing: '0.12em',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        minWidth: '50px',
                    }}>Asunto</span>
                    <span style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontStyle: 'italic',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                    }}>
                        {pendingEmail.subject || '—'}
                    </span>
                </div>
            </div>

            {/* Preview del cuerpo */}
            {preview && (
                <div style={{
                    margin: '12px 0',
                    padding: '10px 12px',
                    borderLeft: '1px solid rgba(201,178,124,0.15)',
                    background: 'rgba(0,0,0,0.12)',
                }}>
                    <p style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: '13px',
                        lineHeight: '1.75',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                    }}>
                        {preview}
                    </p>
                </div>
            )}

            {/* Sin email resuelto — aviso */}
            {!pendingEmail.to_email && (
                <p style={{
                    fontSize: '11px',
                    color: 'rgba(201,178,124,0.5)',
                    marginBottom: '12px',
                    fontStyle: 'italic',
                }}>
                    No tengo el email de {pendingEmail.to_name}. Se enviará cuando lo resuelva.
                </p>
            )}

            {/* Botones */}
            <div className="flex items-center gap-3 mt-3">
                <button
                    onClick={onConfirm}
                    disabled={sending}
                    style={{
                        flex: 1,
                        height: '36px',
                        borderRadius: '1px',
                        border: '1px solid rgba(201,178,124,0.35)',
                        background: 'rgba(201,178,124,0.08)',
                        color: 'var(--champagne)',
                        fontSize: '10px',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: sending ? 'not-allowed' : 'pointer',
                        opacity: sending ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                    }}
                    onMouseEnter={e => { if (!sending) e.currentTarget.style.background = 'rgba(201,178,124,0.14)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,178,124,0.08)'; }}
                >
                    {sending ? (
                        <div style={{
                            width: '10px', height: '10px',
                            border: '1px solid rgba(201,178,124,0.3)',
                            borderTopColor: 'var(--champagne)',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                    ) : (
                        <>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                            Enviar
                        </>
                    )}
                </button>

                <button
                    onClick={onCancel}
                    disabled={sending}
                    style={{
                        height: '36px',
                        padding: '0 16px',
                        borderRadius: '1px',
                        border: '1px solid var(--border-subtle)',
                        background: 'transparent',
                        color: 'var(--text-tertiary)',
                        fontSize: '10px',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: sending ? 'not-allowed' : 'pointer',
                        opacity: sending ? 0.4 : 1,
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { if (!sending) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >
                    Cancelar
                </button>
            </div>
        </motion.div>
    );
}

// ── Componente principal ─────────────────────────────────────────────
export default function LucyConversationCard({
    handsFreeModeActive,
    activateHandsFreeMode,
    cancel,
    lastInteraction,
    briefingText,
    sending,
    sendToLucy,
    runBriefing,
    briefingInFlightRef,
    ttsEnabled,
    setTtsEnabled,
    wakeWordEnabled,
    wakeWordActive,
    isSpeaking,
    isListening,
    isProcessing,
    canvasState,
    canvasLevel,
    waveform,
    // Email pendiente
    pendingEmail,
    onConfirmEmail,
    onCancelEmail,
}) {
    const activeState = isSpeaking
        ? 'hablando'
        : isListening
            ? 'escuchando'
            : isProcessing
                ? 'procesando'
                : 'presente';

    const statusText = isSpeaking
        ? 'hablando'
        : isListening
            ? 'escuchando'
            : isProcessing
                ? 'procesando'
                : 'en espera';

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden backdrop-blur-xl"
            style={{
                borderRadius: '1px',
                background: 'var(--surface-glass)',
                border: '1px solid var(--border-subtle)',
            }}
        >
            {/* ── States row ── */}
            <div className="flex items-center justify-center pt-6 pb-1">
                {STATES_LIST.map((s, i) => (
                    <span key={s.key} className="flex items-center">
                        {i > 0 && (
                            <span className="mx-2.5" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>·</span>
                        )}
                        <span style={{
                            fontSize: '10px',
                            letterSpacing: '0.18em',
                            color: activeState === s.key ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                            borderBottom: activeState === s.key
                                ? '0.5px solid var(--text-tertiary)'
                                : '0.5px solid transparent',
                            paddingBottom: '2px',
                            transition: 'color 0.3s ease, border-color 0.3s ease',
                        }}>
                            {s.label}
                        </span>
                    </span>
                ))}
            </div>

            {/* ── Status text ── */}
            <div className="text-center pb-3">
                <p style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: 'italic',
                    fontSize: '13px',
                    color: 'rgba(201,178,124,0.4)',
                    letterSpacing: '0.08em',
                }}>
                    {pendingEmail ? 'esperando confirmación' : statusText}
                </p>
            </div>

            {/* ── Mode pill toggle ── */}
            <div className="flex justify-center pb-5">
                <div className="inline-flex items-center" style={{
                    background: 'var(--surface-glass)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '20px',
                    padding: '3px',
                    gap: '2px',
                }}>
                    <button
                        onClick={() => handsFreeModeActive && cancel()}
                        className="lucy-mode-btn"
                        style={{
                            fontSize: '10px',
                            letterSpacing: '0.12em',
                            padding: '5px 16px',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            ...(!handsFreeModeActive
                                ? {
                                    background: 'rgba(201,178,124,0.1)',
                                    color: 'var(--champagne)',
                                    border: '0.5px solid var(--border-champagne)',
                                }
                                : {
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    border: '0.5px solid transparent',
                                }),
                        }}
                    >
                        ESCRITORIO
                    </button>
                    <button
                        onClick={() => handsFreeModeActive ? cancel() : activateHandsFreeMode("")}
                        className="lucy-mode-btn"
                        style={{
                            fontSize: '10px',
                            letterSpacing: '0.12em',
                            padding: '5px 16px',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            ...(handsFreeModeActive
                                ? {
                                    background: 'rgba(201,178,124,0.1)',
                                    color: 'var(--champagne)',
                                    border: '0.5px solid var(--border-champagne)',
                                }
                                : {
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    border: '0.5px solid transparent',
                                }),
                        }}
                    >
                        MANOS LIBRES
                    </button>
                </div>
            </div>

            {/* ══ CONTENT BY MODE ══ */}
            <AnimatePresence mode="wait">

                {/* ── DESKTOP MODE ── */}
                {!handsFreeModeActive && (
                    <motion.div
                        key="escritorio"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center px-5 pb-5"
                        style={{ gap: '16px' }}
                    >
                        {/* Orbe — se oculta cuando hay email pendiente */}
                        <AnimatePresence>
                            {!pendingEmail && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.25 }}
                                    className="relative flex items-center justify-center"
                                    style={{ width: 120, height: 120 }}
                                >
                                    <div className="absolute rounded-full" style={{
                                        width: 60, height: 60,
                                        background: 'radial-gradient(circle, rgba(201,178,124,0.35) 0%, transparent 70%)',
                                        animation: 'lucyBreathe 4s ease-in-out infinite',
                                    }} />
                                    <div className="absolute rounded-full" style={{
                                        width: 100, height: 100,
                                        border: '0.5px solid rgba(201,178,124,0.06)',
                                        animation: 'orbeSpin 30s linear infinite',
                                    }} />
                                    <div className="absolute rounded-full" style={{
                                        width: 78, height: 78,
                                        border: '0.5px solid var(--glow-champagne)',
                                        animation: 'orbeSpinReverse 20s linear infinite',
                                    }} />
                                    <div className="relative rounded-full" style={{
                                        width: 10, height: 10,
                                        background: 'var(--champagne)',
                                        boxShadow: '0 0 12px rgba(201,178,124,0.5), 0 0 24px rgba(201,178,124,0.2)',
                                    }} />
                                    {wakeWordActive && (
                                        <div className="absolute rounded-full animate-ping" style={{
                                            width: 106, height: 106,
                                            border: '0.5px solid rgba(201,178,124,0.28)',
                                        }} />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Controls */}
                        {!pendingEmail && (
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => { if (!briefingInFlightRef.current) runBriefing('repite mi briefing matutino'); }}
                                    disabled={briefingInFlightRef.current || sending}
                                    className="disabled:opacity-25 transition-all duration-200"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                    title="Repetir briefing"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M1 4v6h6M23 20v-6h-6" />
                                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => { stopGlobalAudio(); setTtsEnabled(prev => !prev); }}
                                    className="transition-all duration-200"
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: ttsEnabled ? 'rgba(201,178,124,0.5)' : 'var(--text-tertiary)',
                                    }}
                                    title={ttsEnabled ? 'Silenciar voz' : 'Activar voz'}
                                >
                                    {ttsEnabled
                                        ? <Volume2 className="w-3.5 h-3.5" />
                                        : <VolumeX className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        )}

                        {/* ── Email pendiente de confirmación ── */}
                        <AnimatePresence>
                            {pendingEmail && (
                                <motion.div
                                    key="email-confirm"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <EmailConfirmPanel
                                        pendingEmail={pendingEmail}
                                        onConfirm={onConfirmEmail}
                                        onCancel={onCancelEmail}
                                        sending={sending}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Response text — solo si no hay email pendiente */}
                        <AnimatePresence>
                            {!pendingEmail && (lastInteraction || briefingText) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="relative w-full max-h-[88px] overflow-hidden"
                                >
                                    <p style={{
                                        fontFamily: "'Cormorant Garamond', serif",
                                        fontSize: '15px',
                                        lineHeight: '1.85',
                                        color: 'var(--text-primary)',
                                    }}>
                                        {lastInteraction || briefingText}
                                    </p>
                                    <div className="absolute inset-x-0 bottom-0 h-[22px] pointer-events-none"
                                        style={{ background: 'linear-gradient(to top, var(--background-base), transparent)' }} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Input — deshabilitado mientras hay email pendiente */}
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const input = e.target.elements.lucyInput;
                                const text = input.value.trim();
                                if (!text || sending) return;
                                input.value = '';
                                // Si hay email pendiente, el texto es la respuesta del usuario
                                if (pendingEmail) {
                                    await sendToLucy(text, {
                                        pending_email_id: pendingEmail.id,
                                        confirm_email: true,
                                    });
                                } else {
                                    await sendToLucy(text);
                                }
                            }}
                            className="w-full"
                        >
                            <div className="lucy-input-wrap flex items-center gap-3 px-4">
                                <input
                                    name="lucyInput"
                                    type="text"
                                    placeholder={
                                        sending
                                            ? 'Lucy está procesando…'
                                            : pendingEmail
                                                ? '¿Lo envío? Escribe sí o no…'
                                                : 'Dime qué necesitas…'
                                    }
                                    disabled={sending}
                                    className="lucy-input-field flex-1 bg-transparent focus:outline-none disabled:opacity-40"
                                    style={{
                                        fontFamily: "'DM Sans', sans-serif",
                                        fontSize: '14px',
                                        fontWeight: 300,
                                        color: 'var(--text-primary)',
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="flex items-center justify-center flex-shrink-0 rounded-full disabled:opacity-30 transition-all duration-200"
                                    style={{
                                        width: '28px', height: '28px',
                                        background: 'var(--glow-champagne)',
                                        border: '0.5px solid var(--border-champagne)',
                                    }}
                                >
                                    {sending
                                        ? <div className="w-3 h-3 rounded-full animate-spin" style={{
                                            border: '1px solid rgba(201,178,124,0.3)',
                                            borderTopColor: 'var(--champagne)',
                                        }} />
                                        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(201,178,124,0.6)" strokeWidth="1.8">
                                            <line x1="22" y1="2" x2="11" y2="13" />
                                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                        </svg>
                                    }
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}

                {/* ── HANDS-FREE MODE ── */}
                {handsFreeModeActive && (
                    <motion.div
                        key="manos-libres"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        className="flex flex-col items-center px-6 pb-6 gap-5"
                    >
                        {/* Canvas band */}
                        <div className="relative w-full overflow-hidden" style={{ height: '100px' }}>
                            <LucyPulseCanvas
                                state={canvasState}
                                level={canvasLevel}
                                waveform={waveform}
                            />
                            <div className="absolute left-0 top-0 bottom-0 w-10 pointer-events-none z-10"
                                style={{ background: 'linear-gradient(to right, var(--background-base), transparent)' }} />
                            <div className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none z-10"
                                style={{ background: 'linear-gradient(to left, var(--background-base), transparent)' }} />
                        </div>

                        {/* Email pendiente también visible en manos libres */}
                        <AnimatePresence>
                            {pendingEmail && (
                                <motion.div
                                    key="email-confirm"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <EmailConfirmPanel
                                        pendingEmail={pendingEmail}
                                        onConfirm={onConfirmEmail}
                                        onCancel={onCancelEmail}
                                        sending={sending}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Transcript */}
                        <AnimatePresence>
                            {lastInteraction && !pendingEmail && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center min-h-[48px]"
                                >
                                    <p style={{
                                        fontFamily: "'Cormorant Garamond', serif",
                                        fontSize: '15px',
                                        lineHeight: '1.8',
                                        color: 'var(--text-secondary)',
                                    }}>
                                        {lastInteraction}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Stop button */}
                        <button
                            onClick={cancel}
                            className="lucy-stop-btn flex items-center gap-2 transition-all duration-200"
                            style={{
                                padding: '8px 20px',
                                borderRadius: '1px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--surface-glass-hover)',
                                color: 'var(--text-tertiary)',
                                fontSize: '10px',
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                            }}
                        >
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                            Detener
                        </button>
                    </motion.div>
                )}

            </AnimatePresence>

            <style>{`
                @keyframes lucyBreathe {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.15); }
                }
                @keyframes orbeSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes orbeSpinReverse {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(-360deg); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .lucy-input-wrap {
                    height: 52px;
                    border: 1px solid var(--border-input);
                    border-radius: 1px;
                    background: var(--input-bg);
                    transition: border-color 0.2s ease;
                }
                .lucy-input-wrap:focus-within {
                    border-color: var(--border-input-focus);
                }
                .lucy-input-field::placeholder {
                    font-family: 'Cormorant Garamond', serif;
                    font-style: italic;
                    font-size: 15px;
                    color: var(--text-tertiary);
                }
                .lucy-stop-btn:hover {
                    background: var(--border-subtle);
                    color: var(--text-primary);
                }
            `}</style>
        </motion.div>
    );
}
