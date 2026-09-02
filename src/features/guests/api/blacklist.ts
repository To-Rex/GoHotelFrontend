import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* Mehmonlar qora ro'yxati.

   Nojo'ya xatti-harakat qilgan mehmonni qayta qabul qilmaslik uchun.
   Ro'yxatga faqat ADMINISTRATOR qo'sha oladi va sabab majburiy — "nega bu
   odam ro'yxatda?" degan savolga keyin ham javob bo'lishi kerak.

   Ro'yxatdagi mehmonga bron ochish standart holda TAQIQLANADI; qoidani
   mehmonxona sozlamadan o'zgartirishi mumkin. */

export interface BlacklistedGuest {
  guest_id: string
  first_name: string
  last_name: string
  phone?: string | null
  passport_number?: string | null
  blacklisted_at: string
  blacklist_reason?: string | null
  blacklisted_by?: string | null
  blacklisted_by_name?: string | null
}

export const useBlacklist = (enabled = true) =>
  useQuery({
    queryKey: ["guestBlacklist"],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<BlacklistedGuest[]>("/guests/blacklist")
      return Array.isArray(data) ? data : []
    },
  })

/** Ro'yxat o'zgargach mehmonlar va bron oynalari ham yangilanishi kerak. */
const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["guestBlacklist"] })
  qc.invalidateQueries({ queryKey: ["guests"] })
}

export const useAddToBlacklist = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await api.post(`/guests/${id}/blacklist`, { reason })
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export const useRemoveFromBlacklist = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/guests/${id}/blacklist`)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export interface BlacklistPolicy {
  block_booking: boolean
  default_block_booking: boolean
}

export const useBlacklistPolicy = () =>
  useQuery({
    queryKey: ["blacklistPolicy"],
    queryFn: async () => {
      const { data } = await api.get<BlacklistPolicy>("/guests/blacklist-settings")
      return data
    },
  })

export const useSaveBlacklistPolicy = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (blockBooking: boolean) => {
      const { data } = await api.put<BlacklistPolicy>("/guests/blacklist-settings", {
        block_booking: blockBooking,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blacklistPolicy"] }),
  })
}
