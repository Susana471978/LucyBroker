// frontend/src/components/OnboardingBanner.js

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Mail, Calendar, Brain, Sparkles, X, ChevronRight } from 'lucide-react';

const STEPS = [
    {
        id: 'gmail',
        icon: Mail,
        title: 'Conecta tu correo',
        description: 'Lucy priorizará tu bandeja cada mañana.',
        check: (props) => props.gmailConnected,
    },
    {
        id: 'calendar',
        icon: Calendar,
        title: 'Conecta tu agenda',
        description: 'Lucy incluirá tus eventos en el briefing.',
        check: (props) => props.calendarConnected,
    },
    {
        id: 'briefing',
        icon: Sparkles,
        title: 'Escucha tu primer briefing',
        description: 'Di "Hola Lucy" o pulsa Generar briefing.',
        check: (props) => props.briefingDone,
    },
];

export default function OnboardingBanner({
    gmailConnected,
    calendarConnected,
    briefingDone,
    onConnectGmail,
    onConnectCalendar,
    onRunBriefing,
}) {
    const [dismissed, setDismissed] = useState(false);
    const [visible, setVisible] = useState(false);

    const completedSteps = STEPS.filter(s => s.check({ gmailConnected, calendarConnected, briefingDone })).length;
    const allDone = completedSteps === STEPS.length;
    const currentStep = STEPS.find(s => !s.check({ gmailConnected, calendarConnected, briefingDone }));

    useEffect(() => {
        // Don't show if already dismissed or all steps done
        const key = 'lucy_onboarding_dismissed';
        if (sessionStorage.getItem(key) || localStorage.getItem(key)) {
            setDismissed(true);
            return;
        }
        // Show after a short delay
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Auto-dismiss when all steps are complete
        if (allDone && visible) {
            const timer = setTimeout(() => {
                localStorage.setItem('lucy_onboarding_dismissed', '1');
                setVisible(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [allDone, visible]);

    const handleDismiss = () => {
        sessionStorage.setItem('lucy_onboarding_dismissed', '1');
        setVisible(false);
    };

    const handleAction = () => {
        if (!currentStep) return;
        if (currentStep.id === 'gmail') onConnectGmail?.();
        if (currentStep.id === 'calendar') onConnectCalendar?.();
        if (currentStep.id === 'briefing') onRunBriefing?.();
    };

    if (dismissed || !visible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative rounded-2xl overflow-hidden bg-[rgba(201,178,124,0.03)] border border-[rgba(201,178,124,0.12)]"
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.3)] to-transparent" />

                <div className="p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center
                bg-[rgba(201,178,124,0.1)] border border-[rgba(201,178,124,0.2)]">
                                <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
                                    <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill="#C9B27C" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-[rgba(255,255,255,0.75)]">
                                    {allDone ? '¡Todo listo!' : 'Configura Lucy en 2 minutos'}
                                </p>
                                <p className="text-xs text-[rgba(255,255,255,0.25)] mt-0.5">
                                    {allDone ? 'Lucy está preparada para ayudarte.' : `${completedSteps} de ${STEPS.length} pasos completados`}
                                </p>
                            </div>
                        </div>

                        <button onClick={handleDismiss}
                            className="w-6 h-6 rounded-lg flex items-center justify-center
                text-[rgba(255,255,255,0.15)] hover:text-[rgba(255,255,255,0.4)]
                hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 rounded-full bg-[rgba(255,255,255,0.05)] mb-4 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(completedSteps / STEPS.length) * 100}%` }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className={`h-full rounded-full transition-colors duration-500
                ${allDone ? 'bg-emerald-400' : 'bg-[rgba(201,178,124,0.5)]'}`}
                        />
                    </div>

                    {/* Steps */}
                    <div className="flex gap-2">
                        {STEPS.map((step, i) => {
                            const Icon = step.icon;
                            const done = step.check({ gmailConnected, calendarConnected, briefingDone });
                            const isCurrent = currentStep?.id === step.id;

                            return (
                                <div
                                    key={step.id}
                                    className={`flex-1 rounded-xl p-3 transition-all duration-300 border
                    ${done
                                            ? 'bg-[rgba(52,211,153,0.04)] border-[rgba(52,211,153,0.12)]'
                                            : isCurrent
                                                ? 'bg-[rgba(201,178,124,0.04)] border-[rgba(201,178,124,0.15)]'
                                                : 'bg-[rgba(255,255,255,0.015)] border-[rgba(255,255,255,0.04)]'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px]
                      ${done
                                                ? 'bg-[rgba(52,211,153,0.15)] text-emerald-400'
                                                : isCurrent
                                                    ? 'bg-[rgba(201,178,124,0.1)] text-[#C9B27C]'
                                                    : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.15)]'
                                            }`}>
                                            {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                                        </div>
                                        <span className={`text-xs font-medium
                      ${done ? 'text-emerald-400/60 line-through' : isCurrent ? 'text-[rgba(255,255,255,0.7)]' : 'text-[rgba(255,255,255,0.25)]'}`}>
                                            {step.title}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-[rgba(255,255,255,0.2)] leading-relaxed pl-7">
                                        {step.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* CTA for current step */}
                    {currentStep && !allDone && (
                        <button onClick={handleAction}
                            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium
                bg-[rgba(201,178,124,0.08)] border border-[rgba(201,178,124,0.2)] text-[#C9B27C]
                hover:bg-[rgba(201,178,124,0.15)] hover:border-[rgba(201,178,124,0.35)]
                transition-all duration-300">
                            {currentStep.title}
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}