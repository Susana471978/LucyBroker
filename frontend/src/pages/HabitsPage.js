import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import apiClient from '../services/apiClient';
import { Plus, Trash2, Flame, Check, X } from 'lucide-react';

const HABIT_ICONS = ['💧', '🏃', '🧘', '📖', '💊', '🥗', '😴', '✍️', '🎯', '💪', '🧠', '☀️'];

const StreakBadge = ({ streak }) => {
    if (streak < 2) return null;
    return (
        <div className="flex items-center gap-1 text-xs">
            <Flame className="w-3 h-3 text-[rgba(201,178,124,0.7)]" />
            <span className="text-[var(--champagne-dim)] font-medium">{streak} días</span>
        </div>
    );
};

const HabitCard = ({ habit, onToggle, onDelete, onShowHistory, delay = 0 }) => {
    const [confirming, setConfirming] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleToggle = async () => {
        if (toggling) return;
        setToggling(true);
        await onToggle(habit.id);
        setToggling(false);
    };

    const handleDelete = async () => {
        if (deleting) return;
        setDeleting(true);
        await onDelete(habit.id);
        setDeleting(false);
        setConfirming(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`group relative rounded-2xl p-5 transition-all duration-300 border
        ${habit.completed_today
                    ? 'bg-[rgba(52,211,153,0.04)] border-[rgba(52,211,153,0.15)]'
                    : 'bg-[var(--surface-glass-hover)] border-[var(--border-subtle)] hover:border-[rgba(255,255,255,0.1)]'
                }`}
        >
            <div className="flex items-center gap-4">
                <button onClick={handleToggle} disabled={toggling}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 border disabled:opacity-50
            ${habit.completed_today
                            ? 'bg-[rgba(52,211,153,0.12)] border-[rgba(52,211,153,0.25)] text-emerald-400'
                            : 'bg-[var(--surface-glass-hover)] border-[var(--border-subtle)] text-[rgba(255,255,255,0.2)] hover:border-[rgba(201,178,124,0.25)] hover:text-[var(--champagne-dim)]'
                        }`}
                >
                    {habit.completed_today ? (
                        <Check className="w-5 h-5" />
                    ) : (
                        <span className="text-lg">{habit.icon}</span>
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <p className={`text-sm font-medium transition-colors duration-300
              ${habit.completed_today ? 'text-emerald-400/80 line-through' : 'text-[var(--text-primary)]'}`}>
                            {habit.name}
                        </p>
                        <StreakBadge streak={habit.streak} />
                    </div>
                    <p className="text-xs text-[rgba(255,255,255,0.2)] mt-1">
                        {habit.total_completions} veces completado
                    </p>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={() => onShowHistory(habit.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100
              text-[rgba(255,255,255,0.2)] hover:text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.05)]
              transition-all duration-200"
                        title="Ver historial">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </button>

                    {confirming ? (
                        <div className="flex items-center gap-1">
                            <button onClick={handleDelete} disabled={deleting}
                                className="text-[10px] text-red-400 border border-red-400/30 px-2 py-1 rounded-lg hover:bg-red-400/10 transition-all disabled:opacity-50">
                                {deleting ? '...' : 'Sí'}
                            </button>
                            <button onClick={() => setConfirming(false)} disabled={deleting}
                                className="text-[10px] text-[var(--text-tertiary)] border border-[var(--border-subtle)] px-2 py-1 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-all">
                                No
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setConfirming(true)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100
                text-[rgba(255,255,255,0.2)] hover:text-red-400 hover:bg-red-400/10 transition-all duration-200">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const HistoryGrid = ({ history, onClose }) => {
    if (!history) return null;
    const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
        >
            <div className="rounded-2xl p-5 bg-[var(--surface-glass)] border border-[var(--border-subtle)] mt-3">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm text-[rgba(255,255,255,0.6)]">{history.name}</p>
                        <p className="text-xs text-[rgba(255,255,255,0.2)] mt-0.5">Últimos 30 días · Racha: {history.streak} días</p>
                    </div>
                    <button onClick={onClose}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[rgba(255,255,255,0.2)] hover:text-[var(--text-secondary)] transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                    {weekDays.map(d => (
                        <div key={d} className="text-center text-[10px] text-[rgba(255,255,255,0.15)] font-medium pb-1">{d}</div>
                    ))}
                    {history.days.length > 0 && (() => {
                        const firstDate = new Date(history.days[0].date + 'T00:00:00');
                        const dayOfWeek = (firstDate.getDay() + 6) % 7;
                        return Array.from({ length: dayOfWeek }, (_, i) => (
                            <div key={`pad-${i}`} />
                        ));
                    })()}
                    {history.days.map((day) => (
                        <div key={day.date}
                            className={`w-full aspect-square rounded-md flex items-center justify-center text-[10px] transition-colors
                ${day.completed
                                    ? 'bg-[rgba(52,211,153,0.2)] text-emerald-400/70'
                                    : 'bg-[var(--surface-glass-hover)] text-[rgba(255,255,255,0.1)]'
                                }`}
                            title={`${day.date}: ${day.completed ? '✓' : '—'}`}
                        >
                            {new Date(day.date + 'T00:00:00').getDate()}
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

const AddHabitForm = ({ onAdd, onCancel }) => {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('✅');
    const [showIcons, setShowIcons] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (name.trim().length < 2 || submitting) return;
        setSubmitting(true);
        await onAdd(name.trim(), icon);
        setSubmitting(false);
        setName('');
        setIcon('✅');
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
        >
            <div className="rounded-2xl p-5 bg-[var(--surface-glass-hover)] border border-[var(--glow-champagne-md)] space-y-4">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button onClick={() => setShowIcons(o => !o)}
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-lg
                bg-[rgba(255,255,255,0.04)] border border-[var(--border-subtle)]
                hover:border-[rgba(201,178,124,0.25)] transition-all duration-200">
                            {icon}
                        </button>
                        {showIcons && (
                            <div className="absolute top-full mt-2 left-0 z-10 grid grid-cols-6 gap-1 p-2 rounded-xl
                bg-[rgba(10,10,16,0.95)] border border-[var(--border-subtle)]
                shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                                {HABIT_ICONS.map(ic => (
                                    <button key={ic} onClick={() => { setIcon(ic); setShowIcons(false); }}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm
                      hover:bg-[rgba(255,255,255,0.08)] transition-colors
                      ${icon === ic ? 'bg-[rgba(201,178,124,0.1)]' : ''}`}>
                                        {ic}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        placeholder="Nombre del hábito... (ej: Beber 2L de agua)"
                        className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[rgba(255,255,255,0.2)]
              border border-[var(--border-subtle)] rounded-xl px-4 py-3
              focus:border-[rgba(201,178,124,0.3)] focus:outline-none transition-colors duration-200"
                        autoFocus
                    />
                </div>

                <div className="flex items-center justify-end gap-2">
                    <button onClick={onCancel}
                        className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] px-3 py-2 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSubmit}
                        disabled={name.trim().length < 2 || submitting}
                        className="text-xs text-[var(--champagne)] border border-[rgba(201,178,124,0.25)] px-4 py-2 rounded-lg
              bg-[rgba(201,178,124,0.06)] hover:bg-[var(--champagne-faint)] hover:border-[rgba(201,178,124,0.4)]
              disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200">
                        {submitting ? 'Creando…' : 'Crear hábito'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default function HabitsPage() {
    const { token } = useAuth();

    const [habits, setHabits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [historyData, setHistoryData] = useState(null);
    const [today, setToday] = useState('');

    const fetchHabits = useCallback(async () => {
        try {
            const res = await apiClient.get('/habits');
            const data = res.data?.data || res.data;
            setHabits(data.habits || []);
            setToday(data.today || '');
        } catch (err) { console.error('Habits fetch:', err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { if (token) fetchHabits(); }, [fetchHabits, token]);

    const handleAdd = async (name, icon) => {
        try {
            await apiClient.post('/habits', { name, icon });
            await fetchHabits();
            setShowAddForm(false);
        } catch (err) { console.error('Add habit:', err); }
    };

    const handleToggle = async (habitId) => {
        try {
            await apiClient.post(`/habits/${habitId}/toggle`, {});
            await fetchHabits();
        } catch (err) { console.error('Toggle habit:', err); }
    };

    const handleDelete = async (habitId) => {
        try {
            await apiClient.delete(`/habits/${habitId}`);
            setHabits(prev => prev.filter(h => h.id !== habitId));
            if (historyData?.habit_id === habitId) setHistoryData(null);
        } catch (err) { console.error('Delete habit:', err); }
    };

    const handleShowHistory = async (habitId) => {
        if (historyData?.habit_id === habitId) {
            setHistoryData(null);
            return;
        }
        try {
            const res = await apiClient.get(`/habits/${habitId}/history`);
            setHistoryData(res.data?.data || res.data);
        } catch (err) { console.error('History:', err); }
    };

    const completedCount = habits.filter(h => h.completed_today).length;
    const totalCount = habits.length;
    const allDone = completedCount === totalCount && totalCount > 0;

    return (
        <Layout>
            <div className="max-w-2xl mx-auto px-6 py-14 space-y-8">

                <button onClick={() => window.history.back()}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]
            mb-4 transition-colors duration-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Volver
                </button>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                    <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em] font-medium mb-3">Asistente personal</p>
                    <h1 className="font-light tracking-tight text-[var(--text-primary)] mb-2"
                        style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem' }}>
                        Mis hábitos
                    </h1>
                    <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
                        Registra tus hábitos diarios. Lucy los incluirá en tu briefing y te motivará a mantener tu racha.
                    </p>
                </motion.div>

                {totalCount > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
                        className="rounded-2xl p-5 bg-[var(--surface-glass-hover)] border border-[var(--border-subtle)]">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm text-[var(--text-secondary)]">
                                {allDone ? '¡Todos completados!' : `${completedCount} de ${totalCount} hoy`}
                            </p>
                            {allDone && <span className="text-xs text-emerald-400">🎉</span>}
                        </div>
                        <div className="h-2 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                className={`h-full rounded-full transition-colors duration-500
                  ${allDone ? 'bg-emerald-400' : 'bg-[rgba(201,178,124,0.5)]'}`}
                            />
                        </div>
                    </motion.div>
                )}

                <div className="flex justify-end">
                    {!showAddForm && (
                        <button onClick={() => setShowAddForm(true)}
                            className="flex items-center gap-1.5 text-xs text-[var(--champagne)] border border-[var(--border-champagne)]
                px-3 py-1.5 rounded-lg bg-[rgba(201,178,124,0.04)]
                hover:bg-[rgba(201,178,124,0.1)] hover:border-[rgba(201,178,124,0.4)] transition-all duration-200">
                            <Plus className="w-3 h-3" />
                            Nuevo hábito
                        </button>
                    )}
                </div>

                <AnimatePresence>
                    {showAddForm && <AddHabitForm onAdd={handleAdd} onCancel={() => setShowAddForm(false)} />}
                </AnimatePresence>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-6 h-6 border-2 border-[rgba(201,178,124,0.3)] border-t-[var(--champagne)] rounded-full animate-spin" />
                    </div>
                ) : habits.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-4xl mb-4 opacity-30">🎯</div>
                        <p className="text-sm text-[var(--text-tertiary)] mb-2">Aún no tienes hábitos</p>
                        <p className="text-xs text-[rgba(255,255,255,0.15)]">
                            Crea tu primer hábito o dile a Lucy "quiero empezar a meditar cada día"
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                            {habits.map((habit, i) => (
                                <div key={habit.id}>
                                    <HabitCard
                                        habit={habit}
                                        onToggle={handleToggle}
                                        onDelete={handleDelete}
                                        onShowHistory={handleShowHistory}
                                        delay={i * 0.05}
                                    />
                                    <AnimatePresence>
                                        {historyData?.habit_id === habit.id && (
                                            <HistoryGrid history={historyData} onClose={() => setHistoryData(null)} />
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {habits.length < 3 && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
                        className="rounded-xl px-5 py-4 bg-[rgba(201,178,124,0.03)] border border-[rgba(201,178,124,0.1)]"
                    >
                        <p className="text-xs text-[rgba(201,178,124,0.5)] leading-relaxed">
                            <span className="text-[rgba(201,178,124,0.7)] font-medium">Tip:</span> Dile a Lucy por voz
                            "quiero crear un hábito de hacer ejercicio" o "he completado mi hábito de meditar hoy".
                            Lucy lo gestionará por ti.
                        </p>
                    </motion.div>
                )}
            </div>
        </Layout>
    );
}