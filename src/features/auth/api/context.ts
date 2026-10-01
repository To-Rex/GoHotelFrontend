import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useAuthStore, type User } from "@/store/auth"

/* Sozlovchi (va tizim ma'muri) uchun: qaysi mehmonxona va filialda ishlash.

   Tanlov SERVERDA tokenga yoziladi (`POST /auth/context` yangi token juftligi
   qaytaradi) — barcha so'rovlar shu mehmonxona bilan ishlaydi, token
   yangilanganda ham saqlanadi. Tanlangan mehmonxonada sozlovchi
   administrator kabi ishlaydi va Sozlamalarni o'zgartira oladi.

   Mehmonxona almashgach sahifa TO'LIQ qayta yuklanadi: React Query keshidagi
   oldingi mehmonxona ma'lumoti (sozlamalar, xonalar, filiallar) yangisiga
   aralashib ketmasligi uchun. */

export interface ContextBranch {
  id: string
  name: string
  code?: string | null
  is_main: boolean
  status?: string | null
}

export interface ContextHotel {
  id: string
  name: string
  code?: string | null
  status: string
  branches: ContextBranch[]
}

export const useContextOptions = (enabled = true) =>
  useQuery({
    queryKey: ["authContextOptions"],
    queryFn: async () => {
      const { data } = await api.get<{ hotels: ContextHotel[] }>("/auth/context/options")
      return Array.isArray(data?.hotels) ? data.hotels : []
    },
    enabled,
    staleTime: 60 * 1000,
  })

/** Qidiruv: nomi yoki kodi bo'yicha, katta-kichik harfga qaramay. */
export const filterHotels = (hotels: ContextHotel[], query: string): ContextHotel[] => {
  const q = query.trim().toLowerCase()
  if (!q) return hotels
  return hotels.filter(
    (h) =>
      (h.name || "").toLowerCase().includes(q) ||
      (h.code || "").toLowerCase().includes(q) ||
      h.branches.some((b) => (b.name || "").toLowerCase().includes(q))
  )
}

/** Filial tanlanmasa — asosiysi (server ham shunday qiladi). */
export const defaultBranchId = (hotel: ContextHotel | undefined | null): string | null => {
  if (!hotel || hotel.branches.length === 0) return null
  return (hotel.branches.find((b) => b.is_main) ?? hotel.branches[0]).id
}

interface ContextTokens {
  access_token: string
  refresh_token: string
}

/**
 * Mehmonxona va filialni tanlash. `hotelId = null` — faqat tizim ma'muri
 * uchun: "barcha mehmonxonalar" holatiga qaytish.
 * Muvaffaqiyatli bo'lsa sahifa qayta yuklanadi va promise hal bo'lmaydi.
 */
export async function switchContext(
  hotelId: string | null,
  branchId: string | null
): Promise<void> {
  const { data } = await api.post<ContextTokens>("/auth/context", {
    hotel_id: hotelId,
    branch_id: hotelId ? branchId : null,
  })
  // Yangi tokenlar AVVAL yoziladi: so'rov interceptor'i tokenni shu yerdan
  // o'qiydi — aks holda /auth/me eski token bilan ketib, eski mehmonxona
  // profili saqlanib qolardi (eski sessiya server tomonida yopilgan ham)
  localStorage.setItem("accessToken", data.access_token)
  localStorage.setItem("refreshToken", data.refresh_token)
  const { data: me } = await api.get<User>("/auth/me")
  useAuthStore.getState().setAuth(me, data.access_token, data.refresh_token)
  window.location.replace("/start")
  await new Promise(() => {})
}
