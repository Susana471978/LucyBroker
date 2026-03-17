// frontend/src/hooks/useReminders.js

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;
const POLL_INTERVAL = 30000; // 30 seconds

export function useReminders(token, ttsEnabled) {
    const [dueReminders, setDueReminders] = useState([]);
    const [currentReminder, setCurrentReminder] = useState(null);
    const audioRef = useRef(null);
    const pollingRef = useRef(null);

    const headers = { Authorization: `Bearer ${token}` };

    // ── Check for due reminders ──
    const checkReminders = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/reminders/check`, { headers });
            const data = res.data?.data || res.data;
            const due = data.due || [];

            if (due.length > 0) {
                setDueReminders(prev => {
                    // Only add new ones
                    const existingIds = new Set(prev.map(r => r.id));
                    const newOnes = due.filter(r => !existingIds.has(r.id));
                    return [...prev, ...newOnes];
                });
            }
        } catch (err) {
            // Silent fail — don't break the app for reminder polling
        }
    }, [token]);

    // ── Process next reminder in queue ──
    useEffect(() => {
        if (dueReminders.length > 0 && !currentReminder) {
            const next = dueReminders[0];
            setCurrentReminder(next);
            setDueReminders(prev => prev.slice(1));

            // Speak the reminder if TTS enabled
            if (ttsEnabled) {
                speakReminder(next.text);
            }

            // Show browser notification if permitted
            showNotification(next.text);

            // Mark as notified on the server
            markNotified(next.id);
        }
    }, [dueReminders, currentReminder, ttsEnabled]);

    // ── Speak reminder with Lucy's voice ──
    const speakReminder = async (text) => {
        try {
            const lucyText = `Recordatorio: ${text}`;
            const res = await fetch(`${API}/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ text: lucyText }),
            });
            if (res.ok) {
                const blob = await res.blob();
                const audio = new Audio(URL.createObjectURL(blob));
                audioRef.current = audio;
                await audio.play();
            }
        } catch (err) {
            console.error('Reminder TTS error:', err);
        }
    };

    // ── Browser notification ──
    const showNotification = (text) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Lucy — Recordatorio', {
                body: text,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                vibrate: [100, 50, 100],
            });
        }
    };

    // ── Mark as notified on server ──
    const markNotified = async (reminderId) => {
        try {
            await axios.post(`${API}/reminders/${reminderId}/mark`, {}, { headers });
        } catch (err) {
            console.error('Mark notified error:', err);
        }
    };

    // ── Dismiss current reminder ──
    const dismissReminder = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setCurrentReminder(null);
    };

    // ── Request notification permission ──
    const requestPermission = useCallback(async () => {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }, []);

    // ── Start polling ──
    useEffect(() => {
        if (!token) return;

        // Request permission on mount
        requestPermission();

        // Initial check
        checkReminders();

        // Poll every 30 seconds
        pollingRef.current = setInterval(checkReminders, POLL_INTERVAL);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [token, checkReminders, requestPermission]);

    return {
        currentReminder,
        dismissReminder,
        dueReminders,
    };
}