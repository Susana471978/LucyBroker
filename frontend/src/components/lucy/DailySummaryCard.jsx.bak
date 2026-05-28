import { motion } from 'framer-motion';
import { Inbox, Clock, Paperclip, Sparkles, Calendar } from 'lucide-react';

export default function DailySummaryCard({ stats, onViewEmails, onSummarize, onOrganize, summarizeDisabled }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="card-lucy border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(8,12,22,0.95)_0%,rgba(4,7,15,0.99)_100%)] backdrop-blur-xl"
        >
            <div className="flex flex-col gap-4">
                <h3 className="text-h3 font-medium text-[rgba(248,250,255,0.95)] tracking-[-0.02em]">
                    Hoy Lucy ha preparado esto para ti
                </h3>

                <div className="flex flex-col gap-3">
                    {stats.total > 0 && (
                        <div className="flex items-start gap-3">
                            <Inbox className="w-4 h-4 mt-0.5 text-[rgba(201,178,124,0.5)] flex-shrink-0" />
                            <p className="text-body text-[rgba(196,208,228,0.55)] leading-relaxed">
                                Tu bandeja tiene <span className="text-[rgba(255,255,255,0.8)]">{stats.total}</span> correo{stats.total !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}
                    {stats.prioritarios > 0 && (
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-4 h-4 mt-0.5 text-[rgba(201,178,124,0.5)] flex-shrink-0" />
                            <p className="text-body text-[rgba(196,208,228,0.55)] leading-relaxed">
                                Tienes <span className="text-[rgba(201,178,124,0.9)]">{stats.prioritarios}</span> email{stats.prioritarios !== 1 ? 's' : ''} prioritario{stats.prioritarios !== 1 ? 's' : ''} pendiente{stats.prioritarios !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}
                    {stats.seguimiento > 0 && (
                        <div className="flex items-start gap-3">
                            <Clock className="w-4 h-4 mt-0.5 text-[rgba(201,178,124,0.5)] flex-shrink-0" />
                            <p className="text-body text-[rgba(196,208,228,0.55)] leading-relaxed">
                                Tienes <span className="text-[rgba(255,255,255,0.8)]">{stats.seguimiento}</span> conversacion{stats.seguimiento !== 1 ? 'es' : ''} en seguimiento
                            </p>
                        </div>
                    )}
                    {stats.with_attachments > 0 && (
                        <div className="flex items-start gap-3">
                            <Paperclip className="w-4 h-4 mt-0.5 text-[rgba(201,178,124,0.5)] flex-shrink-0" />
                            <p className="text-body text-[rgba(196,208,228,0.55)] leading-relaxed">
                                <span className="text-[rgba(255,255,255,0.8)]">{stats.with_attachments}</span> correo{stats.with_attachments !== 1 ? 's' : ''} con adjuntos
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                    <button
                        onClick={onViewEmails}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(201,178,124,0.18)] bg-[linear-gradient(180deg,rgba(40,30,11,0.90)_0%,rgba(22,16,7,0.98)_100%)] px-4 py-2.5 text-caption font-medium text-[rgba(232,205,138,0.96)] transition-all duration-200 hover:border-[rgba(201,178,124,0.34)] hover:shadow-[0_0_14px_rgba(201,178,124,0.10)]"
                    >
                        <Inbox className="w-3.5 h-3.5" />
                        Ver mis correos
                    </button>
                    <button
                        onClick={onSummarize}
                        disabled={summarizeDisabled}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-caption font-medium text-[rgba(196,208,228,0.55)] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:text-[rgba(255,255,255,0.75)] disabled:opacity-30"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Resumir mi bandeja
                    </button>
                    <button
                        onClick={onOrganize}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-caption font-medium text-[rgba(196,208,228,0.55)] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:text-[rgba(255,255,255,0.75)]"
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        Organizar mi día
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
