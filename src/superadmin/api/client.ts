import axios from "axios"

import { API_URL } from "@/lib/api"

/**
 * Boshqaruv paneli uchun ALOHIDA HTTP mijozi.
 *
 * Asosiy `api` nusxasi mehmonxona xodimining tokenini va qurilma
 * sarlavhasini qo'shadi — panelga ular kerak emas va zarar ham
 * keltirardi: xodim tokeni panelda yaroqsiz, qurilma tekshiruvi esa
 * panelga umuman taalluqli emas.
 *
 * Shuning uchun panel o'z nusxasi, o'z tokeni bilan ishlaydi. Ikkala
 * sessiya bir vaqtda ochiq turishi ham mumkin: bitta brauzerda
 * mehmonxona ekrani va panel bir-biriga xalaqit bermaydi.
 */

export const PANEL_TOKEN_KEY = "panelAccessToken"

export const panelApi = axios.create({
  baseURL: `${API_URL}/superadmin`,
  headers: { "Content-Type": "application/json" },
})

panelApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(PANEL_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

panelApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token eskirgan yoki hisob to'xtatilgan — panel kirish sahifasiga
    // qaytadi. Mehmonxona sessiyasiga TEGILMAYDI.
    if (error?.response?.status === 401) {
      localStorage.removeItem(PANEL_TOKEN_KEY)
      if (window.location.pathname.startsWith("/panel")) {
        window.location.replace("/panel/login")
      }
    }
    return Promise.reject(error)
  }
)

/** Xato matnini foydalanuvchiga ko'rsatish uchun. */
export function panelError(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string }
    if (first?.msg) return first.msg
  }
  return "Xatolik yuz berdi. Qayta urinib ko'ring."
}
