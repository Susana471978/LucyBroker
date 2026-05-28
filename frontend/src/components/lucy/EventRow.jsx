import { motion } from 'framer-motion';
import { formatEventTime } from '../../services/calendarService';

const EventRow = ({ event, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-start gap-3 py-3 border-b border-[rgba(255,255,255,0.04)] last:border-0"
    >
        <div className="mt-0.5 w-14 text-right flex-shrink-0">
            <span className="text-caption text-[rgba(201,178,124,0.6)] font-medium tabular-nums">
                {event.all_day ? 'Todo el día' : formatEventTime(event.start)}
            </span>
        </div>

        <div className="flex-1 min-w-0">
            <p className="text-body-sm text-[rgba(255,255,255,0.75)] truncate">{event.title}</p>
            {event.location && <p className="text-caption text-[rgba(255,255,255,0.25)] truncate mt-0.5">{event.location}</p>}
            {event.attendees?.length > 0 && (
                <p className="text-caption text-[rgba(255,255,255,0.2)] mt-0.5 truncate">
                    con {event.attendees.slice(0, 2).join(', ')}
                    {event.attendees.length > 2 ? ` +${event.attendees.length - 2}` : ''}
                </p>
            )}
        </div>

        {event.meet_link && (
            <a
                href={event.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(201,178,124,0.06)] border border-[rgba(201,178,124,0.15)] text-[rgba(201,178,124,0.45)] hover:text-[#C9B27C] hover:border-[rgba(201,178,124,0.3)] transition-all duration-200"
                title="Unirse a Meet"
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
            </a>
        )}
    </motion.div>
);

export default EventRow;
