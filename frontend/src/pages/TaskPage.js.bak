import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Plus, Trash2, Loader2, Flag, Calendar, X } from 'lucide-react';
import Layout from '../components/Layout';
import apiClient from '../services/apiClient';

/* ─── helpers ─────────────────────────────────────── */
const PRIORITY_STYLES = {
    high: { label: 'Alta', color: '#C9B27C', bg: 'rgba(201,178,124,0.1)', border: 'rgba(201,178,124,0.3)' },
    normal: { label: 'Normal', color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
    low: { label: 'Baja', color: 'rgba(255,255,255,0.2)', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.05)' },
};

const formatDue = (date) => {
    if (!date) return null;
    try {
        const d = new Date(date + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diff = Math.round((d - today) / 86400000);
        if (diff === 0) return { text: 'Hoy', urgent: true };
        if (diff === 1) return { text: 'Mañana', urgent: false };
        if (diff < 0) return { text: `Vencida hace ${Math.abs(diff)}d`, urgent: true };
        return { text: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), urgent: false };
    } catch { return null; }
};

/* ─── TaskRow ──────────────────────────────────────── */
const TaskRow = ({ task, onToggle, onDelete }) => {
    const [deleting, setDeleting] = useState(false);
    const [toggling, setToggling] = useState(false);
    const p = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal;
    const due = formatDue(task.due_date);

    const handleToggle = async () => {
        setToggling(true);
        await onToggle(task.id, !task.done);
        setToggling(false);
    };

    const handleDelete = async () => {
        setDeleting(true);
        await onDelete(task.id);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`group flex items-start gap-4 px-5 py-4 rounded-[20px] border transition-all duration-300
        ${task.done
                    ? 'bg-[linear-gradient(180deg,rgba(8,12,22,0.6)_0%,rgba(4,7,15,0.6)_100%)] border-[rgba(255,255,255,0.04)]'
                    : 'bg-[linear-gradient(180deg,rgba(8,12,22,0.95)_0%,rgba(4,7,15,0.99)_100%)] border-[rgba(88,160,255,0.12)] shadow-[0_0_0_1px_rgba(90,170,255,0.04)_inset,0_0_10px_rgba(54,126,255,0.04)] hover:border-[rgba(88,160,255,0.24)]'
                }`}
        >
            {/* Checkbox */}
            <button
                onClick={handleToggle}
                disabled={toggling}
                className="flex-shrink-0 mt-0.5 transition-all duration-200 hover:scale-110 disabled:opacity-50"
            >
                {toggling ? (
                    <Loader2 className="w-5 h-5 text-[#C9B27C] animate-spin" />
                ) : task.done ? (
                    <CheckCircle2 className="w-5 h-5 text-[rgba(201,178,124,0.5)]" />
                ) : (
                    <Circle className="w-5 h-5 text-[rgba(255,255,255,0.2)] group-hover:text-[rgba(255,255,255,0.4)]" />
                )}
            </button>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug transition-all duration-200
          ${task.done ? 'line-through text-[rgba(255,255,255,0.2)]' : 'text-[rgba(255,255,255,0.75)]'}`}>
                    {task.title}
                </p>
                {task.notes && !task.done && (
                    <p className="text-xs text-[rgba(255,255,255,0.25)] mt-1 leading-relaxed">{task.notes}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Priority */}
                    {task.priority === 'high' && (
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full"
                            style={{ color: p.color, background: p.bg, border: `1px solid ${p.border}` }}>
                            <Flag className="w-2.5 h-2.5" /> Alta
                        </span>
                    )}
                    {/* Due date */}
                    {due && !task.done && (
                        <span className={`flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full
              ${due.urgent
                                ? 'text-[#C9B27C] bg-[rgba(201,178,124,0.08)] border border-[rgba(201,178,124,0.2)]'
                                : 'text-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)]'
                            }`}>
                            <Calendar className="w-2.5 h-2.5" /> {due.text}
                        </span>
                    )}
                </div>
            </div>

            {/* Eliminar */}
            <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200
          text-[rgba(255,255,255,0.15)] hover:text-[rgba(255,100,100,0.6)] disabled:opacity-30"
            >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
        </motion.div>
    );
};

/* ─── NewTaskForm ──────────────────────────────────── */
const NewTaskForm = ({ onAdd, onClose }) => {
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [priority, setPriority] = useState('normal');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!title.trim()) return;
        setLoading(true);
        await onAdd({ title: title.trim(), notes, priority, due_date: dueDate || null });
        setLoading(false);
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-[24px] p-5 border border-[rgba(201,178,124,0.34)]
        bg-[linear-gradient(180deg,rgba(10,13,20,0.96)_0%,rgba(5,7,12,0.99)_100%)] overflow-hidden
        shadow-[inset_0_0_0_1px_rgba(201,178,124,0.05),0_0_18px_rgba(201,178,124,0.06)]"
        >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.4)] to-transparent" />

            <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-[#C9B27C] uppercase tracking-[0.1em]">Nueva tarea</p>
                <button onClick={onClose} className="text-[rgba(255,255,255,0.2)] hover:text-[rgba(255,255,255,0.5)] transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                placeholder="¿Qué hay que hacer?"
                className="w-full bg-[linear-gradient(180deg,rgba(7,12,24,0.92)_0%,rgba(4,8,18,0.88)_100%)] border border-[rgba(88,160,255,0.24)]
          rounded-[16px] px-4 py-3 text-sm text-[rgba(255,255,255,0.8)]
          placeholder:text-[rgba(255,255,255,0.2)] outline-none mb-3
          shadow-[0_0_0_1px_rgba(90,170,255,0.08)_inset,0_0_10px_rgba(54,126,255,0.06)]
          focus:bg-[linear-gradient(180deg,rgba(24,18,10,0.96)_0%,rgba(14,10,6,0.92)_100%)] focus:border-[rgba(201,178,124,0.72)] focus:shadow-[0_0_0_1px_rgba(201,178,124,0.12)_inset,0_0_14px_rgba(201,178,124,0.18)] transition-all duration-300"
            />

            <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas (opcional)"
                rows={2}
                className="w-full bg-[linear-gradient(180deg,rgba(7,12,24,0.92)_0%,rgba(4,8,18,0.88)_100%)] border border-[rgba(88,160,255,0.16)]
          rounded-[16px] px-4 py-3 text-sm text-[rgba(255,255,255,0.6)]
          placeholder:text-[rgba(255,255,255,0.15)] outline-none resize-none mb-3
          shadow-[0_0_0_1px_rgba(90,170,255,0.04)_inset]
          focus:border-[rgba(201,178,124,0.5)] focus:shadow-[0_0_0_1px_rgba(201,178,124,0.08)_inset,0_0_10px_rgba(201,178,124,0.10)] transition-all duration-300"
            />

            <div className="flex items-center gap-3 mb-4 flex-wrap">
                {/* Priority */}
                <div className="flex items-center gap-1">
                    {['low', 'normal', 'high'].map(p => (
                        <button key={p}
                            onClick={() => setPriority(p)}
                            className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.08em] transition-all duration-300
                ${priority === p
                                    ? 'bg-[rgba(201,178,124,0.12)] text-[#C9B27C] border border-[rgba(201,178,124,0.3)] shadow-[0_0_10px_rgba(201,178,124,0.06)]'
                                    : 'text-[rgba(255,255,255,0.25)] border border-[rgba(88,160,255,0.12)] hover:border-[rgba(88,160,255,0.28)]'
                                }`}>
                            {PRIORITY_STYLES[p].label}
                        </button>
                    ))}
                </div>

                {/* Due date */}
                <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="bg-[linear-gradient(180deg,rgba(7,12,24,0.92)_0%,rgba(4,8,18,0.88)_100%)] border border-[rgba(88,160,255,0.16)]
            rounded-[16px] px-3 py-1 text-xs text-[rgba(255,255,255,0.4)] outline-none
            shadow-[0_0_0_1px_rgba(90,170,255,0.04)_inset]
            focus:border-[rgba(201,178,124,0.4)] transition-all duration-300
            [color-scheme:dark]"
                />
            </div>

            <button
                onClick={handleSubmit}
                disabled={loading || !title.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs uppercase tracking-[0.08em]
          bg-[rgba(201,178,124,0.1)] text-[#C9B27C]
          border border-[rgba(201,178,124,0.25)]
          hover:bg-[rgba(201,178,124,0.16)] hover:border-[rgba(201,178,124,0.4)] transition-all duration-300
          disabled:opacity-30 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {loading ? 'Guardando…' : 'Añadir tarea'}
            </button>
        </motion.div>
    );
};

/* ─── Main ─────────────────────────────────────────── */
export default function TasksPage() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDone, setShowDone] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/tasks');
            const data = res.data?.data?.tasks || res.data?.tasks || [];
            setTasks(data);
        } catch (err) {
            console.error('Tasks fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const handleAdd = async (payload) => {
        try {
            const res = await apiClient.post('/tasks', payload);
            const task = res.data?.data?.task || res.data?.task;
            if (task) setTasks(prev => [task, ...prev]);
        } catch (err) {
            console.error('Task create error:', err);
        }
    };

    const handleToggle = async (id, done) => {
        try {
            const res = await apiClient.patch(`/tasks/${id}/done`, { done });
            const updated = res.data?.data?.task || res.data?.task;
            if (updated) setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
        } catch (err) {
            console.error('Task toggle error:', err);
        }
    };

    const handleDelete = async (id) => {
        try {
            await apiClient.delete(`/tasks/${id}`);
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error('Task delete error:', err);
        }
    };

    const pending = tasks.filter(t => !t.done);
    const done = tasks.filter(t => t.done);

    return (
        <Layout>
            <div className="max-w-3xl mx-auto px-6 py-14 space-y-10">
                {/* Volver */}
                <button onClick={() => window.history.back()}
                    className="flex items-center gap-1.5 text-xs text-[rgba(255,255,255,0.25)] hover:text-[rgba(255,255,255,0.5)]
                        -mb-6 transition-colors duration-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Volver
                </button>

                {/* Header */}
                <div className="flex items-center justify-between">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em] font-medium mb-3">
                            {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
                        </p>
                        <h1 className="font-light tracking-tight text-white"
                            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', fontStyle: 'italic' }}>
                            Tareas y recordatorios
                        </h1>
                    </motion.div>
                    <button
                        onClick={() => setShowForm(prev => !prev)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs uppercase tracking-[0.08em] border transition-all duration-300
              ${showForm
                                ? 'bg-[rgba(201,178,124,0.12)] text-[#C9B27C] border-[rgba(201,178,124,0.3)] shadow-[0_0_18px_rgba(201,178,124,0.06)]'
                                : 'bg-[linear-gradient(180deg,rgba(7,12,24,0.92)_0%,rgba(4,8,18,0.88)_100%)] text-[rgba(255,255,255,0.5)] border-[rgba(88,160,255,0.24)] shadow-[0_0_0_1px_rgba(90,170,255,0.08)_inset,0_0_10px_rgba(54,126,255,0.06)] hover:border-[rgba(201,178,124,0.72)] hover:bg-[linear-gradient(180deg,rgba(24,18,10,0.96)_0%,rgba(14,10,6,0.92)_100%)] hover:text-[#C9B27C] hover:shadow-[0_0_0_1px_rgba(201,178,124,0.12)_inset,0_0_14px_rgba(201,178,124,0.18)]'
                            }`}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Nueva tarea
                    </button>
                </div>

                {/* Form */}
                <AnimatePresence>
                    {showForm && (
                        <div className="mb-5">
                            <NewTaskForm onAdd={handleAdd} onClose={() => setShowForm(false)} />
                        </div>
                    )}
                </AnimatePresence>

                {/* Lista pendientes */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-6 h-6 text-[rgba(201,178,124,0.4)] animate-spin" />
                        <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em]">Cargando tareas…</p>
                    </div>
                ) : (
                    <>
                        <AnimatePresence>
                            {pending.length === 0 && !showForm && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-16 gap-3"
                                >
                                    <CheckCircle2 className="w-10 h-10 text-[rgba(201,178,124,0.2)]" />
                                    <p className="text-sm text-[rgba(255,255,255,0.2)]">Todo al día</p>
                                    <p className="text-xs text-[rgba(255,255,255,0.1)]">No hay tareas pendientes</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.div layout className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {pending.map(task => (
                                    <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
                                ))}
                            </AnimatePresence>
                        </motion.div>

                        {/* Completadas */}
                        {done.length > 0 && (
                            <div className="mt-8">
                                <button
                                    onClick={() => setShowDone(prev => !prev)}
                                    className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.2)]
                    hover:text-[rgba(255,255,255,0.4)] transition-colors mb-3 uppercase tracking-[0.1em]"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {done.length} completada{done.length !== 1 ? 's' : ''}
                                    <span className="text-[rgba(255,255,255,0.15)]">{showDone ? '▲' : '▼'}</span>
                                </button>

                                <AnimatePresence>
                                    {showDone && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-2 overflow-hidden"
                                        >
                                            {done.map(task => (
                                                <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
}