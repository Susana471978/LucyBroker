import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import apiClient from '../services/apiClient';

// ── Iconos ───────────────────────────────────────────────────
const IconRadar = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2a10 10 0 0 1 10 10" />
        <path d="M12 6a6 6 0 0 1 6 6" />
        <path d="M12 10a2 2 0 0 1 2 2" />
    </svg>
);
const IconContacts = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);
const IconBack = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="m15 18-6-6 6-6" />
    </svg>
);
const IconMail = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
);
const IconSend = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);
const IconPlus = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);
const IconSearch = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
    </svg>
);

// ── Helpers ──────────────────────────────────────────────────
function initials(name = '') {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function daysAgo(dateStr) {
    if (!dateStr) return null;
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'ayer';
    return `hace ${diff}d`;
}

// ── Avatar ───────────────────────────────────────────────────
function Avatar({ name, size = 38, vip = false }) {
    return (
        <div style={{
            width: size, height: size,
            borderRadius: 'var(--card-radius-sm)',
            background: vip
                ? 'linear-gradient(135deg, rgba(201,178,124,0.15), rgba(201,178,124,0.06))'
                : 'var(--surface-glass)',
            border: `1px solid ${vip ? 'var(--border-champagne)' : 'var(--border-subtle)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: vip ? '0 0 16px rgba(201,178,124,0.12)' : 'none',
        }}>
            <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: size * 0.36,
                color: vip ? 'var(--champagne)' : 'var(--ocean-dim)',
                fontWeight: 600,
            }}>{initials(name)}</span>
        </div>
    );
}

// ── Badge ────────────────────────────────────────────────────
function Badge({ children, variant = 'ocean' }) {
    const styles = {
        ocean: { color: 'var(--ocean-dim)', border: '0.5px solid var(--border-ocean)', background: 'var(--ocean-subtle)' },
        gold: { color: 'var(--champagne-dim)', border: '0.5px solid var(--border-champagne)', background: 'var(--champagne-faint)' },
    };
    return (
        <span style={{
            fontSize: '8px', letterSpacing: '0.16em',
            padding: '2px 6px', borderRadius: '2px',
            textTransform: 'uppercase',
            ...styles[variant],
        }}>{children}</span>
    );
}

// ── ContactRow ───────────────────────────────────────────────
function ContactRow({ contact, onClick, index }) {
    const isVip = contact.is_vip || contact.score >= 80;
    const hasPending = contact.has_pending_action;
    const [hovered, setHovered] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.035, duration: 0.28 }}
            onClick={() => onClick(contact)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '13px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                background: hovered ? 'var(--surface-glass-hover)' : 'transparent',
                transition: 'background 0.15s ease',
            }}
        >
            <Avatar name={contact.contact_name || contact.contact_email} size={38} vip={isVip} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                    <span style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: '13px', fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {contact.contact_name || contact.contact_email}
                    </span>
                    {isVip && <Badge variant="gold">VIP</Badge>}
                    {hasPending && <Badge variant="ocean">Pendiente</Badge>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {contact.last_subject || contact.contact_email}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                {contact.score !== undefined ? (
                    <div style={{ width: '48px', height: '2px', background: 'var(--border-subtle)', borderRadius: '1px' }}>
                        <div style={{
                            width: `${Math.min(contact.score, 100)}%`, height: '100%',
                            background: contact.score >= 80 ? 'var(--champagne)' : 'var(--ocean)',
                            borderRadius: '1px',
                        }} />
                    </div>
                ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {contact.interaction_count || 0}×
                    </span>
                )}
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {daysAgo(contact.last_interaction_at) || '—'}
                </span>
            </div>
        </motion.div>
    );
}

// ── ContactProfile ───────────────────────────────────────────
function ContactProfile({ contact, onBack, onSendEmail }) {
    const topics = contact.topics || [];
    const recent = contact.recent_interactions || [];
    const isVip = contact.is_vip;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
        >
            <button onClick={onBack} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-tertiary)', fontSize: '12px',
                letterSpacing: '0.08em', marginBottom: '24px', padding: 0,
                transition: 'color 0.2s',
            }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
                <IconBack /> Volver
            </button>

            <div style={{
                background: 'var(--surface-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--card-radius-md)',
                padding: '22px', marginBottom: '12px',
                display: 'flex', alignItems: 'flex-start', gap: '18px',
            }}>
                <Avatar name={contact.contact_name || contact.contact_email} size={54} vip={isVip} />
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <h2 style={{
                            fontFamily: "'Cormorant Garamond', serif",
                            fontSize: '22px', fontStyle: 'italic', fontWeight: 400,
                            color: 'var(--text-primary)', margin: 0,
                        }}>
                            {contact.contact_name || contact.contact_email}
                        </h2>
                        {isVip && <Badge variant="gold">VIP</Badge>}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '0 0 14px' }}>
                        {contact.contact_email}
                    </p>
                    <button onClick={() => onSendEmail(contact)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                        padding: '8px 16px', borderRadius: 'var(--card-radius-sm)',
                        border: '1px solid var(--border-champagne)',
                        background: 'var(--champagne-faint)',
                        color: 'var(--champagne)',
                        fontSize: '11px', letterSpacing: '0.1em',
                        cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase',
                    }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,178,124,0.16)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--champagne-faint)'}
                    >
                        <IconSend /> Enviar correo
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '12px' }}>
                {[
                    { label: 'Interacciones', value: contact.interaction_count || 0 },
                    { label: 'Tono', value: contact.preferred_tone || 'formal' },
                    { label: 'Último contacto', value: daysAgo(contact.last_interaction_at) || '—' },
                ].map(s => (
                    <div key={s.label} style={{
                        background: 'var(--surface-glass)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--card-radius-md)',
                        padding: '16px', textAlign: 'center',
                    }}>
                        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', color: 'var(--champagne)', marginBottom: '5px' }}>
                            {s.value}
                        </div>
                        <div style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                            {s.label}
                        </div>
                    </div>
                ))}
            </div>

            {topics.length > 0 && (
                <div style={{
                    background: 'var(--surface-glass)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--card-radius-md)', padding: '18px', marginBottom: '12px',
                }}>
                    <p style={{ fontSize: '9px', letterSpacing: '0.16em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>
                        Temas habituales
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                        {topics.map(t => <Badge key={t} variant="ocean">{t}</Badge>)}
                    </div>
                </div>
            )}

            {contact.last_subject && (
                <div style={{
                    background: 'var(--surface-glass)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--card-radius-md)', padding: '16px 18px', marginBottom: '12px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                    <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}><IconMail /></span>
                    <div>
                        <p style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Último asunto
                        </p>
                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                            {contact.last_subject}
                        </p>
                    </div>
                </div>
            )}

            {recent.length > 0 && (
                <div style={{
                    background: 'var(--surface-glass)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--card-radius-md)', overflow: 'hidden',
                }}>
                    <p style={{
                        fontSize: '9px', letterSpacing: '0.16em', color: 'var(--text-tertiary)',
                        textTransform: 'uppercase', padding: '14px 18px',
                        borderBottom: '1px solid var(--border-subtle)', margin: 0,
                    }}>
                        Historial reciente
                    </p>
                    {recent.slice(0, 5).map((item, i) => (
                        <div key={i} style={{
                            padding: '11px 18px',
                            borderBottom: i < Math.min(recent.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none',
                            display: 'flex', alignItems: 'center', gap: '12px',
                        }}>
                            <div style={{
                                width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                                background: item.action === 'auto_reply' ? 'var(--champagne)' : 'var(--ocean)',
                            }} />
                            <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)' }}>{item.subject || '—'}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{item.action}</span>
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

    const [view, setView] = useState('contacts');
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
            setNewName(''); setNewEmail('');
            fetchContacts();
        } catch (e) {
            console.error('Create contact error:', e);
        } finally {
            setCreating(false);
        }
    };

    const handleSendEmail = (contact) => {
        navigate('/app', { state: { lucyPrefill: `Manda un correo a ${contact.contact_email}` } });
    };

    const filtered = contacts.filter(c => {
        const q = search.toLowerCase();
        return (c.contact_name || '').toLowerCase().includes(q) ||
            (c.contact_email || '').toLowerCase().includes(q);
    });

    const displayList = view === 'radar' ? radar : filtered;
    const isLoading = loading || (view === 'radar' && radarLoading);

    return (
        <Layout>
            <div style={{ maxWidth: '760px', margin: '0 auto', padding: '36px 20px 80px' }}>

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    style={{ marginBottom: '32px' }}
                >
                    <p style={{
                        fontSize: '9px', letterSpacing: '0.22em',
                        color: 'var(--champagne-dim)', textTransform: 'uppercase', marginBottom: '8px',
                    }}>
                        LUCY · RELACIONES
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <button onClick={() => navigate(-1)} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px',
                                background: 'var(--surface-glass)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--card-radius-sm)',
                                cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all 0.2s',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-ocean)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                            >
                                <IconBack />
                            </button>
                            <h1 style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize: 'clamp(24px, 3vw, 32px)',
                                fontStyle: 'italic', fontWeight: 400,
                                color: 'var(--text-primary)', margin: 0,
                            }}>
                                Contactos
                            </h1>
                        </div>
                        <button onClick={() => setShowCreate(true)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                            padding: '9px 18px', borderRadius: 'var(--card-radius-sm)',
                            border: '1px solid var(--border-champagne)',
                            background: 'var(--champagne-faint)',
                            color: 'var(--champagne)',
                            fontSize: '10px', letterSpacing: '0.12em',
                            cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase',
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,178,124,0.16)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--champagne-faint)'}
                        >
                            <IconPlus /> Nuevo
                        </button>
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">
                    {selected ? (
                        <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <ContactProfile contact={selected} onBack={() => setSelected(null)} onSendEmail={handleSendEmail} />
                        </motion.div>
                    ) : (
                        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                            {/* Tabs */}
                            <div style={{
                                display: 'inline-flex', gap: '3px',
                                background: 'var(--surface-glass)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '20px', padding: '3px', marginBottom: '20px',
                            }}>
                                {[
                                    { key: 'contacts', label: 'Todos', icon: <IconContacts /> },
                                    { key: 'radar', label: 'Radar Lucy', icon: <IconRadar /> },
                                ].map(tab => (
                                    <button key={tab.key} onClick={() => setView(tab.key)} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 18px', borderRadius: '16px',
                                        fontSize: '10px', letterSpacing: '0.12em',
                                        cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase',
                                        ...(view === tab.key ? {
                                            background: 'var(--champagne-faint)',
                                            color: 'var(--champagne)',
                                            border: '0.5px solid var(--border-champagne)',
                                        } : {
                                            background: 'transparent',
                                            color: 'var(--text-tertiary)',
                                            border: '0.5px solid transparent',
                                        }),
                                    }}>
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>

                            {view === 'contacts' && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '0 16px', height: '46px',
                                    background: 'var(--surface-glass)',
                                    border: '1px solid var(--border-input)',
                                    borderRadius: 'var(--card-radius-sm)',
                                    marginBottom: '10px',
                                }}>
                                    <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}><IconSearch /></span>
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contacto..."
                                        style={{
                                            flex: 1, background: 'none', border: 'none', outline: 'none',
                                            fontFamily: "'Cormorant Garamond', serif",
                                            fontStyle: 'italic', fontSize: '15px', color: 'var(--text-primary)',
                                        }} />
                                    {search && (
                                        <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '18px', lineHeight: 1 }}>×</button>
                                    )}
                                </div>
                            )}

                            {view === 'radar' && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '13px 16px', marginBottom: '10px',
                                    background: 'var(--champagne-faint)',
                                    border: '1px solid var(--border-champagne)',
                                    borderRadius: 'var(--card-radius-sm)',
                                }}>
                                    <span style={{ color: 'var(--champagne-dim)', flexShrink: 0 }}><IconRadar /></span>
                                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '13px', color: 'var(--champagne-dim)', margin: 0 }}>
                                        Contactos que necesitan tu atención, ordenados por urgencia.
                                    </p>
                                </div>
                            )}

                            <div style={{
                                background: 'var(--surface-glass)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--card-radius-md)',
                                overflow: 'hidden',
                            }}>
                                {isLoading ? (
                                    <div style={{ padding: '48px', textAlign: 'center' }}>
                                        <div style={{
                                            width: '20px', height: '20px', margin: '0 auto 14px',
                                            border: '1px solid var(--border-ocean)',
                                            borderTopColor: 'var(--ocean)',
                                            borderRadius: '50%',
                                            animation: 'lucySpin 0.8s linear infinite',
                                        }} />
                                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                                            Cargando contactos...
                                        </p>
                                    </div>
                                ) : displayList.length === 0 ? (
                                    <div style={{ padding: '52px 24px', textAlign: 'center' }}>
                                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '15px', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
                                            {view === 'radar'
                                                ? 'Sin contactos que requieran atención ahora mismo.'
                                                : search ? 'No se encontraron contactos.'
                                                    : 'Lucy irá aprendiendo tus contactos conforme interactúas con tus correos.'}
                                        </p>
                                    </div>
                                ) : (
                                    displayList.map((c, i) => (
                                        <ContactRow key={c.contact_email + i} contact={c} onClick={setSelected} index={i} />
                                    ))
                                )}
                            </div>

                            {!isLoading && displayList.length > 0 && (
                                <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: '10px', textTransform: 'uppercase' }}>
                                    {displayList.length} contacto{displayList.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Modal nuevo contacto */}
                <AnimatePresence>
                    {showCreate && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed', inset: 0, zIndex: 100,
                                background: 'rgba(5,8,15,0.85)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '20px', backdropFilter: 'blur(4px)',
                            }}
                            onClick={() => setShowCreate(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8 }}
                                transition={{ duration: 0.25 }}
                                onClick={e => e.stopPropagation()}
                                style={{
                                    width: '100%', maxWidth: '420px',
                                    background: 'var(--surface-primary)',
                                    border: '1px solid var(--border-champagne)',
                                    borderRadius: 'var(--card-radius-lg)',
                                    padding: '28px',
                                    boxShadow: 'var(--card-shadow-deep)',
                                }}
                            >
                                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '22px', fontWeight: 400, color: 'var(--text-primary)', marginBottom: '22px' }}>
                                    Nuevo contacto
                                </h3>
                                {[
                                    { label: 'Nombre', value: newName, setter: setNewName, placeholder: 'Carlos García', required: false },
                                    { label: 'Email', value: newEmail, setter: setNewEmail, placeholder: 'carlos@empresa.com', required: true },
                                ].map(field => (
                                    <div key={field.label} style={{ marginBottom: '16px' }}>
                                        <p style={{ fontSize: '9px', letterSpacing: '0.16em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '7px' }}>
                                            {field.label}{field.required && ' *'}
                                        </p>
                                        <input
                                            value={field.value}
                                            onChange={e => field.setter(e.target.value)}
                                            placeholder={field.placeholder}
                                            onKeyDown={e => e.key === 'Enter' && field.required && handleCreateContact()}
                                            style={{
                                                width: '100%', height: '44px',
                                                background: 'var(--input-bg)',
                                                border: '1px solid var(--border-input)',
                                                borderRadius: 'var(--card-radius-sm)',
                                                padding: '0 14px', color: 'var(--text-primary)',
                                                fontSize: '14px', outline: 'none',
                                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                                boxSizing: 'border-box', transition: 'border-color 0.2s',
                                            }}
                                            onFocus={e => e.target.style.borderColor = 'var(--border-input-focus)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border-input)'}
                                        />
                                    </div>
                                ))}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
                                    <button onClick={handleCreateContact} disabled={!newEmail.trim() || creating} style={{
                                        flex: 1, height: '42px',
                                        background: 'var(--champagne-faint)',
                                        border: '1px solid var(--border-champagne)',
                                        borderRadius: 'var(--card-radius-sm)',
                                        cursor: !newEmail.trim() || creating ? 'not-allowed' : 'pointer',
                                        color: 'var(--champagne)', fontSize: '10px', letterSpacing: '0.14em',
                                        textTransform: 'uppercase',
                                        opacity: !newEmail.trim() || creating ? 0.45 : 1, transition: 'all 0.2s',
                                    }}>
                                        {creating ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button onClick={() => setShowCreate(false)} style={{
                                        padding: '0 22px', height: '42px', background: 'transparent',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--card-radius-sm)',
                                        cursor: 'pointer', color: 'var(--text-tertiary)',
                                        fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', transition: 'all 0.2s',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-ocean)'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                @keyframes lucySpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                input::placeholder {
                    color: var(--text-tertiary);
                    font-style: italic;
                }
            `}</style>
        </Layout>
    );
}
