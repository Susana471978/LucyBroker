import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const orig = error.config;
    const url = orig?.url || "";

    // No reintentar en rutas de auth ni si ya reintentamos
    if (
      error.response?.status === 401 &&
      !orig._retry &&
      !url.includes("/auth/refresh") &&
      !url.includes("/auth/login") &&
      !url.includes("/auth/me")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then(() => apiClient(orig))
          .catch((e) => Promise.reject(e));
      }
      orig._retry = true;
      isRefreshing = true;
      try {
        await apiClient.post("/auth/refresh");
        processQueue(null);
        return apiClient(orig);
      } catch (e) {
        processQueue(e);
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
