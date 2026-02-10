import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

const api = axios.create({
    baseURL: API + "/api",
});

/* Interceptor: añade token automáticamente */
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("auth_token");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

export default api;

// -----------------------------
// Asistente IA
// -----------------------------
export const sendAssistantMessage = async (text) => {
    const response = await api.post("/assistant", {
        text: text,
    });

    return response.data;
};
