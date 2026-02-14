import axios from 'axios';

const API =
    process.env.NODE_ENV === 'production'
        ? '/api'
        : 'http://127.0.0.1:8000/api';

const api = axios.create({
    baseURL: API,
    withCredentials: true,
    timeout: 15000,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

/**
 * Interceptor errores
 */
api.interceptors.response.use(
    (res) => res,
    (err) => {
        console.error('API Error:', err?.response || err);
        return Promise.reject(err);
    }
);

export default api;
