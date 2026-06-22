// ─────────────────────────────────────────────
// frontend/src/services/apiClient.js
// Axios sin localStorage — cookies httpOnly + refresh automático
// ─────────────────────────────────────────────

import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,   // ← envía/recibe cookies en cada petición
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Flag para evitar bucles infinitos de refresh ──────────────────────────────
let isRefreshing = false;
let failedQueue = [];      // peticiones en espera mientras se refresca

const processQueue = (error) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// ── Interceptor de respuesta ──────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Solo intentamos refresh en 401 y si no es el propio endpoint de refresh/login
    const isAuthEndpoint =
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/login");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Encola la petición hasta que termine el refresh
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post("/auth/refresh");   // rota los tokens en cookies
        processQueue(null);
        return apiClient(originalRequest);       // reintenta la petición original
      } catch (refreshError) {
        processQueue(refreshError);
        // Refresh también falló → sesión caducada, redirige al login
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
