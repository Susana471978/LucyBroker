// frontend/src/hooks/useAlerts.js

import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../services/apiClient';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useAlerts(token) {
    const [alerts, setAlerts] = useState([]);
    const [currentAlert, setCurrentAlert] = useState(null);
    const intervalRef = useRef(null);
    const queueRef = useRef([]);

    const fetchAlerts = useCallback(async () => {
        if (!token) return;
        try {
            const res = await apiClient.get('/alerts/check');
            const data = res.data?.data || res.data;
            const newAlerts = data.alerts || [];
            setAlerts(newAlerts);

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
            await apiClient.post(`/alerts/dismiss/${alertId}`, {});
        } catch (err) {
            // Silent fail
        }

        setCurrentAlert(null);

        setTimeout(() => {
            if (queueRef.current.length > 0) {
                setCurrentAlert(queueRef.current.shift());
            }
        }, 1000);
    }, [token]);

    useEffect(() => {
        if (!token) return;

        const initialTimer = setTimeout(fetchAlerts, 10000);
        intervalRef.current = setInterval(fetchAlerts, POLL_INTERVAL);

        return () => {
            clearTimeout(initialTimer);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [token, fetchAlerts]);

    return { alerts, currentAlert, dismissAlert };
}