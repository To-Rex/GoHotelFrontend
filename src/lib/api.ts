import axios from "axios";

// Backend manzili FAQAT .env dan olinadi (VITE_API_URL) — kodda qattiq
// yozilgan domen yo'q. Standart qiymat nisbiy "/api/v1": frontend va backend
// bitta domenda (gohotels.uz, /api yo'li backendga) — CORS ham kerak emas.
// Dev rejimida ham shu nisbiy yo'l ishlaydi: vite dev-server proxy'si uni
// VITE_API_BASE dagi serverga uzatadi (vite.config.ts).
export const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
import { getDeviceId } from "./deviceId";
import { HOTEL_BLOCK_MESSAGE_KEY, isHotelBlockCode } from "./hotelBlock";

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

    /* QURILMA RUXSATI BEKOR QILINGAN.

       Administrator qurilmani taqiqlasa yoki ro'yxatdan o'chirsa, ochiq
       sessiya darhol to'xtashi kerak — aks holda xodim token muddatigacha
       ishlab yuraverardi. Server buni har so'rovda tekshiradi va 403
       qaytaradi.

       Sessiya tozalanadi va sabab ko'rsatiladigan sahifaga o'tiladi.
       O'chirilgan qurilma esa kirish sahifasiga: u yerda qurilma yangi
       sifatida qayta ro'yxatga tushadi. */
    const deviceCode = error.response?.data?.error_code;
    if (
      error.response?.status === 403 &&
      (deviceCode === "DEVICE_REVOKED" ||
        deviceCode === "DEVICE_BLOCKED" ||
        deviceCode === "DEVICE_PENDING") &&
      !isAuthPath
    ) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      const target =
        deviceCode === "DEVICE_REVOKED"
          ? "/login"
          : `/device-pending?code=${deviceCode}`;
      // Qayta-qayta yo'naltirmaslik uchun: allaqachon o'sha sahifada
      // bo'lsak tegmaymiz
      if (!window.location.pathname.startsWith(target.split("?")[0])) {
        window.location.replace(target);
      }
      return Promise.reject(error);
    }

    /* MEHMONXONA XIZMATI TO'XTATILGAN.

       Panel obyektni to'xtatsa, server har bir so'rovga 403 va
       `HOTEL_INACTIVE` (yoki `HOTEL_SUSPENDED`) qaytaradi. Ilgari bu
       oddiy xato sifatida yutilardi: so'rovlar bittalab yiqilar, ekran
       esa cheksiz skelet holatida qolib, dastur buzilgandek ko'rinardi.

       Sessiya TOZALANMAYDI — xizmat tiklangach xodim o'sha yerdan ishini
       davom ettiradi. Serverning matni sahifada ko'rsatish uchun
       saqlanadi: to'liq qayta yuklashda router state yo'qoladi. */
    const hotelCode = error.response?.data?.error_code;
    if (
      error.response?.status === 403 &&
      isHotelBlockCode(hotelCode) &&
      !isAuthPath
    ) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string" && detail) {
        try {
          sessionStorage.setItem(HOTEL_BLOCK_MESSAGE_KEY, detail);
        } catch {
          /* Shaxsiy rejimda saqlash taqiqlangan bo'lishi mumkin —
             sahifada umumiy matn baribir ko'rinadi */
        }
      }
      if (!window.location.pathname.startsWith("/service-stopped")) {
        window.location.replace(`/service-stopped?code=${hotelCode}`);
      }
      return Promise.reject(error);
    }

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
