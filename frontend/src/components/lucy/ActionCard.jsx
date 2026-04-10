import { motion } from 'framer-motion';
import { Link2 } from 'lucide-react';

const ActionCard = ({ icon, title, description, actionLabel, onAction, connected, connectedLabel, onDisconnect, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`group relative overflow-hidden card-lucy-compact border backdrop-blur-xl transition-all duration-300 ${connected
            ? 'border-[rgba(88,160,255,0.15)] bg-[linear-gradient(180deg,rgba(6,12,24,0.96)_0%,rgba(3,8,18,0.99)_100%)]'
            : 'border-[rgba(201,178,124,0.13)] bg-[linear-gradient(180deg,rgba(10,13,20,0.96)_0%,rgba(5,7,12,0.99)_100%)] hover:border-[rgba(201,178,124,0.18)]'
            }`}
    >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(201,178,124,0.04),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[13px] border border-[rgba(255,255,255,0.03)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.08)] to-transparent" />

        <div className="relative z-10 flex items-start gap-3">
            <div
                className={`flex h-8 w-8 items-center justify-center rounded-[14px] border flex-shrink-0 transition-all duration-300 ${connected
                    ? 'border-[rgba(88,160,255,0.20)] bg-[rgba(88,160,255,0.08)] text-[#00B4D8] shadow-[0_0_16px_rgba(36,99,235,0.06)]'
                    : 'border-[rgba(201,178,124,0.18)] bg-[rgba(201,178,124,0.08)] text-[rgba(201,178,124,0.72)] group-hover:text-[#C9B27C]'
                    }`}
            >
                {icon}
            </div>

            <div className="flex-1 min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h4 className="text-h3 font-medium tracking-[-0.02em] text-[rgba(244,247,255,0.95)]">
                        {title}
                    </h4>

                    {connected && (
                        <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-[#00B4D8] shadow-[0_0_8px_rgba(0,180,216,0.65)]" />
                            <span className="text-body-sm text-[rgba(0,180,216,0.86)]">Conectado</span>
                        </div>
                    )}
                </div>

                <p className="mb-3 text-body-sm leading-[1.6] text-[rgba(196,208,228,0.42)]">
                    {connected ? connectedLabel : description}
                </p>

                {connected ? (
                    <button
                        onClick={onDisconnect}
                        className="text-body-sm font-medium text-[rgba(170,186,210,0.52)] transition-colors duration-200 hover:text-[rgba(241,246,255,0.84)]"
                    >
                        Desconectar
                    </button>
                ) : (
                    <button
                        onClick={onAction}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(201,178,124,0.22)] bg-[linear-gradient(180deg,rgba(40,30,11,0.90)_0%,rgba(22,16,7,0.98)_100%)] px-3.5 py-2 text-caption font-medium text-[rgba(232,205,138,0.96)] transition-all duration-200 hover:border-[rgba(201,178,124,0.34)] hover:text-[rgba(246,223,160,0.98)] hover:shadow-[0_0_14px_rgba(201,178,124,0.10)]"
                    >
                        <Link2 className="w-3.5 h-3.5" />
                        {actionLabel}
                    </button>
                )}
            </div>
        </div>
    </motion.div>
);

export default ActionCard;
