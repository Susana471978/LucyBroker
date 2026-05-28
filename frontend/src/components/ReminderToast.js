// frontend/src/components/ReminderToast.js

import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';

export default function ReminderToast({ reminder, onDismiss }) {
    if (!reminder) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 60, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 60, scale: 0.95 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="fixed bottom-6 right-6 z-[100] max-w-sm w-full"
            >
                <div className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)]
          bg-[rgba(12,12,18,0.95)] border border-[rgba(201,178,124,0.25)] backdrop-blur-xl">

                    {/* Gold top line */}
                    <div className="h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.5)] to-transparent" />

                    <div className="p-5">
                        <div className="flex items-start gap-4">
                            {/* Bell icon with pulse */}
                            <div className="relative flex-shrink-0">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center
                  bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.25)]">
                                    <Bell className="w-4.5 h-4.5 text-[#C9B27C]" />
                                </div>
                                <motion.div
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute -inset-1 rounded-xl border border-[rgba(201,178,124,0.3)]"
                                />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-[rgba(201,178,124,0.6)] uppercase tracking-[0.12em] font-medium mb-1">
                                    Lucy · Recordatorio
                                </p>
                                <p className="text-sm text-[rgba(255,255,255,0.8)] leading-relaxed">
                                    {reminder.text}
                                </p>
                            </div>

                            {/* Dismiss */}
                            <button onClick={onDismiss}
                                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                  text-[rgba(255,255,255,0.2)] hover:text-[rgba(255,255,255,0.5)]
                  hover:bg-[rgba(255,255,255,0.05)] transition-all duration-200">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Auto-dismiss progress bar */}
                        <motion.div
                            initial={{ scaleX: 1 }}
                            animate={{ scaleX: 0 }}
                            transition={{ duration: 15, ease: 'linear' }}
                            onAnimationComplete={onDismiss}
                            className="mt-4 h-0.5 rounded-full bg-[rgba(201,178,124,0.2)] origin-left"
                        />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}