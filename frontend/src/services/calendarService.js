import apiClient from './apiClient';

export const getCalendarStatus = async () => {
    const res = await apiClient.get('/calendar/status');
    return res.data?.data ?? res.data;
};

export const connectCalendar = async () => {
    const res = await apiClient.get('/calendar/auth');
    const data = res.data?.data ?? res.data;
    if (data?.auth_url) {
        window.location.href = data.auth_url;
    }
};

export const disconnectCalendar = async () => {
    const res = await apiClient.post('/calendar/disconnect');
    return res.data?.data ?? res.data;
};

export const getTodayEvents = async () => {
    const res = await apiClient.get('/calendar/today');
    return res.data?.data ?? res.data ?? [];
};

export const getUpcomingEvents = async (days = 7, maxResults = 20) => {
    const res = await apiClient.get('/calendar/upcoming', {
        params: { days, max_results: maxResults },
    });
    return res.data?.data ?? res.data ?? [];
};

export const createEvent = async ({ title, date, start_time, end_time, description, location, attendees }) => {
    const res = await apiClient.post('/calendar/events', {
        title,
        date,
        start_time: start_time || '09:00',
        end_time: end_time || '10:00',
        description: description || '',
        location: location || '',
        attendees: attendees || [],
    });
    return res.data?.data ?? res.data;
};

export const formatEventTime = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (dateString.length === 10) {
            return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
        }
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return dateString;
    }
};

export const summarizeEventsForBriefing = (events = []) => {
    if (!events.length) return null;
    const count = events.length;
    if (count === 1) {
        const e = events[0];
        const time = e.all_day ? 'todo el dia' : formatEventTime(e.start);
        return `Tienes una reunion hoy a las ${time}: ${e.title}.`;
    }
    const times = events.filter(e => !e.all_day).map(e => formatEventTime(e.start)).join(', ');
    return `Tienes ${count} eventos hoy${times ? ` - a las ${times}` : ''}.`;
};