import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../voice/VoiceProvider';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import apiClient from '../services/apiClient';
import {
    Brain, Trash2, Plus, Mail, Calendar, Volume2, VolumeX,
    Briefcase, Users, Heart, StickyNote, ChevronDown, X
} from 'lucide-react';

const CATEGORIES = {
    preferencia: { label: 'Preferencias', icon: Heart, color: 'rgba(201,178,124,0.6)' },
    proyecto: { label: 'Proyectos', icon: Briefcase, color: 'rgba(0,180,216,0.6)' },
    cliente: { label: 'Clientes', icon: Users, color: 'rgba(0,180,216,0.8)' },
    general: { label: 'General', icon: StickyNote, color: 'rgba(224,247,250,0.4)' },
};

const NoteCard = ({ note, onDelete, delay = 0 }) => {
    const cat = CATEGORIES[note.category] || CATEGORIES.general;
    const Icon = cat.icon;
    const [confirming, setConfirming] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="group relative rounded-xl p-4 transition-all duration-300"
            style={{
                background: 'rgba(4,18,32,0.4)',
                border: '1px solid rgba(0,180,216,0.08)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,180,216,0.15)'; e.currentTarget.style.background = 'rgba(4,18,32,0.6)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,180,216,0.08)'; e.currentTarget.style.background = 'rgba(4,18,32,0.4)'; }}
        >
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}30` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-[rgba(224,247,250,0.7)] leading-relaxed">{note.text}</p>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] uppercase tracking-[0.1em] font-medium" style={{ color: cat.color }}>
                            {cat.label}
                        </span>
                        {note.created_at && (
                            <span className="text-[10px] text-[rgba(224,247,250,0.15)]">
                                {new Date(note.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </span>
                        )}
                    </div>
                </div>

                {confirming ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => { onDelete(note.id); setConfirming(false); }}
                            className="text-[10px] text-red-400 border border-red-400/30 px-2 py-1 rounded-lg hover:bg-red-400/10 transition-all duration-200">
                            Borrar
                        </button>
                        <button onClick={() => setConfirming(false)}
                            className="text-[10px] text-[rgba(224,247,250,0.3)] border border-[rgba(0,180,216,0.1)] px-2 py-1 rounded-lg hover:bg-[rgba(0,180,216,0.05)] transition-all duration-200">
                            No
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setConfirming(true)}
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 text-[rgba(224,247,250,0.2)] hover:text-red-400 hover:bg-red-400/10">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

const AddNoteForm = ({ onAdd, onCancel }) => {
    const [text, setText] = useState('');
    const [category, setCategory] = useState('general');
    const [catOpen, setCatOpen] = useState(false);

    const handleSubmit = () => {
        if (text.trim().length < 3) return;
        onAdd(text.trim(), category);
        setText('');
        setCategory('general');
    };

    const selectedCat = CATEGORIES[category];

    return (
        <motion.div
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
        >
            <div className="rounded-2xl p-5 space-y-4"
                style={{ background: 'rgba(4,18,32,0.5)', border: '1px solid rgba(0,180,216,0.15)' }}>
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Ej: Mi cliente principal es Telefónica, prefiero reuniones por la mañana..."
                    className="w-full bg-transparent text-sm text-[rgba(224,247,250,0.7)] placeholder-[rgba(224,247,250,0.2)] rounded-xl px-4 py-3 resize-none transition-colors duration-200"
                    style={{ border: '1px solid rgba(0,180,216,0.1)' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(201,178,124,0.3)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(0,180,216,0.1)'}
                    rows={3}
                    autoFocus
                />

                <div className="flex items-center justify-between">
                    <div className="relative">
                        <button onClick={() => setCatOpen(o => !o)}
                            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg text-[rgba(224,247,250,0.4)] transition-all duration-200"
                            style={{ border: '1px solid rgba(0,180,216,0.1)' }}>
                            <selectedCat.icon className="w-3 h-3" style={{ color: selectedCat.color }} />
                            {selectedCat.label}
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>

                        {catOpen && (
                            <div className="absolute bottom-full mb-2 left-0 min-w-[160px] rounded-xl overflow-hidden z-10 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl"
                                style={{ background: 'rgba(4,18,32,0.95)', border: '1px solid rgba(0,180,216,0.12)' }}>
                                {Object.entries(CATEGORIES).map(([key, val]) => {
                                    const CatIcon = val.icon;
                                    return (
                                        <button key={key}
                                            onClick={() => { setCategory(key); setCatOpen(false); }}
                                            className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs text-left transition-colors
                        ${category === key ? 'bg-[rgba(201,178,124,0.06)]' : 'hover:bg-[rgba(0,180,216,0.04)]'}`}>
                                            <CatIcon className="w-3 h-3" style={{ color: val.color }} />
                                            <span style={{ color: category === key ? val.color : 'rgba(224,247,250,0.5)' }}>{val.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={onCancel}
                            className="text-xs text-[rgba(224,247,250,0.25)] hover:text-[rgba(224,247,250,0.5)] px-3 py-2 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSubmit}
                            disabled={text.trim().length < 3}
                            className="text-xs text-[#C9B27C] border border-[rgba(201,178,124,0.25)] px-4 py-2 rounded-lg bg-[rgba(201,178,124,0.06)] hover:bg-[rgba(201,178,124,0.12)] hover:border-[rgba(201,178,124,0.4)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200">
                            Guardar
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const ConnectionCard = ({ icon, title, connected, detail, onConnect, onDisconnect, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl p-4 transition-all duration-300"
        style={{ background: 'rgba(4,18,32,0.4)', border: '1px solid rgba(0,180,216,0.08)' }}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300
          ${connected
                        ? 'bg-[rgba(0,180,216,0.08)] text-[#00B4D8] border border-[rgba(0,180,216,0.2)]'
                        : 'bg-[rgba(4,18,32,0.6)] text-[rgba(224,247,250,0.3)] border border-[rgba(0,180,216,0.1)]'
                    }`}>
                    {icon}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-[rgba(224,247,250,0.75)]">{title}</span>
                        {connected && (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00B4D8] shadow-[0_0_6px_rgba(0,180,216,0.6)]" />
                                <span className="text-[10px] text-[#00B4D8] uppercase tracking-[0.08em]">Conectado</span>
                            </>
                        )}
                    </div>
                    <p className="text-xs text-[rgba(224,247,250,0.25)] mt-0.5">
                        {connected ? detail || 'Servicio activo' : 'No conectado'}
                    </p>
                </div>
            </div>

            {connected ? (
                <button onClick={onDisconnect}
                    className="text-xs text-[rgba(224,247,250,0.2)] hover:text-red-400 px-3 py-1.5 rounded-lg border border-[rgba(0,180,216,0.08)] hover:border-red-400/20 transition-all duration-200">
                    Desconectar
                </button>
            ) : (
                <button onClick={onConnect}
                    className="text-xs text-[#C9B27C] border border-[rgba(201,178,124,0.2)] px-3 py-1.5 rounded-lg bg-[rgba(201,178,124,0.04)] hover:bg-[rgba(201,178,124,0.1)] hover:border-[rgba(201,178,124,0.4)] transition-all duration-200">
                    Conectar
                </button>
            )}
        </div>
    </motion.div>
);

export default function SettingsPage() {
    const { token } = useAuth();
    const { ttsEnabled, setTtsEnabled } = useVoice();

    const [notes, setNotes] = useState([]);
    const [notesLoading, setNotesLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [filter, setFilter] = useState('all');

    const [gmailConnected, setGmailConnected] = useState(false);
    const [gmailEmail, setGmailEmail] = useState('');
    const [calendarConnected, setCalendarConnected] = useState(false);

    const fetchNotes = useCallback(async () => {
        try {
            const res = await apiClient.get('/memory');
            const data = res.data?.data || res.data;
            setNotes(data.notes || []);
        } catch (err) { console.error('Memory fetch:', err); }
        finally { setNotesLoading(false); }
    }, []);

    const fetchConnections = useCallback(async () => {
        try {
            const [gmail, cal] = await Promise.all([
                apiClient.get('/gmail/status'),
                apiClient.get('/calendar/status'),
            ]);
            const gd = gmail.data?.data || gmail.data;
            const cd = cal.data?.data || cal.data;
            setGmailConnected(!!gd.gmail_connected);
            setGmailEmail(gd.gmail_email || '');
            setCalendarConnected(!!cd.calendar_connected);
        } catch (err) { console.error('Connections:', err); }
    }, []);

    useEffect(() => { if (token) { fetchNotes(); fetchConnections(); } }, [fetchNotes, fetchConnections, token]);

    const handleAddNote = async (text, category) => {
        try {
            const res = await apiClient.post('/memory', { text, category });
            const data = res.data?.data || res.data;
            setNotes(data.notes || []);
            setShowAddForm(false);
        } catch (err) { console.error('Add note:', err); }
    };

    const handleDeleteNote = async (noteId) => {
        try {
            const res = await apiClient.delete(`/memory/${noteId}`);
            const data = res.data?.data || res.data;
            setNotes(data.notes || []);
        } catch (err) { console.error('Delete note:', err); }
    };

    const handleGmailConnect = async () => {
        try {
            const res = await apiClient.get('/gmail/auth');
            const url = res.data?.data?.auth_url || res.data?.auth_url;
            if (url) window.location.href = url;
        } catch (err) { console.error(err); }
    };

    const handleGmailDisconnect = async () => {
        try {
            await apiClient.post('/gmail/disconnect', {});
            setGmailConnected(false); setGmailEmail('');
        } catch (err) { console.error(err); }
    };

    const handleCalendarConnect = async () => {
        try {
            const res = await apiClient.get('/calendar/auth');
            const url = res.data?.data?.auth_url || res.data?.auth_url;
            if (url) window.location.href = url;
        } catch (err) { console.error(err); }
    };

    const handleCalendarDisconnect = async () => {
        try {
            await apiClient.post('/calendar/disconnect', {});
            setCalendarConnected(false);
        } catch (err) { console.error(err); }
    };

    const filteredNotes = filter === 'all' ? notes : notes.filter(n => n.category === filter);
    const noteCounts = notes.reduce((acc, n) => { acc[n.category] = (acc[n.category] || 0) + 1; return acc; }, {});

    return (
        <Layout>
            <div className="max-w-3xl mx-auto px-6 py-14 space-y-12">

                <button onClick={() => window.history.back()}
                    className="flex items-center gap-1.5 text-xs text-[rgba(224,247,250,0.25)] hover:text-[rgba(224,247,250,0.5)] -mb-8 transition-colors duration-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Volver
                </button>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                    <p className="text-xs text-[rgba(0,180,216,0.4)] uppercase tracking-[0.1em] font-medium mb-3">Configuración</p>
                    <h1 className="font-light tracking-tight text-[#E0F7FA] mb-2"
                        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem' }}>
                        Memoria de <span style={{ color: '#C9B27C' }}>Lucy</span>
                    </h1>
                    <p className="text-sm text-[rgba(224,247,250,0.35)] leading-relaxed max-w-lg">
                        Todo lo que Lucy recuerda sobre ti. Añade preferencias, proyectos activos y clientes clave
                        para que tus briefings y respuestas sean más personalizados.
                    </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
                    <h2 className="text-xs text-[rgba(0,180,216,0.35)] uppercase tracking-[0.1em] font-medium mb-4">Conexiones</h2>
                    <div className="space-y-3">
                        <ConnectionCard icon={<Mail className="w-4 h-4" />} title="Gmail" connected={gmailConnected} detail={gmailEmail} onConnect={handleGmailConnect} onDisconnect={handleGmailDisconnect} delay={0.15} />
                        <ConnectionCard icon={<Calendar className="w-4 h-4" />} title="Google Calendar" connected={calendarConnected} onConnect={handleCalendarConnect} onDisconnect={handleCalendarDisconnect} delay={0.2} />
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
                    <h2 className="text-xs text-[rgba(0,180,216,0.35)] uppercase tracking-[0.1em] font-medium mb-4">Voz</h2>
                    <div className="rounded-xl p-4" style={{ background: 'rgba(4,18,32,0.4)', border: '1px solid rgba(0,180,216,0.08)' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {ttsEnabled ? <Volume2 className="w-4 h-4 text-[#C9B27C]" /> : <VolumeX className="w-4 h-4 text-[rgba(224,247,250,0.3)]" />}
                                <div>
                                    <p className="text-sm text-[rgba(224,247,250,0.75)]">Voz de Lucy</p>
                                    <p className="text-xs text-[rgba(224,247,250,0.25)] mt-0.5">{ttsEnabled ? 'Lucy habla en voz alta' : 'Lucy solo responde con texto'}</p>
                                </div>
                            </div>
                            <button onClick={() => setTtsEnabled(prev => !prev)}
                                className={`relative w-12 h-7 rounded-full transition-all duration-300 ${ttsEnabled ? 'bg-[rgba(0,180,216,0.2)] border border-[rgba(0,180,216,0.4)]' : 'bg-[rgba(4,18,32,0.6)] border border-[rgba(0,180,216,0.12)]'}`}>
                                <div className={`absolute top-1 w-5 h-5 rounded-full transition-all duration-300 ${ttsEnabled ? 'left-6 bg-[#00B4D8]' : 'left-1 bg-[rgba(224,247,250,0.3)]'}`} />
                            </button>
                        </div>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs text-[rgba(0,180,216,0.35)] uppercase tracking-[0.1em] font-medium">Notas ({notes.length})</h2>
                        {!showAddForm && (
                            <button onClick={() => setShowAddForm(true)}
                                className="flex items-center gap-1.5 text-xs text-[#C9B27C] border border-[rgba(201,178,124,0.2)] px-3 py-1.5 rounded-lg bg-[rgba(201,178,124,0.04)] hover:bg-[rgba(201,178,124,0.1)] hover:border-[rgba(201,178,124,0.4)] transition-all duration-200">
                                <Plus className="w-3 h-3" />
                                Añadir nota
                            </button>
                        )}
                    </div>

                    {notes.length > 0 && (
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <button onClick={() => setFilter('all')}
                                className={`text-[10px] uppercase tracking-[0.08em] px-3 py-1.5 rounded-lg border transition-all duration-200 ${filter === 'all' ? 'text-[#C9B27C] border-[rgba(201,178,124,0.25)] bg-[rgba(201,178,124,0.06)]' : 'text-[rgba(224,247,250,0.3)] border-[rgba(0,180,216,0.08)] hover:border-[rgba(0,180,216,0.15)]'}`}>
                                Todas ({notes.length})
                            </button>
                            {Object.entries(CATEGORIES).map(([key, val]) => {
                                const count = noteCounts[key] || 0;
                                if (count === 0) return null;
                                return (
                                    <button key={key} onClick={() => setFilter(key)}
                                        className={`text-[10px] uppercase tracking-[0.08em] px-3 py-1.5 rounded-lg border transition-all duration-200 ${filter === key ? 'border-[rgba(201,178,124,0.25)] bg-[rgba(201,178,124,0.06)]' : 'border-[rgba(0,180,216,0.08)] hover:border-[rgba(0,180,216,0.15)]'}`}
                                        style={{ color: filter === key ? val.color : 'rgba(224,247,250,0.3)' }}>
                                        {val.label} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <AnimatePresence>
                        {showAddForm && (
                            <div className="mb-4">
                                <AddNoteForm onAdd={handleAddNote} onCancel={() => setShowAddForm(false)} />
                            </div>
                        )}
                    </AnimatePresence>

                    {notesLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-[rgba(0,180,216,0.3)] border-t-[#00B4D8] rounded-full animate-spin" />
                        </div>
                    ) : filteredNotes.length === 0 ? (
                        <div className="text-center py-12">
                            <Brain className="w-10 h-10 mx-auto text-[rgba(0,180,216,0.1)] mb-4" />
                            <p className="text-sm text-[rgba(224,247,250,0.25)]">
                                {notes.length === 0 ? 'Lucy aún no tiene recuerdos. Añade notas o dile "Lucy, recuerda que..."' : 'No hay notas en esta categoría.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {filteredNotes.map((note, i) => (
                                    <NoteCard key={note.id} note={note} onDelete={handleDeleteNote} delay={i * 0.03} />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {notes.length < 5 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
                            className="mt-6 rounded-xl px-5 py-4"
                            style={{ background: 'rgba(0,180,216,0.03)', border: '1px solid rgba(0,180,216,0.1)' }}>
                            <p className="text-xs text-[rgba(0,180,216,0.5)] leading-relaxed">
                                <span className="text-[rgba(201,178,124,0.7)] font-medium">Tip:</span> También puedes decirle a Lucy por voz:
                                "Recuerda que mi cliente principal es Telefónica" o "Anota que prefiero reuniones por la mañana".
                                Lucy clasificará la nota automáticamente.
                            </p>
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </Layout>
    );
}