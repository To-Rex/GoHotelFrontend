import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* Qarz eslatmalari — mehmonxona sozlamasi.

   Server shu oraliqda xodimlarga (administrator va to'lov qabul
   qiluvchilar) qarzdorlar ro'yxatini push bilan yuboradi; veb ham shu
   oraliqda eslatma chiqaradi. "Qarz bilan chiqib ketdi" va "bugun
   chiqadi" xabarlari oraliqqa bog'liq emas — darhol. */

export interface DebtSettings {
  enabled: boolean
  interval_minutes: number
  allowed_intervals?: number[]
}

export const DEFAULT_DEBT_SETTINGS: DebtSettings = {
  enabled: true,
  interval_minutes: 120,
  allowed_intervals: [30, 60, 120, 240, 480],
}

export const useDebtSettings = (enabled = true) =>
  useQuery({
    queryKey: ["debtSettings"],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<DebtSettings>("/hotels/debt-settings")
      return { ...DEFAULT_DEBT_SETTINGS, ...(data || {}) }
    },
    staleTime: 5 * 60 * 1000,
    // Eski serverda endpoint yo'q — standart qiymatlar bilan ishlayveradi
    retry: false,
  })

export const useSaveDebtSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (next: { enabled: boolean; interval_minutes: number }) => {
      const { data } = await api.put<DebtSettings>("/hotels/debt-settings", next)
      return data
    },
    onSuccess: (data) =>
      qc.setQueryData(["debtSettings"], { ...DEFAULT_DEBT_SETTINGS, ...(data || {}) }),
  })
}
