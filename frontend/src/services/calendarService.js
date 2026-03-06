// frontend/src/services/calendarService.js
import apiClient from './apiClient';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';
const BASE = `${BASE_URL}/api/calendar`;

export const getCalendarStatus = async () => {
  const res = await apiClient.get(`${BASE}/status`);
  return res.data?.data ?? res.data;
};

export const connectCalendar = async () => {
  const res = await apiClient.get(`${BASE}/auth`);
  const data = res.data?.data ?? res.data;
  if (data?.auth_url) {
    window.location.href = data.auth_url;
  }
};

export const disconnectCalendar = async () => {
  const res = await apiClient.post(`${BASE}/disconnect`);
  return res.data?.data ?? res.data;
};

export const getTodayEvents = async () => {
  const res = await apiClient.get(`${BASE}/today`);
  return res.data?.data ?? res.data ?? [];
};

export const getUpcomingEvents = async (days = 7, maxResults = 20) => {
  const res = await apiClient.get(`${BASE}/upcoming`, {
    params: { days, max_results: maxResults },
  });
  return res.data?.data ?? res.data ?? [];
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
    const time = e.all_day ? 'todo el día' : formatEventTime(e.start);
    return `Tienes una reunión hoy a las ${time}: ${e.title}.`;
  }
  const times = events.filter(e => !e.all_day).map(e => formatEventTime(e.start)).join(', ');
  return `Tienes ${count} eventos hoy${times ? ` — a las ${times}` : ''}.`;
};
