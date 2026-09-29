import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("wbpro_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("wbpro_token");
      localStorage.removeItem("wbpro_user");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post("/api/auth/login", data),
  register: (data) => api.post("/api/auth/register", data),
  me: () => api.get("/api/me")
};
export const dashboardApi = { get: () => api.get("/api/dashboard"), reports: () => api.get("/api/reports") };
export const contactsApi = {
  list: (q = "") => api.get("/api/contacts", { params: q ? { q } : {} }),
  create: (data) => api.post("/api/contacts", data),
  remove: (id) => api.delete(`/api/contacts/${id}`)
};
export const templatesApi = {
  list: () => api.get("/api/templates"),
  create: (data) => api.post("/api/templates", data),
  remove: (id) => api.delete(`/api/templates/${id}`)
};
export const whatsappApi = {
  list: () => api.get("/api/whatsapp/accounts"),
  create: (data) => api.post("/api/whatsapp/accounts", data),
  connect: (id) => api.post(`/api/whatsapp/accounts/${id}/connect`),
  status: (id) => api.get(`/api/whatsapp/accounts/${id}/status`),
  disconnect: (id) => api.post(`/api/whatsapp/accounts/${id}/disconnect`),
  send: (id, data) => api.post(`/api/whatsapp/accounts/${id}/send`, data),
  messages: (id) => api.get(`/api/whatsapp/accounts/${id}/messages`)
};
export const campaignsApi = {
  list: () => api.get("/api/campaigns"),
  create: (data) => api.post("/api/campaigns", data)
};
export default api;
