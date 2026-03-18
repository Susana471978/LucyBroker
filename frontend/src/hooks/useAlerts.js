// frontend/src/hooks/useAlerts.js

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useAlerts(token) {
    const [alerts, setAlerts] = useState([]);
    const [currentAlert, setCurrentAlert] = useState(null);
    const intervalRef = useRef(null);
    const queueRef = useRef([]);

    const fetchAlerts = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API}/alerts/check`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = res.data?.data || res.data;
            const newAlerts = data.alerts || [];
            setAlerts(newAlerts);

            // Show first unshown alert
            if (newAlerts.length > 0 && !currentAlert) {
                queueRef.current = [...newAlerts];
                setCurrentAlert(queueRef.current.shift());
            }
        } catch (err) {
            // Silent fail — alerts are non-critical
        }
    }, [token, currentAlert]);

    const dismissAlert = useCallback(async (alertId) => {
        if (!token || !alertId) return;
        try {
            await axios.post(`${API}/alerts/dismiss/${alertId}`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch (err) {
            // Silent fail
        }

        setCurrentAlert(null);

        // Show next alert in queue after a short delay
        setTimeout(() => {
            if (queueRef.current.length > 0) {
                setCurrentAlert(queueRef.current.shift());
            }
        }, 1000);
    }, [token]);

    useEffect(() => {
        if (!token) return;

        // Initial fetch after 10 seconds (let the page load first)
        const initialTimer = setTimeout(fetchAlerts, 10000);

        // Poll every 5 minutes
        intervalRef.current = setInterval(fetchAlerts, POLL_INTERVAL);

        return () => {
            clearTimeout(initialTimer);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [token, fetchAlerts]);

    return { alerts, currentAlert, dismissAlert };
}