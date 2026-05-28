import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Plus, Clock, MapPin, Users, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTodayEvents, getUpcomingEvents, formatEventTime } from '../services/calendarService';
import apiClient from '../services/apiClient';

const today = () => new Date().toISOString().split('T')[0];

const EMPTY_FORM = {
    title: '',
    date: today(),
    start_time: '09:00',
    end_time: '10:00',
    description: '',
    location: '',
    attendees: '',
};

function EventRow({ event }) {
    return (
        <div className="flex items-start gap-3 py-3 px-4 hover:bg-[rgba(255,255,255,0.02)] rounded-xl transition-colors group">
            <div className="flex-shrink-0 w-12 text-right pt-0.5">
                <span className="text-xs text-[rgba(201,178,124,0.55)] tabular-nums font-medium">
                    {event.all_day ? 'Todo el día' : formatEventTime(event.start)}
                </span>
            </div>
            <div className="w-px self-stretch bg-[rgba(201,178,124,0.12)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-sm text-[rgba(255,255,255,0.75)] truncate leading-snug">{event.title}</p>
                {event.location && (
                    <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-[rgba(255,255,255,0.2)]" />
                        <span className="text-xs text-[rgba(255,255,255,0.2)] truncate">{event.location}</span>
                    </div>
                )}
                {event.attendees?.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                        <Users className="w-2.5 h-2.5 text-[rgba(255,255,255,0.2)]" />
                        <span className="text-xs text-[rgba(255,255,255,0.2)] truncate">{event.attendees.length} asistente{event.attendees.length !== 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>
            {event.meet_link && (
                <a href={event.meet_link} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 text-xs text-[rgba(201,178,124,0.4)] hover:text-[#C9B27C] border border-[rgba(201,178,124,0.12)] hover:border-[rgba(201,178,124,0.3)] px-2 py-0.5 rounded-lg transition-all">
                    Meet
                </a>
            )}
        </div>
    );
}

export default function CalendarDrawer({ open, onClose }) {
    const { token } = useAuth();
    const [todayEvents, setTodayEvents] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open || !token) return;
        setLoading(true);
        Promise.all([getTodayEvents(), getUpcomingEvents(7)])
            .then(([t, u]) => {
                setTodayEvents(Array.isArray(t) ? t : []);
                const todayStr = today();
                setUpcomingEvents(Array.isArray(u) ? u.filter(e => {
                    const d = e.start?.split('T')[0] || '';
                    return d > todayStr;
                }) : []);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [open, token]);

    const handleCreate = async () => {
        if (!form.title || !form.date) { setError('Título y fecha son obligatorios'); return; }
        if (saving) return;
        setSaving(true); setError('');
        try {
            const attendees = form.attendees
                ? form.attendees.split(',').map(e => e.trim()).filter(e => e.includes('@'))
                : [];
            await apiClient.post('/calendar/events', { ...form, attendees });
            setSaved(true);
            setForm(EMPTY_FORM);
            setShowForm(false);
            const [t, u] = await Promise.all([getTodayEvents(), getUpcomingEvents(7)]);
            setTodayEvents(Array.isArray(t) ? t : []);
            const todayStr = today();
            setUpcomingEvents(Array.isArray(u) ? u.filter(e => (e.start?.split('T')[0] || '') > todayStr) : []);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al crear el evento');
        } finally { setSaving(false); }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40"
                        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />

                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full sm:w-[380px]"
                        style={{ background: '#0C0E14', borderLeft: '1px solid rgba(201,178,124,0.1)' }}>

                        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(255,255,255,0.05)]">
                            <div className="flex items-center gap-2.5">
                                <Calendar className="w-4 h-4 text-[rgba(201,178,124,0.6)]" />
                                <p className="text-sm font-medium text-[rgba(255,255,255,0.7)] uppercase tracking-[0.08em]">Agenda</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { setShowForm(f => !f); setError(''); }}
                                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 ${showForm ? 'text-[#C9B27C] border-[rgba(201,178,124,0.3)] bg-[rgba(201,178,124,0.08)]' : 'text-[rgba(255,255,255,0.3)] border-[rgba(255,255,255,0.08)] hover:text-[#C9B27C] hover:border-[rgba(201,178,124,0.2)]'}`}>
                                    <Plus className="w-3 h-3" />
                                    Nuevo
                                </button>
                                <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[rgba(255,255,255,0.2)] hover:text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.05)] transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <AnimatePresence>
                            {showForm && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                                    className="border-b border-[rgba(255,255,255,0.05)] overflow-hidden">
                                    <div className="px-6 py-4 space-y-3">
                                        <p className="text-xs text-[rgba(201,178,124,0.5)] uppercase tracking-[0.1em] mb-1">Nuevo evento</p>

                                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                            placeholder="Título del evento"
                                            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[rgba(255,255,255,0.2)] focus:outline-none focus:border-[rgba(201,178,124,0.3)] transition-colors" />

                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                                className="col-span-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[rgba(201,178,124,0.3)] transition-colors" />
                                            <div className="col-span-3 grid grid-cols-2 gap-2">
                                                <div className="relative">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[rgba(255,255,255,0.2)]" />
                                                    <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                                                        className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl pl-8 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-[rgba(201,178,124,0.3)] transition-colors" />
                                                </div>
                                                <div className="relative">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[rgba(255,255,255,0.2)]" />
                                                    <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                                                        className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl pl-8 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-[rgba(201,178,124,0.3)] transition-colors" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[rgba(255,255,255,0.2)]" />
                                            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                                placeholder="Lugar (opcional)"
                                                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-[rgba(255,255,255,0.2)] focus:outline-none focus:border-[rgba(201,178,124,0.3)] transition-colors" />
                                        </div>

                                        <div className="relative">
                                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[rgba(255,255,255,0.2)]" />
                                            <input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
                                                placeholder="Asistentes — emails separados por comas"
                                                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-[rgba(255,255,255,0.2)] focus:outline-none focus:border-[rgba(201,178,124,0.3)] transition-colors" />
                                        </div>

                                        {error && <p className="text-xs text-red-400">{error}</p>}

                                        <button onClick={handleCreate} disabled={saving}
                                            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.25)] text-[#C9B27C] hover:bg-[rgba(201,178,124,0.18)] hover:border-[rgba(201,178,124,0.4)] disabled:opacity-40">
                                            {saving ? 'Creando...' : 'Crear evento'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {saved && (
                                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="mx-6 mt-4 px-4 py-3 rounded-xl bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.2)] text-xs text-emerald-400">
                                    ✓ Evento creado en Google Calendar
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex-1 overflow-y-auto py-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="flex items-center gap-2">
                                        {[0, 0.2, 0.4].map((d, i) => (
                                            <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: d }}
                                                className="w-1 h-1 rounded-full bg-[#C9B27C]" />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="px-6 mb-2">
                                        <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em]">Hoy</p>
                                    </div>
                                    {todayEvents.length === 0 ? (
                                        <p className="px-6 py-3 text-sm text-[rgba(255,255,255,0.2)] italic"
                                            style={{ fontFamily: "'Cormorant Garamond', serif" }}>Agenda libre.</p>
                                    ) : (
                                        <div className="px-2">
                                            {todayEvents.map((e, i) => <EventRow key={e.id || i} event={e} />)}
                                        </div>
                                    )}

                                    {upcomingEvents.length > 0 && (
                                        <>
                                            <div className="px-6 mt-5 mb-2">
                                                <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em]">Próximos 7 días</p>
                                            </div>
                                            <div className="px-2">
                                                {upcomingEvents.map((e, i) => (
                                                    <div key={e.id || i}>
                                                        {(i === 0 || e.start?.split('T')[0] !== upcomingEvents[i - 1]?.start?.split('T')[0]) && (
                                                            <p className="px-4 pt-2 pb-1 text-xs text-[rgba(201,178,124,0.3)] capitalize">
                                                                {new Date(e.start).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                            </p>
                                                        )}
                                                        <EventRow event={e} />
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
                            <p className="text-xs text-[rgba(255,255,255,0.08)] uppercase tracking-[0.1em] text-center">Google Calendar · sincronizado</p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}