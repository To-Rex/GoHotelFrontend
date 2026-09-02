import axios from "axios";

// Dev rejimida nisbiy "/api/v1" ishlatiladi (vite dev-server proxy backendga uzatadi).
// Production buildda esa proxy bo'lmaydi — shuning uchun backendning to'liq manzili
// ishlatiladi (VITE_API_URL to'liq URL qilib berilsa, o'sha ustun turadi).
const PROD_URL = "https://gohotel-gohotel-backend-lhyen5-ecceab-13-140-185-49.sslip.io";
const envUrl = import.meta.env.VITE_API_URL || "/api/v1";
export const API_URL =
  import.meta.env.DEV || envUrl.startsWith("http") ? envUrl : `${PROD_URL}${envUrl}`;

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
import { getDeviceId } from "./deviceId";

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Qurilma identifikatori — kirish faqat administrator tasdiqlagan
    // qurilmadan mumkin. Har so'rovda yuboriladi: login uchun majburiy,
    // qolganlarida server e'tibor bermaydi.
    const deviceId = getDeviceId();
    if (deviceId) {
      config.headers["X-Device-Id"] = deviceId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Bu yo'llardagi 401 "sessiya tugadi" emas — noto'g'ri parol/yuz kabi ODDIY
// xato: refresh urinilmaydi va sahifa qayta yuklanmaydi (xato formada ko'rinadi)
const AUTH_PATHS = ["/auth/login", "/auth/refresh", "/auth/face/"];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = String(originalRequest?.url || "");
    const isAuthPath = AUTH_PATHS.some((p) => url.includes(p));

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthPath) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
        localStorage.setItem("accessToken", data.access_token);

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (err) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        // Login sahifasida turgan bo'lsak qayta yuklash shart emas
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);
