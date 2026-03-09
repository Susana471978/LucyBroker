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

api.interceptors.response.use(
    (res) => res,
    (err) => {
        console.error('API Error:', err?.response || err);
        return Promise.reject(err);
    }
);

export default api;