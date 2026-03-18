// frontend/src/components/AlertToast.js

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AlertToast({ alert, onDismiss }) {
    const navigate = useNavigate();

    if (!alert) return null;

    const priorityStyles = {
        high: 'border-[rgba(239,68,68,0.25)]',
        medium: 'border-[rgba(201,178,124,0.25)]',
        low: 'border-[rgba(255,255,255,0.1)]',
    };

    const handleAction = () => {
        if (alert.action === 'briefing') {
            // Trigger briefing — user will handle this
            onDismiss(alert.id);
            return;
        }
        if (alert.action?.startsWith('/')) {
            navigate(alert.action);
        }
        onDismiss(alert.id);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 60, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 60, scale: 0.95 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="fixed bottom-6 left-6 z-[90] max-w-sm w-full"
            >
                <div className={`rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)]
          bg-[rgba(12,12,18,0.95)] border backdrop-blur-xl ${priorityStyles[alert.priority] || priorityStyles.low}`}>

                    <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent" />

                    <div className="p-5">
                        <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-lg">
                                {alert.icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-[rgba(255,255,255,0.3)] uppercase tracking-[0.12em] font-medium mb-1">
                                    Lucy · Alerta
                                </p>
                                <p className="text-sm text-[rgba(255,255,255,0.8)] font-medium mb-1">
                                    {alert.title}
                                </p>
                                <p className="text-xs text-[rgba(255,255,255,0.45)] leading-relaxed">
                                    {alert.message}
                                </p>
                            </div>

                            {/* Dismiss */}
                            <button onClick={() => onDismiss(alert.id)}
                                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                  text-[rgba(255,255,255,0.2)] hover:text-[rgba(255,255,255,0.5)]
                  hover:bg-[rgba(255,255,255,0.05)] transition-all duration-200">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Action button */}
                        {alert.action && (
                            <button onClick={handleAction}
                                className="mt-3 w-full py-2 rounded-xl text-xs font-medium text-center
                  bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]
                  text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.08)]
                  transition-all duration-200">
                                {alert.action === 'briefing' ? 'Escuchar briefing' : 'Ver detalles'}
                            </button>
                        )}

                        {/* Auto-dismiss progress */}
                        <motion.div
                            initial={{ scaleX: 1 }}
                            animate={{ scaleX: 0 }}
                            transition={{ duration: 20, ease: 'linear' }}
                            onAnimationComplete={() => onDismiss(alert.id)}
                            className="mt-3 h-0.5 rounded-full bg-[rgba(255,255,255,0.06)] origin-left"
                        />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}