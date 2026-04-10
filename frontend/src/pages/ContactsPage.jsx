import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import apiClient from '../services/apiClient';

// ── Iconos SVG inline — sin dependencia extra ────────────────
const IconRadar = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="12" cy="12" r="2" /><path d="M12 2a10 10 0 0 1 10 10" /><path d="M12 6a6 6 0 0 1 6 6" /><path d="M12 10a2 2 0 0 1 2 2" />
    </svg>
);
const IconContacts = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);
const IconMail = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
);
const IconBack = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="m15 18-6-6 6-6" />
    </svg>
);
const IconPending = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
);
const IconSend = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

// ── Helpers ──────────────────────────────────────────────────
function initials(name = '') {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function daysAgo(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'ayer';
    return `hace ${diff} días`;
}

// ── Avatar ───────────────────────────────────────────────────
function Avatar({ name, size = 36, vip = false }) {
    const colors = [
        ['#2C3D2E', '#4A664D'],
        ['#1a2540', '#2d4a8a'],
        ['#2a1f0a', '#C9B27C'],
        ['#1f1a2e', '#6b4fa0'],
        ['#1a2a25', '#3a8a6a'],
    ];
    const idx = name.charCodeAt(0) % colors.length;
    const [bg, accent] = colors[idx];

    return (
        <div style={{
            width: size, height: size, borderRadius: '1px',
            background: bg,
            border: `1px solid ${vip ? 'rgba(201,178,124,0.4)' : 'rgba(255,255,255,0.06)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: vip ? '0 0 12px rgba(201,178,124,0.15)' : 'none',
        }}>
            <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: size * 0.38,
                color: accent,
                fontWeight: 600,
                letterSpacing: '0.02em',
            }}>{initials(name)}</span>
        </div>
    );
}

// ── Score bar ────────────────────────────────────────────────
function ScoreBar({ score }) {
    const pct = Math.min(score, 100);
    const color = score >= 80 ? '#C9B27C' : score >= 50 ? '#00B4D8' : 'rgba(255,255,255,0.25)';
    return (
        <div style={{ width: '60px', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '1px', transition: 'width 0.6s ease' }} />
        </div>
    );
}

// ── ContactRow ───────────────────────────────────────────────
function ContactRow({ contact, onClick, index }) {
    const isVip = contact.is_vip || contact.score >= 80;
    const hasPending = contact.has_pending_action;

    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04, duration: 0.3 }}
            onClick={() => onClick(contact)}
            style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <Avatar name={contact.contact_name || contact.contact_email} size={36} vip={isVip} />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: '13px',
                        color: 'rgba(242,247,255,0.88)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {contact.contact_name || contact.contact_email}
                    </span>
                    {isVip && (
                        <span style={{
                            fontSize: '8px', letterSpacing: '0.14em',
                            color: 'rgba(201,178,124,0.7)',
                            border: '0.5px solid rgba(201,178,124,0.3)',
                            padding: '1px 5px', borderRadius: '1px',
                        }}>VIP</span>
                    )}
                    {hasPending && (
                        <span style={{ color: '#00B4D8' }}><IconPending /></span>
                    )}
                </div>
                <div style={{
                    fontSize: '11px', color: 'rgba(180,194,216,0.45)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginTop: '1px',
                }}>
                    {contact.last_subject || contact.contact_email}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                {contact.score !== undefined
                    ? <ScoreBar score={contact.score} />
                    : <span style={{ fontSize: '10px', color: 'rgba(180,194,216,0.3)', letterSpacing: '0.06em' }}>
                        {contact.interaction_count || 0}×
                    </span>
                }
                <span style={{ fontSize: '10px', color: 'rgba(180,194,216,0.3)' }}>
                    {daysAgo(contact.last_interaction_at) || ''}
                </span>
            </div>
        </motion.div>
    );
}

// ── ContactProfile ───────────────────────────────────────────
function ContactProfile({ contact, onBack, onSendEmail }) {
    const isVip = contact.is_vip;
    const topics = contact.topics || [];
    const recent = contact.recent_interactions || [];

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3 }}
        >
            {/* Back */}
            <button
                onClick={onBack}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(180,194,216,0.5)',
                    fontSize: '11px', letterSpacing: '0.1em',
                    marginBottom: '20px', padding: '0',
                    transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(242,247,255,0.8)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,194,216,0.5)'}
            >
                <IconBack /> VOLVER
            </button>

            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '16px',
                padding: '20px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '1px',
                marginBottom: '12px',
            }}>
                <Avatar name={contact.contact_name || contact.contact_email} size={52} vip={isVip} />
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h2 style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: '22px', fontStyle: 'italic',
                            color: 'rgba(242,247,255,0.92)',
                            margin: 0,
                        }}>
                            {contact.contact_name || contact.contact_email}
                        </h2>
                        {isVip && (
                            <span style={{
                                fontSize: '8px', letterSpacing: '0.14em',
                                color: 'rgba(201,178,124,0.8)',
                                border: '0.5px solid rgba(201,178,124,0.35)',
                                padding: '2px 7px', borderRadius: '1px',
                            }}>VIP</span>
                        )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'rgba(180,194,216,0.45)', margin: '0 0 12px' }}>
                        {contact.contact_email}
                    </p>
                    <button
                        onClick={() => onSendEmail(contact)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '7px 14px', borderRadius: '1px',
                            border: '1px solid rgba(201,178,124,0.25)',
                            background: 'rgba(201,178,124,0.06)',
                            color: 'rgba(201,178,124,0.8)',
                            fontSize: '10px', letterSpacing: '0.12em',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,178,124,0.12)'; e.currentTarget.style.color = '#C9B27C'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,178,124,0.06)'; e.currentTarget.style.color = 'rgba(201,178,124,0.8)'; }}
                    >
                        <IconSend /> ENVIAR CORREO
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                marginBottom: '12px',
            }}>
                {[
                    { label: 'Interacciones', value: contact.interaction_count || 0 },
                    { label: 'Tono preferido', value: contact.preferred_tone || 'formal' },
                    { label: 'Último contacto', value: daysAgo(contact.last_interaction_at) || '—' },
                ].map(stat => (
                    <div key={stat.label} style={{
                        padding: '14px 16px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '1px',
                        textAlign: 'center',
                    }}>
                        <div style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: '20px', color: 'rgba(201,178,124,0.8)',
                            marginBottom: '4px',
                        }}>{stat.value}</div>
                        <div style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'rgba(180,194,216,0.4)', textTransform: 'uppercase' }}>
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>

            {/* Temas */}
            {topics.length > 0 && (
                <div style={{
                    padding: '16px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '1px',
                    marginBottom: '12px',
                }}>
                    <p style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(180,194,216,0.4)', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Temas habituales
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {topics.map(topic => (
                            <span key={topic} style={{
                                fontSize: '11px', padding: '3px 10px', borderRadius: '1px',
                                border: '1px solid rgba(0,180,216,0.2)',
                                color: 'rgba(0,180,216,0.7)',
                                background: 'rgba(0,180,216,0.04)',
                            }}>{topic}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Último asunto */}
            {contact.last_subject && (
                <div style={{
                    padding: '14px 16px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '1px',
                    marginBottom: '12px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    <span style={{ color: 'rgba(180,194,216,0.3)', flexShrink: 0 }}><IconMail /></span>
                    <div>
                        <p style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'rgba(180,194,216,0.35)', textTransform: 'uppercase', marginBottom: '3px' }}>
                            Último asunto
                        </p>
                        <p style={{ fontSize: '13px', color: 'rgba(242,247,255,0.7)', fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif" }}>
                            {contact.last_subject}
                        </p>
                    </div>
                </div>
            )}

            {/* Historial reciente */}
            {recent.length > 0 && (
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '1px',
                }}>
                    <p style={{
                        fontSize: '9px', letterSpacing: '0.14em',
                        color: 'rgba(180,194,216,0.4)', textTransform: 'uppercase',
                        padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                        Historial reciente
                    </p>
                    {recent.slice(0, 5).map((item, i) => (
                        <div key={i} style={{
                            padding: '10px 16px',
                            borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                            display: 'flex', alignItems: 'center', gap: '10px',
                        }}>
                            <div style={{
                                width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                                background: item.action === 'auto_reply' ? '#C9B27C' : 'rgba(0,180,216,0.6)',
                            }} />
                            <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '12px', color: 'rgba(242,247,255,0.6)' }}>
                                    {item.subject || '—'}
                                </span>
                                {item.topic && (
                                    <span style={{ fontSize: '10px', color: 'rgba(0,180,216,0.5)', marginLeft: '8px' }}>
                                        {item.topic}
                                    </span>
                                )}
                            </div>
                            <span style={{ fontSize: '10px', color: 'rgba(180,194,216,0.25)', flexShrink: 0 }}>
                                {item.action}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

// ── ContactsPage ─────────────────────────────────────────────
export default function ContactsPage() {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [view, setView] = useState('contacts'); // 'contacts' | 'radar'
    const [contacts, setContacts] = useState([]);
    const [radar, setRadar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [radarLoading, setRadarLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchContacts = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await apiClient.get('/contacts?limit=100');
            setContacts(Array.isArray(res.data) ? res.data : res.data?.data || []);
        } catch (e) {
            console.error('Contacts fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchRadar = useCallback(async () => {
        if (!token) return;
        setRadarLoading(true);
        try {
            const res = await apiClient.get('/contacts/radar?limit=20');
            setRadar(Array.isArray(res.data) ? res.data : res.data?.data || []);
        } catch (e) {
            console.error('Radar fetch error:', e);
        } finally {
            setRadarLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    useEffect(() => {
        if (view === 'radar' && radar.length === 0) fetchRadar();
    }, [view, radar.length, fetchRadar]);

    const handleSendEmail = (contact) => {
        // Navega a overview con el email pre-cargado en el input de Lucy
        navigate('/app', { state: { lucyPrefill: `Manda un correo a ${contact.contact_email}` } });
    };

    const filtered = contacts.filter(c => {
        const q = search.toLowerCase();
        return (c.contact_name || '').toLowerCase().includes(q) ||
            (c.contact_email || '').toLowerCase().includes(q);
    });


    const displayList = view === 'radar' ? radar : filtered;

    const handleCreateContact = async () => {
        if (!newEmail.trim()) return;
        setCreating(true);
        try {
            await apiClient.post('/contacts/interaction', {
                contact_email: newEmail.trim(),
                contact_name: newName.trim() || newEmail.trim(),
                subject: 'Contacto añadido manualmente',
                action: 'manual',
            });
            setShowCreate(false);
            setNewName('');
            setNewEmail('');
            fetchContacts();
        } catch (e) {
            console.error('Create contact error:', e);
        } finally {
            setCreating(false);
        }
    };

    return (
        <Layout>
            <div style={{
                maxWidth: '720px',
                margin: '0 auto',
                padding: '32px 20px 60px',
            }}>
                {/* ── Header de página ── */}
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ marginBottom: '28px' }}
                >
                    <p style={{
                        fontSize: '9px', letterSpacing: '0.22em',
                        color: 'rgba(201,178,124,0.45)',
                        textTransform: 'uppercase', marginBottom: '6px',
                    }}>
                        LUCY · RELACIONES
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                onClick={() => navigate(-1)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '28px', height: '28px',
                                    background: 'none',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '1px', cursor: 'pointer',
                                    color: 'rgba(180,194,216,0.4)',
                                }}
                            >
                                <IconBack />
                            </button>
                            <h1 style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: '28px', fontStyle: 'italic',
                                color: 'rgba(242,247,255,0.88)',
                                fontWeight: 400, margin: 0,
                            }}>
                                Contactos
                            </h1>
                        </div>
                        <button
                            onClick={() => setShowCreate(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 16px', borderRadius: '1px',
                                border: '1px solid rgba(201,178,124,0.25)',
                                background: 'rgba(201,178,124,0.06)',
                                color: 'rgba(201,178,124,0.7)',
                                fontSize: '10px', letterSpacing: '0.12em',
                                cursor: 'pointer',
                            }}
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            NUEVO
                        </button>
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">
                    {selected ? (
                        <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <ContactProfile
                                contact={selected}
                                onBack={() => setSelected(null)}
                                onSendEmail={handleSendEmail}
                            />
                        </motion.div>
                    ) : (
                        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {/* ── Tabs ── */}
                            <div style={{
                                display: 'flex', gap: '2px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '20px',
                                padding: '3px',
                                marginBottom: '20px',
                                width: 'fit-content',
                            }}>
                                {[
                                    { key: 'contacts', label: 'Todos', icon: <IconContacts /> },
                                    { key: 'radar', label: 'Radar Lucy', icon: <IconRadar /> },
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setView(tab.key)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '6px 16px', borderRadius: '16px',
                                            fontSize: '10px', letterSpacing: '0.12em',
                                            cursor: 'pointer', transition: 'all 0.25s ease',
                                            border: 'none',
                                            ...(view === tab.key ? {
                                                background: 'rgba(201,178,124,0.1)',
                                                color: '#C9B27C',
                                                border: '0.5px solid rgba(201,178,124,0.25)',
                                            } : {
                                                background: 'transparent',
                                                color: 'rgba(180,194,216,0.5)',
                                            }),
                                        }}
                                    >
                                        {tab.icon} {tab.label.toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            {/* ── Buscador — solo en vista contactos ── */}
                            {view === 'contacts' && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '0 14px',
                                    height: '44px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '1px',
                                    marginBottom: '12px',
                                    transition: 'border-color 0.2s',
                                }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(180,194,216,0.3)" strokeWidth="1.5">
                                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                                    </svg>
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Buscar contacto..."
                                        style={{
                                            flex: 1, background: 'none', border: 'none', outline: 'none',
                                            fontFamily: "'Cormorant Garamond', serif",
                                            fontStyle: 'italic', fontSize: '14px',
                                            color: 'rgba(242,247,255,0.8)',
                                        }}
                                    />
                                    {search && (
                                        <button onClick={() => setSearch('')} style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'rgba(180,194,216,0.3)', fontSize: '16px', lineHeight: 1,
                                        }}>×</button>
                                    )}
                                </div>
                            )}

                            {/* ── Radar header ── */}
                            {view === 'radar' && (
                                <div style={{
                                    padding: '14px 16px',
                                    background: 'rgba(201,178,124,0.04)',
                                    border: '1px solid rgba(201,178,124,0.12)',
                                    borderRadius: '1px',
                                    marginBottom: '12px',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                }}>
                                    <span style={{ color: 'rgba(201,178,124,0.6)' }}><IconRadar /></span>
                                    <p style={{
                                        fontSize: '12px', color: 'rgba(201,178,124,0.7)',
                                        fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif",
                                        margin: 0,
                                    }}>
                                        Contactos que necesitan tu atención, ordenados por urgencia.
                                    </p>
                                </div>
                            )}

                            {/* ── Lista ── */}
                            <div style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '1px',
                                overflow: 'hidden',
                            }}>
                                {loading || (view === 'radar' && radarLoading) ? (
                                    <div style={{ padding: '40px', textAlign: 'center' }}>
                                        <div style={{
                                            width: '20px', height: '20px', margin: '0 auto 12px',
                                            border: '1px solid rgba(201,178,124,0.2)',
                                            borderTopColor: 'rgba(201,178,124,0.6)',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite',
                                        }} />
                                        <p style={{ fontSize: '12px', color: 'rgba(180,194,216,0.3)' }}>
                                            Cargando contactos...
                                        </p>
                                    </div>
                                ) : displayList.length === 0 ? (
                                    <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                                        <p style={{
                                            fontFamily: "'Cormorant Garamond', serif",
                                            fontStyle: 'italic', fontSize: '16px',
                                            color: 'rgba(180,194,216,0.35)',
                                        }}>
                                            {view === 'radar'
                                                ? 'Sin contactos que requieran atención ahora mismo.'
                                                : search
                                                    ? 'No se encontraron contactos.'
                                                    : 'Lucy irá aprendiendo tus contactos conforme interactúas con tus correos.'
                                            }
                                        </p>
                                    </div>
                                ) : (
                                    displayList.map((contact, i) => (
                                        <ContactRow
                                            key={contact.contact_email + i}
                                            contact={contact}
                                            onClick={setSelected}
                                            index={i}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Contador */}
                            {!loading && displayList.length > 0 && (
                                <p style={{
                                    fontSize: '10px', letterSpacing: '0.1em',
                                    color: 'rgba(180,194,216,0.25)',
                                    textAlign: 'right', marginTop: '10px',
                                    textTransform: 'uppercase',
                                }}>
                                    {displayList.length} contacto{displayList.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {showCreate && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 100,
                            background: 'rgba(0,0,0,0.7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '20px',
                        }}
                        onClick={() => setShowCreate(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: '400px',
                                background: 'rgba(3,7,16,0.97)',
                                border: '1px solid rgba(201,178,124,0.18)',
                                borderRadius: '1px', padding: '28px',
                            }}
                        >
                            <h3 style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontStyle: 'italic', fontSize: '20px',
                                color: 'rgba(242,247,255,0.88)', marginBottom: '20px',
                            }}>Nuevo contacto</h3>
                            <div style={{ marginBottom: '14px' }}>
                                <p style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(180,194,216,0.4)', textTransform: 'uppercase', marginBottom: '6px' }}>Nombre</p>
                                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Carlos García"
                                    style={{ width: '100%', height: '42px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1px', padding: '0 12px', color: 'rgba(242,247,255,0.85)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: '14px' }}>
                                <p style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(180,194,216,0.4)', textTransform: 'uppercase', marginBottom: '6px' }}>Email *</p>
                                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="carlos@empresa.com"
                                    style={{ width: '100%', height: '42px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1px', padding: '0 12px', color: 'rgba(242,247,255,0.85)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                                <button onClick={handleCreateContact} disabled={!newEmail.trim() || creating}
                                    style={{ flex: 1, height: '40px', background: 'rgba(201,178,124,0.1)', border: '1px solid rgba(201,178,124,0.3)', borderRadius: '1px', cursor: 'pointer', color: '#C9B27C', fontSize: '10px', letterSpacing: '0.14em', opacity: !newEmail.trim() || creating ? 0.4 : 1 }}>
                                    {creating ? 'GUARDANDO...' : 'GUARDAR'}
                                </button>
                                <button onClick={() => setShowCreate(false)}
                                    style={{ padding: '0 20px', height: '40px', background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1px', cursor: 'pointer', color: 'rgba(180,194,216,0.4)', fontSize: '10px', letterSpacing: '0.14em' }}>
                                    CANCELAR
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                input::placeholder {
                    color: rgba(180,194,216,0.3);
                }
            `}</style>
        </Layout>
    );
}
