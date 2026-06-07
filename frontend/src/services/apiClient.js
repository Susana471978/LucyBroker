import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true,
    timeout: 45000,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Flag to prevent redirect loops (multiple 401s at once) ──
let isRedirecting = false;

api.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err?.response?.status;

        if (status === 401 && !isRedirecting && !err?.config?.url?.includes('auth/login') && !err?.config?.url?.includes('auth/register')) {
            isRedirecting = true;

            // Clear all auth state
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            localStorage.removeItem('trial_start');
            sessionStorage.removeItem('briefing_done');

            // Redirect to landing — only if not already there
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }

            // Reset flag after redirect completes
            setTimeout(() => { isRedirecting = false; }, 2000);
        }

        console.error('API Error:', err?.response || err);
        return Promise.reject(err);
    }
);

export default api;